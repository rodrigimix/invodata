package pt.rodrigimix.invodata.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import pt.rodrigimix.invodata.model.Issuer;
import pt.rodrigimix.invodata.model.CountryCode;
import pt.rodrigimix.invodata.repository.IssuerRepository;
import pt.rodrigimix.invodata.service.extraction.VIESService;
import pt.rodrigimix.invodata.dto.VIESResponse;

import java.util.Locale;

@RestController
@RequestMapping("/api/issuers")
public class IssuerController {

    private final IssuerRepository issuerRepository;
    private final VIESService viesService;

    public IssuerController(IssuerRepository issuerRepository, VIESService viesService) {
        this.issuerRepository = issuerRepository;
        this.viesService = viesService;
    }

    @GetMapping("/by-tax-id")
    public ResponseEntity<Issuer> getIssuerByTaxId(@RequestParam String taxId) {
        if (taxId == null || taxId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String trimmed = taxId.trim();
        var local = issuerRepository.findByTaxIdIgnoreCase(trimmed);
        if (local.isPresent()) {
            return ResponseEntity.ok(local.get());
        }

        ViesLookup viesLookup = parseViesTaxId(trimmed);
        if (viesLookup == null || !viesLookup.countryCode().isBelongsToVies()) {
            return ResponseEntity.notFound().build();
        }

        VIESResponse viesResponse = viesService.validateVat(viesLookup.countryCode(), viesLookup.vatNumber());
        if (viesResponse != null && Boolean.TRUE.equals(viesResponse.getIsValid()) && viesResponse.getName() != null) {
            Issuer issuer = Issuer.builder()
                    .taxId(trimmed)
                    .name(viesResponse.getName().trim())
                    .country(viesLookup.countryCode())
                    .build();
            return ResponseEntity.ok(issuer);
        }

        return ResponseEntity.notFound().build();
    }

    private ViesLookup parseViesTaxId(String taxId) {
        if (taxId.length() < 3) {
            return null;
        }
        String prefix = taxId.substring(0, 2).toUpperCase(Locale.ROOT);
        String vatNumber = taxId.substring(2).trim();
        if (vatNumber.isEmpty()) {
            return null;
        }
        if ("GR".equals(prefix)) {
            prefix = "EL";
        }
        CountryCode countryCode = CountryCode.fromValue(prefix);
        if (countryCode == null) {
            return null;
        }
        return new ViesLookup(countryCode, vatNumber);
    }

    private record ViesLookup(CountryCode countryCode, String vatNumber) {}
}
