package com.quantstation.web;

import com.quantstation.strategy.multiresolution.MultiResolutionReportService;
import com.quantstation.strategy.multiresolution.MultiResolutionStrategy;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST API Controller for Multi-Resolution Signal Matrix & Recommendation Reports.
 */
@RestController
@RequestMapping("/api/v1/signals/multi-resolution")
@CrossOrigin(origins = "*")
public class MultiResolutionController {

    private final MultiResolutionStrategy strategy;
    private final MultiResolutionReportService reportService;
    private final com.quantstation.strategy.multiresolution.MultiResolutionSimService simService;

    public MultiResolutionController(
            MultiResolutionStrategy strategy,
            MultiResolutionReportService reportService,
            com.quantstation.strategy.multiresolution.MultiResolutionSimService simService
    ) {
        this.strategy = strategy;
        this.reportService = reportService;
        this.simService = simService;
    }

    @GetMapping
    public ResponseEntity<Map<String, MultiResolutionStrategy.SymbolConsensusResult>> getConsensusMatrix() {
        return ResponseEntity.ok(strategy.getLatestConsensusMap());
    }

    @GetMapping(value = "/report", produces = MediaType.TEXT_MARKDOWN_VALUE)
    public ResponseEntity<String> getMarkdownReport() {
        return ResponseEntity.ok(reportService.generateMarkdownReport());
    }

    @PostMapping("/eval/{symbol}")
    public ResponseEntity<MultiResolutionStrategy.SymbolConsensusResult> evaluateSymbol(@PathVariable String symbol) {
        MultiResolutionStrategy.SymbolConsensusResult result = strategy.evaluateSymbol(symbol);
        if (result == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/simulate")
    public ResponseEntity<MultiResolutionStrategy.SymbolConsensusResult> simulateScenario(
            @RequestParam(defaultValue = "SPY") String symbol,
            @RequestParam(defaultValue = "BULLISH_OVERSOLD") String scenario
    ) {
        try {
            com.quantstation.strategy.multiresolution.MultiResolutionSimService.ScenarioType st =
                    com.quantstation.strategy.multiresolution.MultiResolutionSimService.ScenarioType.valueOf(scenario.toUpperCase());
            MultiResolutionStrategy.SymbolConsensusResult result = simService.injectScenario(symbol, st);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/reload-rules")
    public ResponseEntity<Map<String, Object>> reloadRules(@RequestBody(required = false) String ttlContent) {
        try {
            int reloadedCount;
            if (ttlContent != null && !ttlContent.isBlank()) {
                reloadedCount = com.quantstation.strategy.multiresolution.MultiResolutionSpecRegistry.loadFromTtlContent(ttlContent);
            } else {
                java.nio.file.Path path = java.nio.file.Paths.get("core-engine/src/main/resources/ontologies/target_rules.ttl");
                if (java.nio.file.Files.exists(path)) {
                    String fileContent = java.nio.file.Files.readString(path);
                    reloadedCount = com.quantstation.strategy.multiresolution.MultiResolutionSpecRegistry.loadFromTtlContent(fileContent);
                } else {
                    return ResponseEntity.status(404).body(Map.of("error", "target_rules.ttl not found on disk"));
                }
            }
            return ResponseEntity.ok(Map.of("status", "SUCCESS", "reloadedRules", reloadedCount));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
