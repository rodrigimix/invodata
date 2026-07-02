package pt.rodrigimix.invodata.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import pt.rodrigimix.invodata.model.ChatMessage;

import java.util.List;

public interface ChatRepository extends MongoRepository<ChatMessage, String> {
    List<ChatMessage> findTop20ByUsernameOrderByTimestampAsc(String username);

    List<ChatMessage> findBySessionIdOrderByTimestampDesc(String sessionId, Pageable pageable);

    List<ChatMessage> findByUsernameOrderByTimestampAsc(String username);

    void deleteBySessionId(String sessionId);

    void deleteByUsername(String username);
}
