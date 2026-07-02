package pt.rodrigimix.invodata.model;

import jakarta.persistence.*;
import lombok.*;
import pt.rodrigimix.invodata.security.encryption.EncryptedDoubleConverter;
import pt.rodrigimix.invodata.security.encryption.EncryptedIntegerConverter;
import pt.rodrigimix.invodata.security.encryption.EncryptedStringConverter;

import java.util.UUID;

@Entity
@Table(name = "budgets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Budget {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = EncryptedStringConverter.class)
    private String category;

    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = EncryptedDoubleConverter.class)
    private Double monthlyLimit;

    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = EncryptedIntegerConverter.class)
    private Integer month;

    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = EncryptedIntegerConverter.class)
    private Integer year;
}
