package pt.rodrigimix.invodata.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record FinanceSnapshot(
                String period,
                @JsonProperty("global_stats") GlobalStats globalStats,
                @JsonProperty("top_categories") List<TopCategory> topCategories,
                @JsonProperty("monthly_trend") List<MonthlyTrend> monthlyTrend,
                @JsonProperty("top_companies") List<TopCompany> topCompanies,
                @JsonProperty("top_invoices") List<TopInvoice> topInvoices,
                @JsonProperty("invoices") List<InvoiceEntry> invoices,
                @JsonProperty("goals") List<GoalEntry> goals) {
        public record GlobalStats(
                        @JsonProperty("total_spent") double totalSpent,
                        @JsonProperty("total_revenue") double totalRevenue,
                        @JsonProperty("savings_rate") double savingsRate) {
        }

        public record TopCategory(
                        String category,
                        double amount,
                        double percentage) {
        }

        public record MonthlyTrend(
                        String month,
                        @JsonProperty("total_expense") double totalExpense,
                        @JsonProperty("total_revenue") double totalRevenue) {
        }

        public record TopCompany(
                        String name,
                        double amount,
                        double percentage) {
        }

        public record TopInvoice(
                        @JsonProperty("issuer_name") String issuerName,
                        String category,
                        @JsonProperty("issue_date") String issueDate,
                        @JsonProperty("total_amount") double totalAmount,
                        @JsonProperty("document_num") String documentNum) {
        }

        public record InvoiceEntry(
                        @JsonProperty("issuer_name") String issuerName,
                        @JsonProperty("issuer_tax_id") String issuerTaxId,
                        String category,
                        @JsonProperty("issue_date") String issueDate,
                        @JsonProperty("document_num") String documentNum,
                        boolean revenue,
                        @JsonProperty("total_amount") double totalAmount,
                        @JsonProperty("tax_amount") double taxAmount,
                        @JsonProperty("net_amount") double netAmount,
                        @JsonProperty("payment_method") String paymentMethod,
                        @JsonProperty("license_plate") String licensePlate,
                        @JsonProperty("account_name") String accountName,
                        List<InvoiceItem> items) {
        }

        public record InvoiceItem(
                        String description,
                        Double quantity,
                        Double unitPrice,
                        Double totalPrice,
                        Double taxPrice,
                        Double taxPercent) {
        }

        public record GoalEntry(
                        Long id,
                        String name,
                        @JsonProperty("target_amount") Double targetAmount,
                        @JsonProperty("current_amount") Double currentAmount,
                        String deadline,
                        Boolean completed,
                        @JsonProperty("linked_account") String linkedAccount) {
        }
}
