package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.User;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {
    List<Account> findByUser(User user);
    Optional<Account> findByUserAndNameIgnoreCase(User user, String name);
    List<Account> findByUserAndLast4(User user, String last4);
    void deleteByUser(User user);
}
