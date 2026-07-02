package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pt.rodrigimix.invodata.model.AuditLog;

import java.time.LocalDateTime;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
  long deleteByCreatedAtBefore(LocalDateTime cutoff);

  @Query("select distinct a.username from AuditLog a where a.createdAt between :start and :end")
  List<String> findDistinctUsernamesByCreatedAtBetween(@Param("start") LocalDateTime start,
      @Param("end") LocalDateTime end);

  @Query("select a.username, max(a.createdAt) from AuditLog a where a.createdAt between :start and :end group by a.username")
  List<Object[]> findLastAuditByUsernameBetween(@Param("start") LocalDateTime start,
      @Param("end") LocalDateTime end);

  @Query("select distinct a.username from AuditLog a where a.createdAt < :cutoff")
  List<String> findDistinctUsernamesByCreatedAtBefore(@Param("cutoff") LocalDateTime cutoff);

  long deleteByUsernameAndCreatedAtBefore(String username, LocalDateTime cutoff);
}
