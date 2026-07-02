package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pt.rodrigimix.invodata.model.CustomCategory;
import pt.rodrigimix.invodata.model.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomCategoryRepository extends JpaRepository<CustomCategory, Long> {
    List<CustomCategory> findByUserIdOrderByNameAsc(Long userId);
    List<CustomCategory> findByUserUsernameIgnoreCaseOrderByNameAsc(String username);
    Optional<CustomCategory> findByIdAndUserId(Long id, Long userId);
    Optional<CustomCategory> findByUserIdAndNameIgnoreCase(Long userId, String name);
}

