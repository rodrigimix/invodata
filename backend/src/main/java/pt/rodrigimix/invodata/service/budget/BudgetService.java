package pt.rodrigimix.invodata.service.budget;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.dto.BudgetStatusDTO;
import pt.rodrigimix.invodata.dto.BudgetUpdateRequest;
import pt.rodrigimix.invodata.model.Budget;
import pt.rodrigimix.invodata.repository.BudgetRepository;
import pt.rodrigimix.invodata.repository.InvoiceRepository;

import java.util.List;

@Service
public class BudgetService {

    private static final Logger logger = LoggerFactory.getLogger(BudgetService.class);

    private final BudgetRepository budgetRepository;
    private final InvoiceRepository invoiceRepository;

    @Autowired
    public BudgetService(BudgetRepository budgetRepository, InvoiceRepository invoiceRepository) {
        this.budgetRepository = budgetRepository;
        this.invoiceRepository = invoiceRepository;
    }

    public Budget saveBudget(Budget budget) {
        logger.debug("Attempting to save budget for category: {}, month: {}, year: {}",
                budget.getCategory(), budget.getMonth(), budget.getYear());

        return budgetRepository.findByCategoryIgnoreCaseAndMonthAndYear(budget.getCategory(), budget.getMonth(), budget.getYear())
                .map(existing -> {
                    logger.debug("Found existing budget with ID: {}. Updating monthly limit from {} to {}",
                            existing.getId(), existing.getMonthlyLimit(), budget.getMonthlyLimit());
                    existing.setMonthlyLimit(budget.getMonthlyLimit());
                    Budget saved = budgetRepository.save(existing);
                    logger.info("Successfully updated budget for category: {}, month: {}, year: {}",
                            budget.getCategory(), budget.getMonth(), budget.getYear());
                    return saved;
                })
                .orElseGet(() -> {
                    logger.debug("No existing budget found. Creating new budget for category: {}", budget.getCategory());
                    Budget saved = budgetRepository.save(budget);
                    logger.info("Successfully created new budget with ID: {} for category: {}, month: {}, year: {}",
                            saved.getId(), budget.getCategory(), budget.getMonth(), budget.getYear());
                    return saved;
                });
    }

    public Budget updateBudget(String category, int month, int year, BudgetUpdateRequest request) {
        Budget budget = budgetRepository.findByCategoryIgnoreCaseAndMonthAndYear(category, month, year)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Budget not found."));

        if (request.category() != null) {
            budget.setCategory(request.category());
        }
        if (request.month() != null) {
            budget.setMonth(request.month());
        }
        if (request.year() != null) {
            budget.setYear(request.year());
        }
        if (request.monthlyLimit() != null) {
            budget.setMonthlyLimit(request.monthlyLimit());
        }

        return budgetRepository.save(budget);
    }

    public void deleteBudget(String category, int month, int year) {
        Budget budget = budgetRepository.findByCategoryIgnoreCaseAndMonthAndYear(category, month, year)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Budget not found."));
        budgetRepository.delete(budget);
    }

    public List<Budget> getAllBudgets() {
        return budgetRepository.findAll();
    }

    public BudgetStatusDTO calculateStatus(String category, int month, int year, String username) {
        logger.debug("Calculating budget status for category: {}, month: {}, year: {}", category, month, year);

        Budget budget = budgetRepository.findByCategoryIgnoreCaseAndMonthAndYear(category, month, year)
                .orElseThrow(() -> {
                    logger.error("Budget not found for category: {}, month: {}, year: {}", category, month, year);
                    return new IllegalArgumentException("Budget not found for category: " + category + " and month: " + month + " and year: " + year);
                });

        logger.trace("Found budget with monthly limit: {}", budget.getMonthlyLimit());

        Double totalSpent = invoiceRepository.sumByCategoryAndMonthIgnoreCase(category, month, year, username);

        if (totalSpent == null) {
            logger.trace("No spending found for category: {}. Setting total spent to 0.0", category);
            totalSpent = 0.0;
        }

        logger.debug("Total spent for category {}: {}", category, totalSpent);

        Double remainingBudget = budget.getMonthlyLimit() - totalSpent;
        Double percentage = (remainingBudget / budget.getMonthlyLimit()) * 100;

        logger.info("Budget status calculated for category: {} - Limit: {}, Spent: {}, Remaining: {}, Percentage: {}%",
                category, budget.getMonthlyLimit(), totalSpent, remainingBudget, percentage);

        return new BudgetStatusDTO(category, budget.getMonthlyLimit(), totalSpent, remainingBudget, percentage);
    }
}
