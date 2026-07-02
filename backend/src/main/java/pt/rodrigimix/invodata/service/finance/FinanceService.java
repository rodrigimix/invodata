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
import java.time.YearMonth;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
                List<Invoice> invoices = getInvoicesForUser(username);
                Map<String, Double> totals = invoices.stream()
                                .filter(inv -> inv.getDate() != null
                                                && inv.getDate().getMonthValue() == month
                                                && inv.getDate().getYear() == year)
                                .filter(inv -> inv.getCategory() != null)
                                .collect(Collectors.groupingBy(Invoice::getCategory,
                                                Collectors.summingDouble(inv -> inv.getTotalAmount() != null
                                                                ? inv.getTotalAmount()
                                                                : 0.0)));
                StringBuilder sb = new StringBuilder("User spending for " + month + "/" + year + ":\n");
                totals.forEach((cat, amount) -> sb.append("- ").append(cat).append(": ")
                                .append(amount).append(" EUR\n"));
                return sb.toString();
        }

        public List<Map<String, Object>> getCategoryChartData(int month, int year, String username) {
                List<Invoice> invoices = getInvoicesForUser(username);
                Map<String, Double> totals = invoices.stream()
                                .filter(inv -> inv.getDate() != null
                                                && inv.getDate().getMonthValue() == month
                                                && inv.getDate().getYear() == year)
                                .filter(inv -> !inv.isRevenue())
                                .filter(inv -> inv.getCategory() != null)
                                .collect(Collectors.groupingBy(Invoice::getCategory,
                                                Collectors.summingDouble(inv -> inv.getTotalAmount() != null
                                                                ? inv.getTotalAmount()
                                                                : 0.0)));
                return totals.entrySet().stream()
                                .map(entry -> Map.<String, Object>of(
                                                "name", entry.getKey(),
                                                "value", entry.getValue()))
                                .collect(Collectors.toList());
        }

        public List<Map<String, Object>> getCategoryChartDataForYear(int year, String username) {
                List<Invoice> invoices = getInvoicesForUser(username);
                Map<String, Double> totals = invoices.stream()
                                .filter(inv -> inv.getDate() != null && inv.getDate().getYear() == year)
                                .filter(inv -> !inv.isRevenue())
                                .filter(inv -> inv.getCategory() != null)
                                .collect(Collectors.groupingBy(Invoice::getCategory,
                                                Collectors.summingDouble(inv -> inv.getTotalAmount() != null
                                                                ? inv.getTotalAmount()
                                                                : 0.0)));
                return totals.entrySet().stream()
                                .map(entry -> Map.<String, Object>of(
                                                "name", entry.getKey(),
                                                "value", entry.getValue()))
                                .collect(Collectors.toList());
        }

        public List<Map<String, Object>> getEvolutionChartData(String username) {
                List<Invoice> invoices = getInvoicesForUser(username);
                YearMonth current = YearMonth.now();
                Map<String, Double> totals = new LinkedHashMap<>();
                for (int i = 5; i >= 0; i--) {
                        YearMonth month = current.minusMonths(i);
                        totals.put(month.toString(), 0.0);
                }
                invoices.stream()
                                .filter(inv -> inv.getDate() != null)
                                .forEach(inv -> {
                                        String key = YearMonth.from(inv.getDate()).toString();
                                        if (totals.containsKey(key)) {
                                                double value = inv.getTotalAmount() != null ? inv.getTotalAmount()
                                                                : 0.0;
                                                totals.put(key, totals.get(key) + value);
                                        }
                                });
                return totals.entrySet().stream()
                                .map(entry -> Map.<String, Object>of(
                                                "month", entry.getKey(),
                                                "total", entry.getValue()))
                                .collect(Collectors.toList());
        }

        public List<Map<String, Object>> getEvolutionChartDetailedData(String username) {
                List<Invoice> invoices = getInvoicesForUser(username);
                YearMonth current = YearMonth.now();
                Map<String, double[]> totals = new LinkedHashMap<>();
                for (int i = 5; i >= 0; i--) {
                        YearMonth month = current.minusMonths(i);
                        totals.put(month.toString(), new double[] { 0.0, 0.0 });
                }
                invoices.stream()
                                .filter(inv -> inv.getDate() != null)
                                .forEach(inv -> {
                                        String key = YearMonth.from(inv.getDate()).toString();
                                        if (totals.containsKey(key)) {
                                                double value = inv.getTotalAmount() != null ? inv.getTotalAmount()
                                                                : 0.0;
                                                if (inv.isRevenue()) {
                                                        totals.get(key)[0] += value;
                                                } else {
                                                        totals.get(key)[1] += value;
                                                }
                                        }
                                });
                return totals.entrySet().stream()
                                .map(entry -> Map.<String, Object>of(
                                                "month", entry.getKey(),
                                                "revenue", entry.getValue()[0],
                                                "expense", entry.getValue()[1]))
                                .collect(Collectors.toList());
        }

        public Map<String, Object> getEmergencyFund(int targetMonths, User user) {
                List<Invoice> invoices = invoiceRepository.findByUser(user);
                Map<YearMonth, Double> monthTotals = new HashMap<>();
                invoices.stream()
                                .filter(inv -> inv.getDate() != null
                                                && inv.getCategory() != null)
                                .filter(inv -> ESSENTIALS_CATEGORIES.contains(inv.getCategory()))
                                .filter(inv -> !inv.isRevenue())
                                .forEach(inv -> {
                                        YearMonth ym = YearMonth.from(inv.getDate());
                                        double value = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0.0;
                                        monthTotals.merge(ym, value,
                                                        (a, b) -> (a == null ? 0.0 : a) + (b == null ? 0.0 : b));
                                });
                double avgSpending = monthTotals.isEmpty()
                                ? 0.0
                                : monthTotals.values().stream().mapToDouble(Double::doubleValue).average().orElse(0.0);

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
                List<Invoice> invoices = getInvoicesForUser(username);
                double totalRevenue = invoices.stream()
                                .filter(inv -> inv.getDate() != null
                                                && inv.getDate().getMonthValue() == month
                                                && inv.getDate().getYear() == year)
                                .filter(Invoice::isRevenue)
                                .map(Invoice::getTotalAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();
                double totalExpense = invoices.stream()
                                .filter(inv -> inv.getDate() != null
                                                && inv.getDate().getMonthValue() == month
                                                && inv.getDate().getYear() == year)
                                .filter(inv -> !inv.isRevenue())
                                .map(Invoice::getTotalAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();
                double netRevenue = invoices.stream()
                                .filter(inv -> inv.getDate() != null
                                                && inv.getDate().getMonthValue() == month
                                                && inv.getDate().getYear() == year)
                                .filter(Invoice::isRevenue)
                                .map(Invoice::getNetAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();
                double netExpense = invoices.stream()
                                .filter(inv -> inv.getDate() != null
                                                && inv.getDate().getMonthValue() == month
                                                && inv.getDate().getYear() == year)
                                .filter(inv -> !inv.isRevenue())
                                .map(Invoice::getNetAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();

                BigDecimal revenue = BigDecimal.valueOf(totalRevenue);
                BigDecimal expense = BigDecimal.valueOf(totalExpense);
                BigDecimal netRevenueBD = BigDecimal.valueOf(netRevenue);
                BigDecimal netExpenseBD = BigDecimal.valueOf(netExpense);

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
                                "totalNetRevenue", netRevenueBD,
                                "totalNetExpense", netExpenseBD,
                                "savingsAmount", savings,
                                "savingsRate", Math.max(0, savingsRate) // Do not show negative rate when expenses
                                                                        // exceed revenue
                );
        }

        public Map<String, Object> getSavingsRateForYear(int year, String username) {
                List<Invoice> invoices = getInvoicesForUser(username);
                double totalRevenue = invoices.stream()
                                .filter(inv -> inv.getDate() != null && inv.getDate().getYear() == year)
                                .filter(Invoice::isRevenue)
                                .map(Invoice::getTotalAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();
                double totalExpense = invoices.stream()
                                .filter(inv -> inv.getDate() != null && inv.getDate().getYear() == year)
                                .filter(inv -> !inv.isRevenue())
                                .map(Invoice::getTotalAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();
                double netRevenue = invoices.stream()
                                .filter(inv -> inv.getDate() != null && inv.getDate().getYear() == year)
                                .filter(Invoice::isRevenue)
                                .map(Invoice::getNetAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();
                double netExpense = invoices.stream()
                                .filter(inv -> inv.getDate() != null && inv.getDate().getYear() == year)
                                .filter(inv -> !inv.isRevenue())
                                .map(Invoice::getNetAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();

                BigDecimal revenue = BigDecimal.valueOf(totalRevenue);
                BigDecimal expense = BigDecimal.valueOf(totalExpense);
                BigDecimal netRevenueBD = BigDecimal.valueOf(netRevenue);
                BigDecimal netExpenseBD = BigDecimal.valueOf(netExpense);

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
                                "totalNetRevenue", netRevenueBD,
                                "totalNetExpense", netExpenseBD,
                                "savingsAmount", savings,
                                "savingsRate", Math.max(0, savingsRate));
        }

        public Map<String, Object> getMonthlyComparison(String username) {
                LocalDate now = LocalDate.now();
                LocalDate lastMonthDate = now.minusMonths(1);

                List<Invoice> invoices = getInvoicesForUser(username);
                double currentMonth = invoices.stream()
                                .filter(inv -> inv.getDate() != null
                                                && inv.getDate().getMonthValue() == now.getMonthValue()
                                                && inv.getDate().getYear() == now.getYear())
                                .filter(inv -> !inv.isRevenue())
                                .map(Invoice::getTotalAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();
                double previousMonth = invoices.stream()
                                .filter(inv -> inv.getDate() != null
                                                && inv.getDate().getMonthValue() == lastMonthDate.getMonthValue()
                                                && inv.getDate().getYear() == lastMonthDate.getYear())
                                .filter(inv -> !inv.isRevenue())
                                .map(Invoice::getTotalAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();

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
                List<Invoice> invoices = getInvoicesForUser(username);
                double totalRevenue = invoices.stream()
                                .filter(Invoice::isRevenue)
                                .map(Invoice::getTotalAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();
                double totalSpent = invoices.stream()
                                .filter(inv -> !inv.isRevenue())
                                .map(Invoice::getTotalAmount)
                                .filter(val -> val != null)
                                .mapToDouble(Double::doubleValue)
                                .sum();
                double savingsRate = 0.0;
                if (totalRevenue > 0) {
                        savingsRate = (totalRevenue - totalSpent) / totalRevenue;
                }
                Map<String, Double> categoryTotals = invoices.stream()
                                .filter(inv -> !inv.isRevenue())
                                .filter(inv -> inv.getCategory() != null)
                                .collect(Collectors.groupingBy(Invoice::getCategory,
                                                Collectors.summingDouble(inv -> inv.getTotalAmount() != null
                                                                ? inv.getTotalAmount()
                                                                : 0.0)));
                List<FinanceSnapshot.TopCategory> topCategoryDtos = categoryTotals.entrySet().stream()
                                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                                .limit(8)
                                .map(entry -> new FinanceSnapshot.TopCategory(
                                                entry.getKey(),
                                                entry.getValue(),
                                                totalSpent > 0 ? entry.getValue() / totalSpent : 0.0))
                                .collect(Collectors.toList());

                Map<String, double[]> monthlyTotals = new LinkedHashMap<>();
                invoices.stream()
                                .filter(inv -> inv.getDate() != null)
                                .forEach(inv -> {
                                        String key = YearMonth.from(inv.getDate()).toString();
                                        monthlyTotals.putIfAbsent(key, new double[] { 0.0, 0.0 });
                                        double value = inv.getTotalAmount() != null ? inv.getTotalAmount() : 0.0;
                                        if (inv.isRevenue()) {
                                                monthlyTotals.get(key)[1] += value;
                                        } else {
                                                monthlyTotals.get(key)[0] += value;
                                        }
                                });
                List<FinanceSnapshot.MonthlyTrend> monthlyTrendDtos = monthlyTotals.entrySet().stream()
                                .sorted(Map.Entry.comparingByKey())
                                .map(entry -> new FinanceSnapshot.MonthlyTrend(
                                                entry.getKey(),
                                                entry.getValue()[0],
                                                entry.getValue()[1]))
                                .collect(Collectors.toList());

                Map<String, Double> issuerTotals = invoices.stream()
                                .filter(inv -> !inv.isRevenue())
                                .filter(inv -> inv.getIssuer() != null && inv.getIssuer().getName() != null)
                                .collect(Collectors.groupingBy(inv -> inv.getIssuer().getName(),
                                                Collectors.summingDouble(inv -> inv.getTotalAmount() != null
                                                                ? inv.getTotalAmount()
                                                                : 0.0)));
                List<FinanceSnapshot.TopCompany> topCompanyDtos = issuerTotals.entrySet().stream()
                                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                                .limit(8)
                                .map(entry -> new FinanceSnapshot.TopCompany(
                                                entry.getKey(),
                                                entry.getValue(),
                                                totalSpent > 0 ? entry.getValue() / totalSpent : 0.0))
                                .collect(Collectors.toList());

                List<FinanceSnapshot.TopInvoice> topInvoiceDtos = invoices.stream()
                                .filter(inv -> !inv.isRevenue())
                                .sorted(Comparator.comparing(Invoice::getTotalAmount,
                                                Comparator.nullsLast(Double::compareTo)).reversed())
                                .limit(8)
                                .map(inv -> new FinanceSnapshot.TopInvoice(
                                                inv.getIssuer() != null ? inv.getIssuer().getName() : null,
                                                inv.getCategory(),
                                                inv.getDate() != null ? inv.getDate().toString() : null,
                                                inv.getTotalAmount() != null ? inv.getTotalAmount() : 0.0,
                                                inv.getDocumentNum()))
                                .collect(Collectors.toList());
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
                                                        invoice.getCategory(),
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

        private List<Invoice> getInvoicesForUser(String username) {
                User user = userRepository.findByUsernameIgnoreCase(username)
                                .orElseThrow(() -> new RuntimeException("User not found"));
                return invoiceRepository.findByUser(user);
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
