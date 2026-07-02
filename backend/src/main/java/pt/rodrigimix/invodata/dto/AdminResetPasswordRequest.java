package pt.rodrigimix.invodata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminResetPasswordRequest(
        @NotBlank String username,
        @NotBlank @Size(min = 8, max = 128) String newPassword) {
}
