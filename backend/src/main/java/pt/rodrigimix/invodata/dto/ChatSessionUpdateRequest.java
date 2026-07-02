package pt.rodrigimix.invodata.dto;

import jakarta.validation.constraints.NotBlank;

public record ChatSessionUpdateRequest(
    @NotBlank String title) {
}