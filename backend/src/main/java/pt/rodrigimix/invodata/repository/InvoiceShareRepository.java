package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pt.rodrigimix.invodata.model.InvoiceShare;
import pt.rodrigimix.invodata.model.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceShareRepository extends JpaRepository<InvoiceShare, Long> {
    List<InvoiceShare> findByInvoicePublicIdAndCreatedByUsernameIgnoreCase(String publicId, String username);

    List<InvoiceShare> findBySharedWithUsernameIgnoreCaseAndRevokedAtIsNull(String username);

        List<InvoiceShare> findBySharedWithUsernameIgnoreCaseAndRevokedAtIsNullAndAcceptedAtIsNotNullAndDeclinedAtIsNull(
            String username);

    Optional<InvoiceShare> findByInvoicePublicIdAndSharedWithUsernameIgnoreCaseAndRevokedAtIsNull(String publicId,
            String username);

    Optional<InvoiceShare> findByTokenAndRevokedAtIsNull(String token);
}
