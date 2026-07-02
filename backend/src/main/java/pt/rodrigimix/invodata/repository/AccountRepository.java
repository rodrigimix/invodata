package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.User;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {
    List<Account> findByUser(User user);

    List<Account> findByCreatedAtBefore(LocalDateTime cutoff);

    List<Account> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    Optional<Account> findByUserAndNameIgnoreCase(User user, String name);

    List<Account> findByUserAndLast4(User user, String last4);

    void deleteByUser(User user);
}
