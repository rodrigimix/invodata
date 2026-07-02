package pt.rodrigimix.invodata.dto;

public record BudgetStatusDTO (
        String category,
        Double monthlyLimit,
        Double currentSpending,
        Double remaining,
        Double percentageUsed ) {
}
