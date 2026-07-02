package pt.rodrigimix.invodata.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;

public record RegisterRequest(
        @NotBlank @Size(min = 3, max = 50) String username,
        @NotBlank @Size(min = 8, max = 128) String password,
        @NotBlank @Email String email,
        @NotBlank String name,
        String taxId,
        Boolean aiConsent,
        @AssertTrue(message = "Privacy policy consent is required.") Boolean privacyConsent) {
}
