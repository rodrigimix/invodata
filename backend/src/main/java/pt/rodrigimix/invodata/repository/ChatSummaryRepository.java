package pt.rodrigimix.invodata.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import pt.rodrigimix.invodata.model.ChatSummary;

import java.util.Optional;

public interface ChatSummaryRepository extends MongoRepository<ChatSummary, String> {
    Optional<ChatSummary> findFirstBySessionIdOrderByCreatedAtDesc(String sessionId);

    java.util.List<ChatSummary> findBySessionIdIn(java.util.List<String> sessionIds);

    void deleteBySessionId(String sessionId);

    void deleteBySessionIdIn(java.util.List<String> sessionIds);
}
