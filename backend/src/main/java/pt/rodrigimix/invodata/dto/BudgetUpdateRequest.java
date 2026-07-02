package pt.rodrigimix.invodata.dto;

public record BudgetUpdateRequest(
        String category,
        Double monthlyLimit,
        Integer month,
        Integer year
) {}
