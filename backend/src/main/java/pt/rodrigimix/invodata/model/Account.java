package pt.rodrigimix.invodata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import pt.rodrigimix.invodata.security.encryption.EncryptedBigDecimalConverter;
import pt.rodrigimix.invodata.security.encryption.EncryptedStringConverter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "accounts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Account {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false)
    private Long id;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(columnDefinition = "TEXT")
    private String name;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(columnDefinition = "TEXT")
    private String type;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "user_id", updatable = false)
    private User user;

    @Column(name = "last4", columnDefinition = "TEXT")
    @Convert(converter = EncryptedStringConverter.class)
    private String last4;

    @Builder.Default
    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = EncryptedBigDecimalConverter.class)
    private BigDecimal balance = BigDecimal.ZERO;

    @Builder.Default
    @Column(columnDefinition = "TEXT")
    @Convert(converter = EncryptedStringConverter.class)
    private String currency = "EUR";

    @Builder.Default
    @Column(nullable = false)
    private Boolean isEmergencyFund = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
