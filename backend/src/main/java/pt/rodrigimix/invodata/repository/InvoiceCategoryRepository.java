package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pt.rodrigimix.invodata.model.InvoiceCategory;

import java.util.List;
import java.util.Optional;

public interface InvoiceCategoryRepository extends JpaRepository<InvoiceCategory, Long> {
    boolean existsByNameIgnoreCase(String name);

    Optional<InvoiceCategory> findByNameIgnoreCase(String name);

    List<InvoiceCategory> findAllByOrderByNameAsc();
}
