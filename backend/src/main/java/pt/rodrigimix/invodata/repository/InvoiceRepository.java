package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.User;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {
        Optional<Invoice> findByPublicIdAndUserUsernameIgnoreCase(String publicId, String username);

        List<Invoice> findByUser(User user);

        List<Invoice> findByCreatedAtBefore(LocalDateTime cutoff);

        List<Invoice> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

        List<Invoice> findByAccountAndUser(Account account, User user);

        Optional<Invoice> findTopByUserUsernameIgnoreCaseAndIssuerTaxIdIgnoreCaseOrderByCreatedAtDesc(
                        String username,
                        String taxId);

        @Modifying(clearAutomatically = true, flushAutomatically = true)
        @Query("UPDATE Invoice i SET i.account = null WHERE i.account = :account AND i.user = :user")
        int clearAccount(@Param("account") Account account, @Param("user") User user);

        long countByFileID(String fileID);

        long countByRedactedFileID(String redactedFileID);

        long countByFileIDIsNotNull();

        long countByFileIDIsNull();

        @Query(value = """
                        SELECT DATE_FORMAT(i.created_at, '%Y-%m') as month, COUNT(*) as total
                        FROM invoices i
                        WHERE i.created_at >= :startDate
                        GROUP BY DATE_FORMAT(i.created_at, '%Y-%m')
                        ORDER BY month
                        """, nativeQuery = true)
        List<Object[]> countInvoicesByMonthSince(@Param("startDate") LocalDateTime startDate);

        @Query("SELECT COUNT(i) > 0 FROM Invoice i WHERE i.user.username = :username AND i.fileID = :fileId")
        boolean existsByFileIDAndUserUsername(@Param("fileId") String fileId, @Param("username") String username);

        List<Invoice> findByFileIDAndUserUsername(String fileID, String username);

        void deleteByUser(User user);

        @Query("SELECT COUNT(i) FROM Invoice i WHERE i.user.username = :username " +
                        "AND MONTH(i.createdAt) = :month AND YEAR(i.createdAt) = :year")
        long countInvoicesByMonthAndUser(@Param("username") String username,
                        @Param("month") int month,
                        @Param("year") int year);

        @Query("SELECT COUNT(i) FROM Invoice i WHERE i.user.username = :username " +
                        "AND i.fileID IS NOT NULL " +
                        "AND MONTH(i.createdAt) = :month AND YEAR(i.createdAt) = :year")
        long countUploadedInvoicesByMonthAndUser(@Param("username") String username,
                        @Param("month") int month,
                        @Param("year") int year);

        void deleteBySharedFromShareId(Long sharedFromShareId);

}
