package pt.rodrigimix.invodata.service.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import pt.rodrigimix.invodata.model.AuditLog;
import pt.rodrigimix.invodata.repository.AuditLogRepository;

import java.util.Map;

@Service
public class AuditLogService {
  private final AuditLogRepository auditLogRepository;
  private final ObjectMapper objectMapper = new ObjectMapper();

  public AuditLogService(AuditLogRepository auditLogRepository) {
    this.auditLogRepository = auditLogRepository;
  }

  public void log(String username, String action) {
    log(username, action, null);
  }

  public void log(String username, String action, Map<String, Object> details) {
    String payload = null;
    if (details != null && !details.isEmpty()) {
      try {
        payload = objectMapper.writeValueAsString(details);
      } catch (Exception e) {
        payload = details.toString();
      }
    }
    AuditLog log = AuditLog.builder()
        .username(username)
        .action(action)
        .details(payload)
        .build();
    auditLogRepository.save(log);
  }
}
