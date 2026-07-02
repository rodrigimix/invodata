package pt.rodrigimix.invodata.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record AdminStatsResponse(
    long totalUsers,
    long totalInvoices,
    long uploadedInvoices,
    long manualInvoices,
    long totalAccounts,
    long totalIssuers,
    List<AdminMonthlyCount> usersMonthly,
    List<AdminMonthlyCount> invoicesMonthly,
    LocalDateTime generatedAt) {
}
