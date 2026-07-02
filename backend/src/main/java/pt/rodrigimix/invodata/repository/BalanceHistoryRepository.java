package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.BalanceHistory;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BalanceHistoryRepository extends JpaRepository<BalanceHistory, Long> {
    List<BalanceHistory> findByAccountOrderByDateAsc(Account account);
    Optional<BalanceHistory> findByAccountAndDate(Account account, LocalDate date);
    void deleteByAccountIn(List<Account> accounts);
}
