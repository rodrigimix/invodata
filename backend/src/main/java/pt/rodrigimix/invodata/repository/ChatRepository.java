package pt.rodrigimix.invodata.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import pt.rodrigimix.invodata.model.ChatMessage;

import java.time.LocalDateTime;
import java.util.List;

public interface ChatRepository extends MongoRepository<ChatMessage, String> {
    List<ChatMessage> findTop20ByUsernameOrderByTimestampAsc(String username);

    List<ChatMessage> findBySessionIdOrderByTimestampDesc(String sessionId, Pageable pageable);

    List<ChatMessage> findByUsernameOrderByTimestampAsc(String username);

    List<ChatMessage> findBySessionIdInOrderByTimestampAsc(List<String> sessionIds);

    void deleteBySessionId(String sessionId);

    long deleteBySessionIdIn(List<String> sessionIds);

    long deleteByUsernameAndTimestampBefore(String username, LocalDateTime cutoff);

    void deleteByUsername(String username);

    long deleteByTimestampBefore(LocalDateTime cutoff);
}
