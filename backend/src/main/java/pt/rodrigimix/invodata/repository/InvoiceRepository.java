package pt.rodrigimix.invodata.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pt.rodrigimix.invodata.dto.CategorySpendingDTO;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.Issuer;
import pt.rodrigimix.invodata.model.User;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {

        @Override
        @EntityGraph(attributePaths = {"issuer", "items", "account", "user"})
        Page<Invoice> findAll(Specification<Invoice> spec, Pageable pageable);

        @EntityGraph(attributePaths = {"issuer", "items", "account", "user"})
        Optional<Invoice> findByDocumentNumAndIssuerAndUserUsernameIgnoreCase(String documentNum, Issuer issuer,
                        String username);

        // No InvoiceRepository.java
        @EntityGraph(attributePaths = {"issuer", "items", "account", "user"})
        List<Invoice> findByDocumentNumInAndUserUsernameIgnoreCase(List<String> documentNums, String username);

        @EntityGraph(attributePaths = {"issuer", "items", "account", "user"})
        Optional<Invoice> findByDocumentNumIgnoreCaseAndUser(String documentNum, User user);

        @EntityGraph(attributePaths = {"issuer", "items", "account", "user"})
        List<Invoice> findByUser(User user);

        @EntityGraph(attributePaths = {"issuer", "items", "account", "user"})
        List<Invoice> findByAccountAndUser(Account account, User user);

        @Modifying(clearAutomatically = true, flushAutomatically = true)
        @Query("UPDATE Invoice i SET i.account = null WHERE i.account = :account AND i.user = :user")
        int clearAccount(@Param("account") Account account, @Param("user") User user);

        long countByFileID(String fileID);

        @Query("SELECT COUNT(i) > 0 FROM Invoice i WHERE i.user.username = :username AND i.fileID = :fileId")
        boolean existsByFileIDAndUserUsername(@Param("fileId") String fileId, @Param("username") String username);

        @EntityGraph(attributePaths = {"issuer", "items", "account"})
        List<Invoice> findByFileIDAndUserUsername(String fileID, String username);

        @Query("""
                        SELECT COUNT(i) > 0 FROM Invoice i
                        WHERE LOWER(i.documentNum) = LOWER(:documentNum)
                          AND i.user.username = :username
                          AND (
                                (:taxId IS NOT NULL AND LOWER(i.issuer.taxId) = LOWER(:taxId))
                             OR (:taxId IS NULL AND LOWER(i.issuer.name) = LOWER(:issuerName))
                          )
                        """)
        boolean existsDuplicateInvoice(@Param("documentNum") String documentNum,
                        @Param("taxId") String taxId,
                        @Param("issuerName") String issuerName,
                        @Param("username") String username);

        void deleteByUser(User user);

        @Query("SELECT SUM(i.totalAmount) from Invoice i WHERE i.issuer.category = :category " +
                        "AND MONTH(i.date) = :month " +
                        "AND YEAR(i.date) = :year " +
                        "AND i.user.username = :username")
        Double sumByCategoryAndMonthIgnoreCase(@Param("category") String category, @Param("month") int month,
                        @Param("year") int year, @Param("username") String username);

        @Query(value = """
                        SELECT SUM(i.total_amount) / NULLIF(COUNT(DISTINCT DATE_FORMAT(i.issue_date, '%Y-%m')), 0)
                        FROM invoices i
                        JOIN issuers iss ON i.invoice_issuer = iss.tax_id
                        JOIN users u ON i.user_id = u.id
                        WHERE iss.category IN :categories AND u.username = :username
                        """, nativeQuery = true)
        Double getAverageSpendingForCategoriesIgnoreCase(@Param("categories") List<String> categories,
                        @Param("username") String username);

        @Query(value = """
                        SELECT iss.category, SUM(i.total_amount)
                        FROM invoices i
                        JOIN issuers iss ON i.invoice_issuer = iss.tax_id
                        JOIN users u ON i.user_id = u.id
                        WHERE MONTH(i.issue_date) = :month AND YEAR(i.issue_date) = :year
                        AND u.username = :username
                        GROUP BY iss.category
                        """, nativeQuery = true)
        List<Object[]> getSpendingReportIgnoreCase(@Param("month") int month, @Param("year") int year,
                        @Param("username") String username);

        @Query(value = """
                        SELECT SUM(i.total_amount) FROM invoices i
                        JOIN users u ON i.user_id = u.id
                        WHERE MONTH(i.issue_date) = :month AND YEAR(i.issue_date) = :year
                        AND u.username = :username
                        """, nativeQuery = true)
        Double getTotalSpentInMonthIgnoreCase(@Param("month") int month, @Param("year") int year,
                        @Param("username") String username);

        @Query(value = """
                        SELECT iss.category as name, SUM(i.total_amount) as value
                        FROM invoices i
                        JOIN issuers iss ON i.invoice_issuer = iss.tax_id
                        JOIN users u ON i.user_id = u.id
                        WHERE MONTH(i.issue_date) = :month AND YEAR(i.issue_date) = :year
                        AND u.username = :username
                        GROUP BY iss.category
                        """, nativeQuery = true)
        List<Map<String, Object>> getCategorySpendingIgnoreCase(@Param("month") int month, @Param("year") int year,
                        @Param("username") String username);

        @Query(value = """
                        SELECT iss.category as name, SUM(i.total_amount) as value
                        FROM invoices i
                        JOIN issuers iss ON i.invoice_issuer = iss.tax_id
                        JOIN users u ON i.user_id = u.id
                        WHERE YEAR(i.issue_date) = :year
                        AND u.username = :username
                        GROUP BY iss.category
                        """, nativeQuery = true)
        List<Map<String, Object>> getCategorySpendingByYearIgnoreCase(@Param("year") int year,
                        @Param("username") String username);

        @Query(value = """
                        SELECT DATE_FORMAT(i.issue_date, '%Y-%m') as month, SUM(i.total_amount) as total
                        FROM invoices i
                        JOIN users u ON i.user_id = u.id
                        WHERE i.issue_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                        AND u.username = :username
                        GROUP BY DATE_FORMAT(i.issue_date, '%Y-%m')
                        ORDER BY month ASC
                        """, nativeQuery = true)
        List<Map<String, Object>> getMonthlyEvolutionIgnoreCase(@Param("username") String username);

        @Query(value = """
                        SELECT
                            SUM(CASE WHEN i.revenue = true THEN i.total_amount ELSE 0 END) as total_revenue,
                            SUM(CASE WHEN i.revenue = false THEN i.total_amount ELSE 0 END) as total_expense,
                            SUM(CASE WHEN i.revenue = true THEN i.net_amount ELSE 0 END) as net_revenue,
                            SUM(CASE WHEN i.revenue = false THEN i.net_amount ELSE 0 END) as net_expense,
                            SUM(CASE WHEN i.revenue = true THEN i.tax_amount ELSE 0 END) as tax_revenue,
                            SUM(CASE WHEN i.revenue = false THEN i.tax_amount ELSE 0 END) as tax_expense
                        FROM invoices i
                        JOIN users u ON i.user_id = u.id
                        WHERE MONTH(i.issue_date) = :month AND YEAR(i.issue_date) = :year
                        AND u.username = :username
                        """, nativeQuery = true)
        Map<String, Object> getMonthlyTotals(@Param("month") int month, @Param("year") int year,
                        @Param("username") String username);

        @Query(value = """
                        SELECT
                            SUM(CASE WHEN i.revenue = true THEN i.total_amount ELSE 0 END) as total_revenue,
                            SUM(CASE WHEN i.revenue = false THEN i.total_amount ELSE 0 END) as total_expense,
                            SUM(CASE WHEN i.revenue = true THEN i.net_amount ELSE 0 END) as net_revenue,
                            SUM(CASE WHEN i.revenue = false THEN i.net_amount ELSE 0 END) as net_expense,
                            SUM(CASE WHEN i.revenue = true THEN i.tax_amount ELSE 0 END) as tax_revenue,
                            SUM(CASE WHEN i.revenue = false THEN i.tax_amount ELSE 0 END) as tax_expense
                        FROM invoices i
                        JOIN users u ON i.user_id = u.id
                        WHERE YEAR(i.issue_date) = :year
                        AND u.username = :username
                        """, nativeQuery = true)
        Map<String, Object> getYearlyTotals(@Param("year") int year, @Param("username") String username);

        @Query("SELECT COUNT(i) FROM Invoice i WHERE i.user.username = :username " +
                        "AND MONTH(i.createdAt) = :month AND YEAR(i.createdAt) = :year")
        long countInvoicesByMonthAndUser(@Param("username") String username,
                        @Param("month") int month,
                        @Param("year") int year);

        @Query(value = """
                        SELECT
                            DATE_FORMAT(i.issue_date, '%Y-%m') as month_key,
                            UPPER(DATE_FORMAT(i.issue_date, '%b')) as month,
                            SUM(CASE WHEN i.revenue = true THEN i.total_amount ELSE 0 END) as revenue,
                            SUM(CASE WHEN i.revenue = false THEN i.total_amount ELSE 0 END) as expense
                        FROM invoices i
                        JOIN users u ON i.user_id = u.id
                        WHERE i.issue_date >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
                        AND u.username = :username
                        GROUP BY DATE_FORMAT(i.issue_date, '%Y-%m'), UPPER(DATE_FORMAT(i.issue_date, '%b'))
                        ORDER BY month_key ASC
                        """, nativeQuery = true)
        List<Map<String, Object>> getMonthlyEvolutionDetailed(@Param("username") String username);

        @Query("SELECT new pt.rodrigimix.invodata.dto.CategorySpendingDTO(i.issuer.category, SUM(i.totalAmount)) " +
                        "FROM Invoice i " +
                        "WHERE i.user.username = :username " +
                        "AND i.date >= :startDate " +
                        "AND i.revenue = false " +
                        "GROUP BY i.issuer.category")
        List<CategorySpendingDTO> findSpendingSummarySince(@Param("username") String username,
                        @Param("startDate") LocalDate startDate);

        @Query(value = """
                        SELECT
                            SUM(CASE WHEN i.revenue = true THEN i.total_amount ELSE 0 END) as total_revenue,
                            SUM(CASE WHEN i.revenue = false THEN i.total_amount ELSE 0 END) as total_expense
                        FROM invoices i
                        JOIN users u ON i.user_id = u.id
                        WHERE i.issue_date >= :startDate
                        AND u.username = :username
                        """, nativeQuery = true)
        Map<String, Object> getTotalsSince(@Param("startDate") LocalDate startDate,
                        @Param("username") String username);

        @Query(value = """
                        SELECT iss.category as category, SUM(i.total_amount) as amount
                        FROM invoices i
                        JOIN issuers iss ON i.invoice_issuer = iss.tax_id
                        JOIN users u ON i.user_id = u.id
                        WHERE i.issue_date >= :startDate
                        AND u.username = :username
                        AND i.revenue = false
                        GROUP BY iss.category
                        ORDER BY amount DESC
                        LIMIT 5
                        """, nativeQuery = true)
        List<Map<String, Object>> getTopCategoriesSince(@Param("startDate") LocalDate startDate,
                        @Param("username") String username);

        @Query(value = """
                        SELECT
                            DATE_FORMAT(i.issue_date, '%Y-%m') as month,
                            SUM(CASE WHEN i.revenue = true THEN i.total_amount ELSE 0 END) as total_revenue,
                            SUM(CASE WHEN i.revenue = false THEN i.total_amount ELSE 0 END) as total_expense
                        FROM invoices i
                        JOIN users u ON i.user_id = u.id
                        WHERE i.issue_date >= :startDate
                        AND u.username = :username
                        GROUP BY DATE_FORMAT(i.issue_date, '%Y-%m')
                        ORDER BY month ASC
                        """, nativeQuery = true)
        List<Map<String, Object>> getMonthlyTrendSince(@Param("startDate") LocalDate startDate,
                        @Param("username") String username);

        @Query(value = """
                        SELECT iss.name as name, SUM(i.total_amount) as amount
                        FROM invoices i
                        JOIN issuers iss ON i.invoice_issuer = iss.tax_id
                        JOIN users u ON i.user_id = u.id
                        WHERE i.issue_date >= :startDate
                        AND u.username = :username
                        AND i.revenue = false
                        GROUP BY iss.name
                        ORDER BY amount DESC
                        LIMIT 5
                        """, nativeQuery = true)
        List<Map<String, Object>> getTopIssuersSince(@Param("startDate") LocalDate startDate,
                        @Param("username") String username);

        @Query(value = """
                        SELECT iss.name as issuer_name,
                               iss.category as category,
                               i.issue_date as issue_date,
                               i.total_amount as total_amount,
                               i.document_num as document_num
                        FROM invoices i
                        JOIN issuers iss ON i.invoice_issuer = iss.tax_id
                        JOIN users u ON i.user_id = u.id
                        WHERE i.issue_date >= :startDate
                        AND u.username = :username
                        AND i.revenue = false
                        ORDER BY i.total_amount DESC
                        LIMIT 5
                        """, nativeQuery = true)
        List<Map<String, Object>> getTopInvoicesSince(@Param("startDate") LocalDate startDate,
                        @Param("username") String username);

        @Query("""
                        SELECT DISTINCT i
                        FROM Invoice i
                        JOIN FETCH i.issuer
                        LEFT JOIN FETCH i.account
                        LEFT JOIN FETCH i.items
                        JOIN i.user u
                        WHERE i.date >= :startDate
                        AND u.username = :username
                        ORDER BY i.date DESC
                        """)
        List<Invoice> getInvoicesSince(@Param("startDate") LocalDate startDate,
                        @Param("username") String username);
}
