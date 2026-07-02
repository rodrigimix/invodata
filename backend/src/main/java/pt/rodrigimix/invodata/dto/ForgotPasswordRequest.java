package pt.rodrigimix.invodata.dto;

import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest(
    @NotBlank String identifier) {
}
