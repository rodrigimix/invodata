package pt.rodrigimix.invodata.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "chat_summaries")
public class ChatSummary {
    @Id
    private String id;
    private String sessionId;
    private String period;
    private String summary;
    private LocalDateTime createdAt;
}
