package pt.rodrigimix.invodata.dto;

import java.time.LocalDateTime;

public record AdminUserResponse(
        Long id,
        String username,
        String name,
        String email,
        LocalDateTime createdAt) {
}
