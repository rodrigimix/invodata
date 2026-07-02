package pt.rodrigimix.invodata.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.dto.BudgetUpdateRequest;
import pt.rodrigimix.invodata.dto.BudgetStatusDTO;
import pt.rodrigimix.invodata.model.Budget;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.budget.BudgetService;
import pt.rodrigimix.invodata.service.user.UserService;

import java.security.Principal;

@RestController
@RequestMapping("/api/budgets")
@CrossOrigin("*")
public class BudgetController {

    private static final Logger logger = LoggerFactory.getLogger(BudgetController.class);

    private final BudgetService budgetService;
    private final UserService userService;

    @Autowired
    public BudgetController(BudgetService budgetService, UserService userService) {
        this.budgetService = budgetService;
        this.userService = userService;
    }

    @PostMapping
    public ResponseEntity<Budget> createBudget(@RequestBody Budget budget, Principal principal) {
        logger.debug("Received request to create budget for category: {}, month: {}, year: {}",
                budget.getCategory(), budget.getMonth(), budget.getYear());
        User user = userService.getUserFromUsername(principal.getName());
        Budget savedBudget = budgetService.saveBudget(budget, user);
        logger.info("Successfully created/updated budget with ID: {}", savedBudget.getId());
        return ResponseEntity.ok(savedBudget);
    }

    @GetMapping
    public ResponseEntity<java.util.List<Budget>> getBudgets(Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(budgetService.getAllBudgets(user));
    }

    @PutMapping
    public ResponseEntity<Budget> updateBudget(@RequestParam String category,
            @RequestParam int month,
            @RequestParam int year,
            @RequestBody BudgetUpdateRequest request,
            Principal principal) {
        logger.debug("Received request to update budget for category: {}, month: {}, year: {}",
                category, month, year);
        User user = userService.getUserFromUsername(principal.getName());
        Budget updated = budgetService.updateBudget(category, month, year, request, user);
        logger.info("Successfully updated budget for category: {}, month: {}, year: {}",
                updated.getCategory(), updated.getMonth(), updated.getYear());
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteBudget(@RequestParam String category,
            @RequestParam int month,
            @RequestParam int year,
            Principal principal) {
        logger.debug("Received request to delete budget for category: {}, month: {}, year: {}",
                category, month, year);
        User user = userService.getUserFromUsername(principal.getName());
        budgetService.deleteBudget(category, month, year, user);
        logger.info("Successfully deleted budget for category: {}, month: {}, year: {}",
                category, month, year);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/status")
    public ResponseEntity<BudgetStatusDTO> calculateStatus(@RequestParam String category, @RequestParam int month,
            @RequestParam int year, Principal principal) {
        logger.debug("Received request to calculate budget status for category: {}, month: {}, year: {}",
                category, month, year);
        User user = userService.getUserFromUsername(principal.getName());
        BudgetStatusDTO status = budgetService.calculateStatus(category, month, year, user);
        logger.info("Successfully calculated budget status for category: {}", category);
        return ResponseEntity.ok(status);
    }
}
