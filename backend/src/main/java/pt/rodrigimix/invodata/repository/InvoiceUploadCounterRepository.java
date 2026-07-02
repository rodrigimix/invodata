package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pt.rodrigimix.invodata.model.InvoiceUploadCounter;
import pt.rodrigimix.invodata.model.User;

import java.util.Optional;

@Repository
public interface InvoiceUploadCounterRepository extends JpaRepository<InvoiceUploadCounter, Long> {
  Optional<InvoiceUploadCounter> findByUser(User user);
}