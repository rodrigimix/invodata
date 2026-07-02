package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pt.rodrigimix.invodata.model.User;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    Optional<User> findByEmailIgnoreCase(String name);

    boolean existsByEmailIgnoreCase(String email);

    Optional<User> findByTaxIdIgnoreCase(String taxId);

    boolean existsByTaxIdIgnoreCase(String taxId);
}
