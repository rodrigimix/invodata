package pt.rodrigimix.invodata.dto;

import java.math.BigDecimal;

public record AccountUpdateRequest(
        String name,
        String type,
        String currency,
        Boolean isEmergencyFund,
        Boolean active,
        BigDecimal balance,
        String last4
) {}
