package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pt.rodrigimix.invodata.model.Budget;

import java.util.Optional;
import java.util.UUID;

public interface BudgetRepository extends JpaRepository<Budget, UUID> {
    Optional<Budget> findByCategoryIgnoreCaseAndMonthAndYear(String category, int month, int year);
}
