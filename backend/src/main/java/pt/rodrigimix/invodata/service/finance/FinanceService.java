package pt.rodrigimix.invodata.service.finance;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.Item;
import pt.rodrigimix.invodata.model.Goal;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.AccountRepository;
import pt.rodrigimix.invodata.repository.GoalRepository;
import pt.rodrigimix.invodata.repository.InvoiceRepository;
import pt.rodrigimix.invodata.repository.UserRepository;
import pt.rodrigimix.invodata.dto.FinanceSnapshot;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class FinanceService {

        private final InvoiceRepository invoiceRepository;

        private final AccountRepository accountRepository;

        private final GoalRepository goalRepository;

        private final UserRepository userRepository;

        @Autowired
        public FinanceService(InvoiceRepository invoiceRepository,
                        AccountRepository accountRepository,
                        GoalRepository goalRepository,
                        UserRepository userRepository) {
                this.invoiceRepository = invoiceRepository;
                this.accountRepository = accountRepository;
                this.goalRepository = goalRepository;
                this.userRepository = userRepository;
        }

        private static final List<String> ESSENTIALS_CATEGORIES = List.of("SUPERMARKET", "UTILITIES", "HEALTH",
                        "TRANSPORT",
                        "HOUSING");

        public String getSpendingSummary(int month, int year, String username) {
                List<Object[]> report = invoiceRepository.getSpendingReportIgnoreCase(month, year, username);
                StringBuilder sb = new StringBuilder("User spending for " + month + "/" + year + ":\n");
                for (Object[] row : report) {
                        sb.append("- ").append(row[0]).append(": ").append(row[1]).append(" EUR\n");
                }
                return sb.toString();
        }

        public List<Map<String, Object>> getCategoryChartData(int month, int year, String username) {
                return invoiceRepository.getCategorySpendingIgnoreCase(month, year, username);
        }

        public List<Map<String, Object>> getCategoryChartDataForYear(int year, String username) {
                return invoiceRepository.getCategorySpendingByYearIgnoreCase(year, username);
        }

        public List<Map<String, Object>> getEvolutionChartData(String username) {
                return invoiceRepository.getMonthlyEvolutionIgnoreCase(username);
        }

        public List<Map<String, Object>> getEvolutionChartDetailedData(String username) {
                return invoiceRepository.getMonthlyEvolutionDetailed(username);
        }

        public Map<String, Object> getEmergencyFund(int targetMonths, User user) {
                Double avgSpending = invoiceRepository.getAverageSpendingForCategoriesIgnoreCase(
                                ESSENTIALS_CATEGORIES,
                                user.getUsername());

                if (avgSpending == null)
                        avgSpending = 0.0;

                BigDecimal targetAmount = BigDecimal.valueOf(avgSpending * targetMonths);

                BigDecimal currentSaved = accountRepository.findByUser(user)
                                .stream()
                                .filter(Account::getIsEmergencyFund)
                                .map(Account::getBalance)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                double progress = 0.0;
                if (targetAmount.compareTo(BigDecimal.ZERO) > 0) {
                        progress = currentSaved.doubleValue() / targetAmount.doubleValue() * 100;
                }

                return Map.of(
                                "targetAmount", targetAmount,
                                "currentSaved", currentSaved,
                                "progressPercentage", Math.min(progress, 100.0),
                                "monthsCovered", targetMonths,
                                "isGoalMet", currentSaved.compareTo(targetAmount) >= 0);
        }

        public Map<String, Object> getSavingsRate(int month, int year, String username) {
                Map<String, Object> totals = invoiceRepository.getMonthlyTotals(month, year, username);

                BigDecimal revenue = totals.get("total_revenue") != null
                                ? new BigDecimal(totals.get("total_revenue").toString())
                                : BigDecimal.ZERO;
                BigDecimal expense = totals.get("total_expense") != null
                                ? new BigDecimal(totals.get("total_expense").toString())
                                : BigDecimal.ZERO;
                BigDecimal netRevenue = totals.get("net_revenue") != null
                                ? new BigDecimal(totals.get("net_revenue").toString())
                                : BigDecimal.ZERO;
                BigDecimal netExpense = totals.get("net_expense") != null
                                ? new BigDecimal(totals.get("net_expense").toString())
                                : BigDecimal.ZERO;

                BigDecimal savings = revenue.subtract(expense);
                double savingsRate = 0.0;

                if (revenue.compareTo(BigDecimal.ZERO) > 0) {
                        savingsRate = savings.divide(revenue, 4, RoundingMode.HALF_UP).doubleValue() * 100;
                }

                return Map.of(
                                "month", month,
                                "year", year,
                                "totalRevenue", revenue,
                                "totalExpense", expense,
                                "totalNetRevenue", netRevenue,
                                "totalNetExpense", netExpense,
                                "savingsAmount", savings,
                                "savingsRate", Math.max(0, savingsRate) // Do not show negative rate when expenses
                                                                        // exceed revenue
                );
        }

        public Map<String, Object> getSavingsRateForYear(int year, String username) {
                Map<String, Object> totals = invoiceRepository.getYearlyTotals(year, username);

                BigDecimal revenue = totals.get("total_revenue") != null
                                ? new BigDecimal(totals.get("total_revenue").toString())
                                : BigDecimal.ZERO;
                BigDecimal expense = totals.get("total_expense") != null
                                ? new BigDecimal(totals.get("total_expense").toString())
                                : BigDecimal.ZERO;
                BigDecimal netRevenue = totals.get("net_revenue") != null
                                ? new BigDecimal(totals.get("net_revenue").toString())
                                : BigDecimal.ZERO;
                BigDecimal netExpense = totals.get("net_expense") != null
                                ? new BigDecimal(totals.get("net_expense").toString())
                                : BigDecimal.ZERO;

                BigDecimal savings = revenue.subtract(expense);
                double savingsRate = 0.0;

                if (revenue.compareTo(BigDecimal.ZERO) > 0) {
                        savingsRate = savings.divide(revenue, 4, RoundingMode.HALF_UP).doubleValue() * 100;
                }

                return Map.of(
                                "month", 0,
                                "year", year,
                                "totalRevenue", revenue,
                                "totalExpense", expense,
                                "totalNetRevenue", netRevenue,
                                "totalNetExpense", netExpense,
                                "savingsAmount", savings,
                                "savingsRate", Math.max(0, savingsRate));
        }

        public Map<String, Object> getMonthlyComparison(String username) {
                LocalDate now = LocalDate.now();
                LocalDate lastMonthDate = now.minusMonths(1);

                Double currentMonth = invoiceRepository.getTotalSpentInMonthIgnoreCase(
                                now.getMonthValue(), now.getYear(), username);
                Double previousMonth = invoiceRepository.getTotalSpentInMonthIgnoreCase(
                                lastMonthDate.getMonthValue(), lastMonthDate.getYear(), username);

                currentMonth = (currentMonth != null) ? currentMonth : 0.0;
                previousMonth = (previousMonth != null) ? previousMonth : 0.0;

                double diffPercentage = 0.0;
                if (previousMonth > 0) {
                        diffPercentage = ((currentMonth - previousMonth) / previousMonth) * 100;
                }

                return Map.of(
                                "currentMonthTotal", currentMonth,
                                "previousMonthTotal", previousMonth,
                                "variationPercentage", diffPercentage);
        }

        public FinanceSnapshot getAllTimeSnapshot(String username) {
                LocalDate startDate = LocalDate.of(1970, 1, 1);

                Map<String, Object> totals = invoiceRepository.getTotalsSince(startDate, username);
                double totalRevenue = toDouble(totals.get("total_revenue"));
                double totalSpent = toDouble(totals.get("total_expense"));
                double savingsRate = 0.0;
                if (totalRevenue > 0) {
                        savingsRate = (totalRevenue - totalSpent) / totalRevenue;
                }

                List<Map<String, Object>> topCategories = invoiceRepository.getTopCategoriesSince(startDate, username);
                List<FinanceSnapshot.TopCategory> topCategoryDtos = topCategories.stream()
                                .map(row -> {
                                        String category = (String) row.get("category");
                                        double amount = toDouble(row.get("amount"));
                                        double percentage = totalSpent > 0 ? amount / totalSpent : 0.0;
                                        return new FinanceSnapshot.TopCategory(category, amount, percentage);
                                })
                                .collect(Collectors.toList());

                List<Map<String, Object>> monthlyTrend = invoiceRepository.getMonthlyTrendSince(startDate, username);
                List<FinanceSnapshot.MonthlyTrend> monthlyTrendDtos = monthlyTrend.stream()
                                .map(row -> new FinanceSnapshot.MonthlyTrend(
                                                (String) row.get("month"),
                                                toDouble(row.get("total_expense")),
                                                toDouble(row.get("total_revenue"))))
                                .collect(Collectors.toList());

                List<Map<String, Object>> topCompanies = invoiceRepository.getTopIssuersSince(startDate, username);
                List<FinanceSnapshot.TopCompany> topCompanyDtos = topCompanies.stream()
                                .map(row -> {
                                        String name = (String) row.get("name");
                                        double amount = toDouble(row.get("amount"));
                                        double percentage = totalSpent > 0 ? amount / totalSpent : 0.0;
                                        return new FinanceSnapshot.TopCompany(name, amount, percentage);
                                })
                                .collect(Collectors.toList());

                List<Map<String, Object>> topInvoices = invoiceRepository.getTopInvoicesSince(startDate, username);
                List<FinanceSnapshot.TopInvoice> topInvoiceDtos = topInvoices.stream()
                                .map(row -> new FinanceSnapshot.TopInvoice(
                                                (String) row.get("issuer_name"),
                                                (String) row.get("category"),
                                                row.get("issue_date").toString(),
                                                toDouble(row.get("total_amount")),
                                                (String) row.get("document_num")))
                                .collect(Collectors.toList());

                List<Invoice> invoices = invoiceRepository.getInvoicesSince(startDate, username);
                List<FinanceSnapshot.InvoiceEntry> invoiceDtos = invoices.stream()
                                .map(invoice -> {
                                        List<FinanceSnapshot.InvoiceItem> itemDtos = Optional
                                                        .ofNullable(invoice.getItems())
                                                        .orElse(List.of())
                                                        .stream()
                                                        .map(this::toInvoiceItem)
                                                        .collect(Collectors.toList());
                                        return new FinanceSnapshot.InvoiceEntry(
                                                        invoice.getIssuer() != null ? invoice.getIssuer().getName()
                                                                        : null,
                                                        invoice.getIssuer() != null ? invoice.getIssuer().getTaxId()
                                                                        : null,
                                                        invoice.getIssuer() != null ? invoice.getIssuer().getCategory()
                                                                        : null,
                                                        invoice.getDate() != null ? invoice.getDate().toString() : null,
                                                        invoice.getDocumentNum(),
                                                        Boolean.TRUE.equals(invoice.isRevenue()),
                                                        toDouble(invoice.getTotalAmount()),
                                                        toDouble(invoice.getTaxAmount()),
                                                        toDouble(invoice.getNetAmount()),
                                                        invoice.getPaymentMethod(),
                                                        invoice.getLicensePlate(),
                                                        invoice.getAccount() != null ? invoice.getAccount().getName()
                                                                        : null,
                                                        itemDtos);
                                })
                                .collect(Collectors.toList());

                User user = userRepository.findByUsernameIgnoreCase(username).orElse(null);
                List<Goal> goals = user != null ? goalRepository.findByUser(user) : List.of();
                List<FinanceSnapshot.GoalEntry> goalDtos = goals.stream()
                                .map(goal -> new FinanceSnapshot.GoalEntry(
                                                goal.getId(),
                                                goal.getName(),
                                                goal.getTargetAmount() != null ? goal.getTargetAmount().doubleValue()
                                                                : null,
                                                goal.getCurrentAmount() != null ? goal.getCurrentAmount().doubleValue()
                                                                : null,
                                                goal.getDeadline() != null ? goal.getDeadline().toString() : null,
                                                goal.getCompleted(),
                                                goal.getLinkedAccount() != null ? goal.getLinkedAccount().getName()
                                                                : null))
                                .collect(Collectors.toList());

                FinanceSnapshot.GlobalStats globalStats = new FinanceSnapshot.GlobalStats(totalSpent, totalRevenue,
                                savingsRate);

                return new FinanceSnapshot(
                                "ALL_TIME",
                                globalStats,
                                topCategoryDtos,
                                monthlyTrendDtos,
                                topCompanyDtos,
                                topInvoiceDtos,
                                invoiceDtos,
                                goalDtos);
        }

        private double toDouble(Object value) {
                if (value == null) {
                        return 0.0;
                }
                if (value instanceof Number number) {
                        return number.doubleValue();
                }
                return Double.parseDouble(value.toString());
        }

        private FinanceSnapshot.InvoiceItem toInvoiceItem(Item item) {
                return new FinanceSnapshot.InvoiceItem(
                                item.getDescription(),
                                item.getQuantity(),
                                item.getUnitPrice(),
                                item.getTotalPrice(),
                                item.getTaxPrice(),
                                item.getTaxPercent());
        }
}
