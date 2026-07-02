package pt.rodrigimix.invodata.dto;

public record ChatInvoiceFilter(
    String search,
    String period,
    String startDate,
    String endDate,
    String category,
    String paymentMethod) {
}