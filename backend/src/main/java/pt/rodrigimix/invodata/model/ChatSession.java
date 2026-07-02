package pt.rodrigimix.invodata.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "chat_sessions")
public class ChatSession {
    @Id
    private String id;
    private String username;
    private String title;
    private LocalDateTime createdAt;
    private LocalDateTime lastActivityAt;
}
