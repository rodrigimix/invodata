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
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.BudgetRepository;
import pt.rodrigimix.invodata.repository.InvoiceRepository;
import pt.rodrigimix.invodata.repository.UserRepository;

import java.util.List;
import java.util.Optional;

@Service
public class BudgetService {

        private static final Logger logger = LoggerFactory.getLogger(BudgetService.class);

        private final BudgetRepository budgetRepository;
        private final InvoiceRepository invoiceRepository;
        private final UserRepository userRepository;

        @Autowired
        public BudgetService(BudgetRepository budgetRepository, InvoiceRepository invoiceRepository,
                        UserRepository userRepository) {
                this.budgetRepository = budgetRepository;
                this.invoiceRepository = invoiceRepository;
                this.userRepository = userRepository;
        }

        public Budget saveBudget(Budget budget, User user) {
                logger.debug("Attempting to save budget for category: {}, month: {}, year: {}",
                                budget.getCategory(), budget.getMonth(), budget.getYear());

                budget.setUser(user);

                Budget existing = findBudget(user, budget.getCategory(), budget.getMonth(), budget.getYear())
                                .orElse(null);
                if (existing != null) {
                        logger.debug("Found existing budget with ID: {}. Updating monthly limit from {} to {}",
                                        existing.getId(), existing.getMonthlyLimit(), budget.getMonthlyLimit());
                        existing.setMonthlyLimit(budget.getMonthlyLimit());
                        Budget saved = budgetRepository.save(existing);
                        logger.info("Successfully updated budget for category: {}, month: {}, year: {}",
                                        budget.getCategory(), budget.getMonth(), budget.getYear());
                        return saved;
                }
                logger.debug("No existing budget found. Creating new budget for category: {}",
                                budget.getCategory());
                Budget saved = budgetRepository.save(budget);
                logger.info("Successfully created new budget with ID: {} for category: {}, month: {}, year: {}",
                                saved.getId(), budget.getCategory(), budget.getMonth(), budget.getYear());
                return saved;
        }

        public Budget updateBudget(String category, int month, int year, BudgetUpdateRequest request, User user) {
                Budget budget = findBudget(user, category, month, year)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Budget not found."));

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

        public void deleteBudget(String category, int month, int year, User user) {
                Budget budget = findBudget(user, category, month, year)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Budget not found."));
                budgetRepository.delete(budget);
        }

        public List<Budget> getAllBudgets(User user) {
                return budgetRepository.findByUser(user);
        }

        public BudgetStatusDTO calculateStatus(String category, int month, int year, User user) {
                logger.debug("Calculating budget status for category: {}, month: {}, year: {}", category, month, year);

                Budget budget = findBudget(user, category, month, year)
                                .orElseThrow(() -> {
                                        logger.error("Budget not found for category: {}, month: {}, year: {}", category,
                                                        month, year);
                                        return new IllegalArgumentException(
                                                        "Budget not found for category: " + category + " and month: "
                                                                        + month + " and year: " + year);
                                });

                logger.trace("Found budget with monthly limit: {}", budget.getMonthlyLimit());

                List<Invoice> invoices = invoiceRepository.findByUser(user);
                double totalSpent = invoices.stream()
                                .filter(invoice -> invoice.getCategory() != null
                                                && invoice.getCategory().equalsIgnoreCase(category))
                                .filter(invoice -> invoice.getDate() != null
                                                && invoice.getDate().getMonthValue() == month
                                                && invoice.getDate().getYear() == year)
                                .filter(invoice -> !invoice.isRevenue())
                                .map(Invoice::getTotalAmount)
                                .filter(value -> value != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();

                logger.debug("Total spent for category {}: {}", category, totalSpent);

                Double remainingBudget = budget.getMonthlyLimit() - totalSpent;
                Double percentage = (remainingBudget / budget.getMonthlyLimit()) * 100;

                logger.info("Budget status calculated for category: {} - Limit: {}, Spent: {}, Remaining: {}, Percentage: {}%",
                                category, budget.getMonthlyLimit(), totalSpent, remainingBudget, percentage);

                return new BudgetStatusDTO(category, budget.getMonthlyLimit(), totalSpent, remainingBudget, percentage);
        }

        private Optional<Budget> findBudget(User user, String category, int month, int year) {
                return budgetRepository.findByUser(user).stream()
                                .filter(budget -> budget.getCategory() != null
                                                && budget.getCategory().equalsIgnoreCase(category))
                                .filter(budget -> budget.getMonth() != null && budget.getMonth() == month)
                                .filter(budget -> budget.getYear() != null && budget.getYear() == year)
                                .findFirst();
        }
}
