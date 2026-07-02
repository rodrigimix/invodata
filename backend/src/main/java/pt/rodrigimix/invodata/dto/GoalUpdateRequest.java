package pt.rodrigimix.invodata.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record GoalUpdateRequest(
        String name,
        BigDecimal targetAmount,
        BigDecimal currentAmount,
        LocalDate deadline,
        Long linkedAccountId,
        Boolean clearLinkedAccount
) {}
