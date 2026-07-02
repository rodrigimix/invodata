package pt.rodrigimix.invodata.dto;

public record ChatSessionAiAction(
        String type,
        String name,
        String accountType,
        String currency,
        Double balance,
        String last4,
        Boolean isEmergencyFund,
        Double targetAmount,
        Double currentAmount,
        String deadline,
        String linkedAccountName,
        String category,
        Double monthlyLimit,
        Integer month,
        Integer year
) {
}