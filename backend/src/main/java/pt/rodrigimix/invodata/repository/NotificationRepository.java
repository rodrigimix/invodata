package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pt.rodrigimix.invodata.model.Notification;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    long countByUserIdAndIsReadFalse(Long userId);
    List<Notification> findByUserIdAndIsReadFalse(Long userId);
    void deleteByUserId(Long userId);
}
