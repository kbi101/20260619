package com.quantstation.web;

import com.quantstation.execution.ibkr.IbkrConfigService;
import com.quantstation.execution.ibkr.IbkrConnectionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@CrossOrigin
@RestController
@RequestMapping("/api/ibkr")
public class IbkrLoginController {

    private static final Logger log = LoggerFactory.getLogger(IbkrLoginController.class);

    private final IbkrConfigService configService;
    private final IbkrConnectionManager connectionManager;

    public IbkrLoginController(IbkrConfigService configService,
                               IbkrConnectionManager connectionManager) {
        this.configService = configService;
        this.connectionManager = connectionManager;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        log.info("Received dynamic IBKR login request for user '{}' in mode '{}'",
                request.username(), request.mode());

        try {
            // 1. Write the username and password to shared config.ini
            configService.writeCredentials(request.username(), request.password(), request.mode());

            // 2. Send RESTART to the IBC Command Server to restart the Gateway inside the container
            configService.restartGateway();

            // 3. Trigger IbkrConnectionManager to dynamically switch ports and start reconnect loop
            connectionManager.startConnection(request.mode());

            return ResponseEntity.ok(Map.of(
                    "status", "LOGIN_INITIATED",
                    "message", "Credentials written, Gateway restarting."
            ));
        } catch (Exception e) {
            log.error("Failed to execute dynamic login process", e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "ERROR",
                    "message", e.getMessage()
            ));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        boolean isConnected = connectionManager.isConnected();
        return ResponseEntity.ok(Map.of(
                "connected", isConnected,
                "host", connectionManager.getHost(),
                "port", connectionManager.getPort(),
                "provider", "IBKR",
                "status", isConnected ? "CONNECTED" : "DISCONNECTED"
        ));
    }

    public record LoginRequest(
            String username,
            String password,
            String mode
    ) {}
}
