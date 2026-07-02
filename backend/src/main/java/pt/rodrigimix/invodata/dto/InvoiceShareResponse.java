package pt.rodrigimix.invodata.dto;

import java.time.LocalDateTime;

public record InvoiceShareResponse(
        Long id,
        String type,
        String sharedWith,
        String token,
        LocalDateTime createdAt,
        LocalDateTime expiresAt) {
}
