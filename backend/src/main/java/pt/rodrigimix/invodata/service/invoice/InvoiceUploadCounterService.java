package pt.rodrigimix.invodata.service.invoice;

import org.springframework.stereotype.Service;
import pt.rodrigimix.invodata.model.InvoiceUploadCounter;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.InvoiceUploadCounterRepository;

import java.time.LocalDateTime;

@Service
public class InvoiceUploadCounterService {
  private final InvoiceUploadCounterRepository counterRepository;

  public InvoiceUploadCounterService(InvoiceUploadCounterRepository counterRepository) {
    this.counterRepository = counterRepository;
  }

  public InvoiceUploadCounter getCounter(User user) {
    InvoiceUploadCounter counter = counterRepository.findByUser(user)
        .orElseGet(() -> InvoiceUploadCounter.builder()
            .user(user)
            .usedCount(0)
            .firstUploadAt(null)
            .build());
    return resetIfNeeded(counter);
  }

  public boolean wouldExceed(User user, long addCount) {
    return false;
  }

  public InvoiceUploadCounter increment(User user, long addCount) {
    if (addCount <= 0)
      return getCounter(user);
    InvoiceUploadCounter counter = getCounter(user);
    LocalDateTime now = LocalDateTime.now();
    if (counter.getFirstUploadAt() == null) {
      counter.setFirstUploadAt(now);
    }
    counter.setUsedCount(counter.getUsedCount() + addCount);
    return counterRepository.save(counter);
  }

  private InvoiceUploadCounter resetIfNeeded(InvoiceUploadCounter counter) {
    LocalDateTime firstUploadAt = counter.getFirstUploadAt();
    if (firstUploadAt == null) {
      return counter;
    }
    LocalDateTime now = LocalDateTime.now();
    if (!now.isBefore(firstUploadAt.plusMonths(1))) {
      counter.setUsedCount(0);
      counter.setFirstUploadAt(null);
      return counterRepository.save(counter);
    }
    return counter;
  }
}