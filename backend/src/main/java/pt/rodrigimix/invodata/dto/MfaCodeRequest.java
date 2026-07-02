package pt.rodrigimix.invodata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record MfaCodeRequest(
    @NotBlank @Pattern(regexp = "^\\d{6}$", message = "MFA code must be 6 digits") String code) {
}
