package com.quantstation.web;

import com.quantstation.brokerage.PortfolioAccountService;
import com.quantstation.domain.AccountSummary;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for Portfolio Risk Cockpit account analytics.
 */
@RestController
@RequestMapping("/api/portfolio")
@CrossOrigin
public class PortfolioController {

    private final PortfolioAccountService accountService;

    public PortfolioController(PortfolioAccountService accountService) {
        this.accountService = accountService;
    }

    /**
     * Get all connected/available brokerage account summaries.
     */
    @GetMapping("/accounts")
    public List<AccountSummary> getAccounts() {
        return accountService.getAllAccounts();
    }

    /**
     * Get account summary for a specific account ID or "ALL" for aggregated view.
     */
    @GetMapping("/account")
    public AccountSummary getAccountSummary(@RequestParam(required = false, defaultValue = "ALL") String accountId) {
        return accountService.getAccountSummary(accountId);
    }
}
