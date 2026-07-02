package pt.rodrigimix.invodata.model;

import jakarta.persistence.*;
import lombok.*;
import pt.rodrigimix.invodata.security.encryption.EncryptedBigDecimalConverter;
import pt.rodrigimix.invodata.security.encryption.EncryptedLocalDateConverter;
import pt.rodrigimix.invodata.security.encryption.EncryptedStringConverter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "goals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Goal {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = EncryptedStringConverter.class)
    private String name;

    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = EncryptedBigDecimalConverter.class)
    private BigDecimal targetAmount;

    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = EncryptedBigDecimalConverter.class)
    private BigDecimal currentAmount;

    @Convert(converter = EncryptedLocalDateConverter.class)
    @Column(columnDefinition = "TEXT")
    private LocalDate deadline;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne
    @JoinColumn(name = "account_id")
    private Account linkedAccount;

    @Builder.Default
    @Column(nullable = false)
    private Boolean completed = false;
}