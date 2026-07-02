package pt.rodrigimix.invodata.dto;

import java.time.LocalDateTime;

public record ChatSessionListItem(
    String id,
    String title,
    LocalDateTime createdAt,
    LocalDateTime lastActivityAt) {
}