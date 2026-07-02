package pt.rodrigimix.invodata.dto;

public record InvoiceUploadUsageResponse(long used, int limit, long remaining, int month, int year) {
}