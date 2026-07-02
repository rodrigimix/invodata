package pt.rodrigimix.invodata.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import pt.rodrigimix.invodata.security.encryption.UserCrypto;

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

    public String getContent() {
        return UserCrypto.decryptString(this.content);
    }

    public String getEncryptedContent() {
        return this.content;
    }

    public void setContent(String content) {
        this.content = UserCrypto.encryptString(content);
    }

}
