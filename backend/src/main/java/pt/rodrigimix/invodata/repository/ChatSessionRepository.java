package pt.rodrigimix.invodata.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import pt.rodrigimix.invodata.model.ChatSession;

public interface ChatSessionRepository extends MongoRepository<ChatSession, String> {
    java.util.List<ChatSession> findByUsernameIgnoreCase(String username);

    java.util.List<ChatSession> findByUsernameIgnoreCaseOrderByLastActivityAtDesc(String username);

    void deleteByUsernameIgnoreCase(String username);
}
