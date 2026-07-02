package pt.rodrigimix.invodata.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Data
@Document(collection = "chat_history")
public class ChatMessage {
    @Id
    private String id;
    private String sessionId;
    private String username;
    private String role;
    private String content;
    private LocalDateTime timestamp;

}
