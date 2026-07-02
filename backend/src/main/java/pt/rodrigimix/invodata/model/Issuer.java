package pt.rodrigimix.invodata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

/**
 * Represents an Issuer entity in the invoicing system.
 * This class is mapped to the "issuers" table in the database.
 * An Issuer refers to an entity responsible for issuing invoices and includes details such as tax identification number and name.
 *
 * Fields:
 * - taxId: The unique tax identification number of the issuer.
 * - name: The name of the issuer, which must be unique and cannot be null.
 * - invoices: A collection of invoices issued by this issuer. Defines a one-to-many relationship with the {@code Invoice} entity.
 * - category: The category or type of the issuer. Provides additional classification of the issuer.
 */
@Entity
@Table(name = "issuers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Issuer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Issuer tax ID is required")
    @Column(name = "tax_id", nullable = false, unique = true)
    private String taxId;

    @NotNull(message = "Issuer name is required")
    @Column(nullable = false)
    private String name;

    @OneToMany(mappedBy = "issuer")
    @JsonIgnore
    private List<Invoice> invoices;

    private String category;

    @Enumerated(EnumType.STRING)
    private CountryCode country;
}
