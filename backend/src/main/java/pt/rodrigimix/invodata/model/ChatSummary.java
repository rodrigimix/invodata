package pt.rodrigimix.invodata.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import pt.rodrigimix.invodata.security.encryption.UserCrypto;

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

    public String getSummary() {
        return UserCrypto.decryptString(this.summary);
    }

    public String getEncryptedSummary() {
        return this.summary;
    }

    public void setSummary(String summary) {
        this.summary = UserCrypto.encryptString(summary);
    }
}
