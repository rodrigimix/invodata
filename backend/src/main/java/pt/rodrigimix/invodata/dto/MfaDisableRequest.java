package pt.rodrigimix.invodata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record MfaDisableRequest(
    @NotBlank @Size(min = 8, max = 128) String password,
    @NotBlank @Pattern(regexp = "^\\d{6}$", message = "MFA code must be 6 digits") String code) {
}
