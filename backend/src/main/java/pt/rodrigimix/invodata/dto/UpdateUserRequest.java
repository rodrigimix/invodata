package pt.rodrigimix.invodata.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
                @Size(min = 3, max = 50) String username,
                String name,
                @Email String email,
                String taxId,
                @Pattern(regexp = "^(en|pt)$") String language,
                String currentPassword,
                @Size(min = 8, max = 128) String newPassword) {
}
