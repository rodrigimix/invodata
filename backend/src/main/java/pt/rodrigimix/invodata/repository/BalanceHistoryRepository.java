package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.BalanceHistory;
import java.util.List;

public interface BalanceHistoryRepository extends JpaRepository<BalanceHistory, Long> {
    List<BalanceHistory> findByAccount(Account account);

    void deleteByAccountIn(List<Account> accounts);
}
