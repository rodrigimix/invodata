package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.Goal;
import pt.rodrigimix.invodata.model.User;

import java.util.List;

public interface GoalRepository extends JpaRepository<Goal, Long> {
    List<Goal> findByUser(User user);

    List<Goal> findByLinkedAccount(Account linkedAccount);

    void deleteByUser(User user);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Goal g SET g.linkedAccount = null WHERE g.linkedAccount = :account AND g.user = :user")
    int clearLinkedAccount(@Param("account") Account account, @Param("user") User user);
}
