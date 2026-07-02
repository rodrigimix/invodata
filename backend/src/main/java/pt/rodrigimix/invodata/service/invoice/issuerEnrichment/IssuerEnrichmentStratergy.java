package pt.rodrigimix.invodata.service.invoice.issuerEnrichment;

import pt.rodrigimix.invodata.model.Issuer;
import pt.rodrigimix.invodata.model.CountryCode;

@Deprecated
public interface IssuerEnrichmentStratergy {
    void enrich(Issuer issuer);
    boolean supports(CountryCode countryCode);
}
