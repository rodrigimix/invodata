package pt.rodrigimix.invodata.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.LocalDateTime;

@Entity
@Table(name = "invoice_shares")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvoiceShare {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shared_with_user")
    private User sharedWith;

    @Column(name = "share_token", unique = true)
    private String token;

    @Column(name = "allow_import")
    private Boolean allowImport;

    @Column(name = "allow_pdf")
    private Boolean allowPdf;

    @Column(name = "allow_pdf_download")
    private Boolean allowPdfDownload;

    @Column(name = "file_id")
    private String fileId;

    @Column(name = "redacted_file_id")
    private String redactedFileId;

    @Column(name = "temp_file_id")
    private String tempFileId;

    @Column(name = "temp_file_expires_at")
    private LocalDateTime tempFileExpiresAt;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Column(name = "declined_at")
    private LocalDateTime declinedAt;

    @Column(name = "snapshot", columnDefinition = "LONGTEXT")
    private String snapshot;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
