package pt.rodrigimix.invodata.dto;

import java.time.LocalDateTime;

public record ChatMessageResponse(String role, String content, LocalDateTime timestamp) {
}
