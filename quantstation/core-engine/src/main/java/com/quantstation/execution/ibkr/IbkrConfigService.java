package com.quantstation.execution.ibkr;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@Service
public class IbkrConfigService {

    private static final Logger log = LoggerFactory.getLogger(IbkrConfigService.class);

    @Value("${quantstation.ibkr.config-dir:/opt/quantstation/ibkr-config}")
    private String configDir;

    @Value("${quantstation.ibkr.host:ib-gateway}")
    private String gatewayHost;

    @Value("${quantstation.ibkr.command-port:7462}")
    private int commandPort;

    public synchronized void writeCredentials(String username, String password, String mode) {
        Path configPath = Paths.get(configDir, "config.ini");
        log.info("Writing credentials for user '{}' to {}", username, configPath);

        if (!Files.exists(configPath)) {
            log.error("IBC config file does not exist at: {}", configPath);
            return;
        }

        try {
            List<String> lines = Files.readAllLines(configPath, StandardCharsets.UTF_8);
            List<String> newLines = new ArrayList<>();
            boolean updatedLogin = false;
            boolean updatedPassword = false;
            boolean updatedMode = false;

            for (String line : lines) {
                String trimmed = line.trim();
                if (trimmed.startsWith("IbLoginId=")) {
                    newLines.add("IbLoginId=" + username);
                    updatedLogin = true;
                } else if (trimmed.startsWith("IbPassword=")) {
                    newLines.add("IbPassword=" + password);
                    updatedPassword = true;
                } else if (trimmed.startsWith("TradingMode=")) {
                    newLines.add("TradingMode=" + mode.toLowerCase());
                    updatedMode = true;
                } else {
                    newLines.add(line);
                }
            }

            // Append if not found
            if (!updatedLogin) newLines.add("IbLoginId=" + username);
            if (!updatedPassword) newLines.add("IbPassword=" + password);
            if (!updatedMode) newLines.add("TradingMode=" + mode.toLowerCase());

            Files.write(configPath, newLines, StandardCharsets.UTF_8);
            log.info("Successfully updated credentials in config.ini");
        } catch (IOException e) {
            log.error("Failed to write credentials to config.ini", e);
            throw new RuntimeException("Failed to update credentials file", e);
        }
    }

    public synchronized void wipeCredentials() {
        Path configPath = Paths.get(configDir, "config.ini");
        log.info("Wiping credentials from config.ini at {}", configPath);

        if (!Files.exists(configPath)) {
            return;
        }

        try {
            List<String> lines = Files.readAllLines(configPath, StandardCharsets.UTF_8);
            List<String> newLines = new ArrayList<>();

            for (String line : lines) {
                String trimmed = line.trim();
                if (trimmed.startsWith("IbLoginId=")) {
                    newLines.add("IbLoginId=");
                } else if (trimmed.startsWith("IbPassword=")) {
                    newLines.add("IbPassword=");
                } else {
                    newLines.add(line);
                }
            }

            Files.write(configPath, newLines, StandardCharsets.UTF_8);
            log.info("Successfully wiped credentials from config.ini");
        } catch (IOException e) {
            log.error("Failed to wipe credentials from config.ini", e);
        }
    }

    public void restartGateway() {
        log.info("Sending RESTART command to IBC Command Server at {}:{}", gatewayHost, commandPort);
        try (Socket socket = new Socket(gatewayHost, commandPort);
             PrintWriter out = new PrintWriter(socket.getOutputStream(), true)) {
            out.println("RESTART");
            log.info("Successfully sent RESTART command to IBC Command Server");
        } catch (Exception e) {
            log.error("Failed to send RESTART command to IBC Command Server. Make sure ib-gateway is running and CommandServerPort=7462 is open.", e);
            throw new RuntimeException("Failed to restart IB Gateway", e);
        }
    }
}
