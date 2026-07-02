package pt.rodrigimix.invodata.model;

import jakarta.persistence.*;
import lombok.*;
import pt.rodrigimix.invodata.security.encryption.EncryptedBigDecimalConverter;
import pt.rodrigimix.invodata.security.encryption.EncryptedLocalDateConverter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "balance_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BalanceHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = EncryptedLocalDateConverter.class)
    private LocalDate date;

    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = EncryptedBigDecimalConverter.class)
    private BigDecimal balance;
}