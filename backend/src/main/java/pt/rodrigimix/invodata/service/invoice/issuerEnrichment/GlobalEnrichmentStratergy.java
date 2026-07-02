package pt.rodrigimix.invodata.service.invoice.issuerEnrichment;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import pt.rodrigimix.invodata.model.Issuer;
import pt.rodrigimix.invodata.model.CountryCode;
import pt.rodrigimix.invodata.service.ai.AIService;
import pt.rodrigimix.invodata.service.invoice.InvoiceService;

@Deprecated
@Component
public class GlobalEnrichmentStratergy implements IssuerEnrichmentStratergy {

    private final Logger logger = LoggerFactory.getLogger(GlobalEnrichmentStratergy.class);

    private final AIService aiService;

    @Autowired
    public GlobalEnrichmentStratergy(AIService aiService) {
        this.aiService = aiService;
    }

    @Override
    public void enrich(Issuer issuer) {
        if (issuer == null || issuer.getName() == null) {
            logger.warn("Skipping enrichment: Issuer or Issuer name is null");
            return;
        }

        logger.info("Enriching issuer.");
        // InvoiceService.enrichIssuer(issuer, aiService, logger);
    }

    @Override
    public boolean supports(CountryCode countryCode) {
        boolean isSupported = countryCode != null && !countryCode.isBelongsToVies();
        logger.debug("Country code {} support check: {}", countryCode, isSupported);
        return isSupported;
    }
}
