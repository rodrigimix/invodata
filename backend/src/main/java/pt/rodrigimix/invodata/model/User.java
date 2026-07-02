package pt.rodrigimix.invodata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    @JsonIgnore
    private String password;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String email;

    @Column(name = "tax_id", unique = true)
    private String taxId;

    @JsonIgnore
    @Column(name = "encryption_salt")
    private String encryptionSalt;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserType type = UserType.FREE;

    @Builder.Default
    @Column(name = "ai_consent", nullable = false)
    private Boolean aiConsent = false;

    @Column(name = "ai_consent_at")
    private LocalDateTime aiConsentAt;

    @Column(name = "ai_consent_version")
    private String aiConsentVersion;

    @Builder.Default
    @Column(name = "privacy_consent", nullable = false)
    private Boolean privacyConsent = false;

    @Column(name = "privacy_consent_at")
    private LocalDateTime privacyConsentAt;

    @Column(name = "privacy_consent_version")
    private String privacyConsentVersion;

    @Builder.Default
    @Column(name = "mfa_enabled", nullable = false)
    private Boolean mfaEnabled = false;

    @JsonIgnore
    @Column(name = "mfa_secret")
    private String mfaSecret;

    @Column(name = "mfa_enabled_at")
    private LocalDateTime mfaEnabledAt;

    @JsonIgnore
    @Column(name = "mfa_trusted_token_hash")
    private String mfaTrustedTokenHash;

    @Column(name = "mfa_trusted_until")
    private LocalDateTime mfaTrustedUntil;

    @JsonIgnore
    @Column(name = "password_reset_token_hash")
    private String passwordResetTokenHash;

    @Column(name = "password_reset_token_expires_at")
    private LocalDateTime passwordResetTokenExpiresAt;

    @Builder.Default
    @Column(name = "language", nullable = false)
    private String language = "pt";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "current_savings_streak")
    private Integer currentSavingsStreak = 0;

    @Column(name = "best_savings_streak")
    private Integer bestSavingsStreak = 0;

    private LocalDateTime lastStreakCheck;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
