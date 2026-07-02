package pt.rodrigimix.invodata.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import pt.rodrigimix.invodata.security.encryption.UserCrypto;

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

    public String getTitle() {
        return UserCrypto.decryptString(this.title);
    }

    public String getEncryptedTitle() {
        return this.title;
    }

    public void setTitle(String title) {
        this.title = UserCrypto.encryptString(title);
    }
}
