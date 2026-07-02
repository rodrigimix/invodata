package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pt.rodrigimix.invodata.model.User;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    Optional<User> findByEmailIgnoreCase(String name);

    Optional<User> findByPasswordResetTokenHash(String passwordResetTokenHash);

    boolean existsByEmailIgnoreCase(String email);

    Optional<User> findByTaxIdIgnoreCase(String taxId);

    boolean existsByTaxIdIgnoreCase(String taxId);

    @Query("SELECT u.type, COUNT(u) FROM User u GROUP BY u.type")
    List<Object[]> countUsersByType();

    @Query(value = """
            SELECT DATE_FORMAT(u.created_at, '%Y-%m') as month, COUNT(*) as total
            FROM users u
            WHERE u.created_at >= :startDate
            GROUP BY DATE_FORMAT(u.created_at, '%Y-%m')
            ORDER BY month
            """, nativeQuery = true)
    List<Object[]> countUsersByMonthSince(@Param("startDate") LocalDateTime startDate);
}
