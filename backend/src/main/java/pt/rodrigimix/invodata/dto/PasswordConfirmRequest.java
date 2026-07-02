package pt.rodrigimix.invodata.dto;

import jakarta.validation.constraints.NotBlank;

public record PasswordConfirmRequest(
    @NotBlank String password) {
}
