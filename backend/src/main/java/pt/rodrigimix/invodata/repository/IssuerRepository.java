package pt.rodrigimix.invodata.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pt.rodrigimix.invodata.model.Issuer;

import java.util.Optional;

@Repository
public interface IssuerRepository extends JpaRepository<Issuer, String> {
    Optional<Issuer> findByNameOrTaxIdIgnoreCase(String name, String taxId);

    Optional<Issuer> findByName(String name);

    Optional<Issuer> findByTaxIdIgnoreCase(String taxId);
}
