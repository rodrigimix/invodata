package pt.rodrigimix.invodata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Represents an Invoice entity for the invoicing system.
 * This class is mapped to the "invoices" table in the database.
 * It stores details about a financial transaction, including amounts, dates, and the issuer.
 *
 * An Invoice can represent either a revenue or an expense.
 * It is associated with an Issuer entity that provides information about the entity issuing the invoice.
 *
 * Fields:
 * - id: Unique identifier for the invoice.
 * - documentNum: Document number associated with the invoice.
 * - date: The issue date of the invoice.
 * - issuer: The entity that issued the invoice.
 * - isRevenue: Indicates whether the invoice represents revenue (true) or expense (false).
 * - totalAmount: The total monetary value of the invoice.
 * - taxAmount: The tax portion of the total amount.
 * - netAmount: The net amount after exclusions such as taxes.
 * - licensePlate: Optional field indicating the license plate associated with the invoice, if applicable.
 * - paymentMethod: Optional field specifying the payment method used.
 * - notes: Additional notes or descriptions about the invoice.
 */
@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Invoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @ManyToOne
    @JoinColumn(name = "account_id")
    private Account account;

    @NotNull(message = "Document number is required")
    @Column(nullable = false)
    private String documentNum;

    @NotNull(message = "Issue date is required")
    @Column(name = "issue_date", nullable = false)
    private LocalDate date;

     @ManyToOne(fetch = FetchType.EAGER)
     @JoinColumn(name = "invoice_issuer", referencedColumnName = "tax_id")
     private Issuer issuer;

    @ElementCollection
    @CollectionTable(name = "invoice_items", joinColumns = @JoinColumn(name = "invoice_id"))
    private List<Item> items;

    @NotNull(message = "Invoice type is required")
    @Column(nullable = false)
    private boolean revenue;

    @NotNull(message = "Total amount is required")
    @Column(nullable = false)
    private Double totalAmount;

    @NotNull(message = "Tax amount is required")
    @Column(nullable = false)
    private Double taxAmount;

    @NotNull(message = "Net amount is required")
    @Column(nullable = false)
    private Double netAmount;

    private String licensePlate;

    private String paymentMethod;

    private String notes;

    private String fileID;

    private String redactedFileID;

    @Column(name = "original_file_name")
    private String originalFileName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

}
