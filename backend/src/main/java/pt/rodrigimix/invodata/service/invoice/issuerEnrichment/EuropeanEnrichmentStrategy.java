package pt.rodrigimix.invodata.service.invoice.issuerEnrichment;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.VIESResponse;
import pt.rodrigimix.invodata.model.Issuer;
import pt.rodrigimix.invodata.model.CountryCode;
import pt.rodrigimix.invodata.service.ai.AIService;
import pt.rodrigimix.invodata.service.extraction.VIESService;

@Deprecated
@Component
public class EuropeanEnrichmentStrategy implements IssuerEnrichmentStratergy {

    private static final Logger logger = LoggerFactory.getLogger(EuropeanEnrichmentStrategy.class);

    protected final VIESService VIESService;

    protected final AIService aiService;

    protected final AppConfig appConfig;

    @Autowired
    public EuropeanEnrichmentStrategy(VIESService VIESService, AIService aiService, AppConfig appConfig) {
        this.VIESService = VIESService;
        this.aiService = aiService;
        this.appConfig = appConfig;
    }

    @Override
    public void enrich(Issuer issuer) {
        logger.debug("Enriching issuer for country: {}", issuer.getCountry());

        if (!appConfig.getAiEnabled()) {
            VIESResponse viesResponse = VIESService.validateVat(issuer.getCountry(), issuer.getTaxId());

            if (viesResponse != null && viesResponse.getIsValid()) {
                logger.info("VIES validation successful. Setting issuer name from VIES.");
                issuer.setName(viesResponse.getName());
            } else {
                logger.warn("VIES validation failed or returned invalid.");
            }
        }

        logger.debug("Categorizing issuer.");
        String baseCategory = aiService.categorizeIssuer(issuer.getName(), null);
        issuer.setCategory(baseCategory);
        logger.info("Issuer enriched with category: {}", baseCategory);
    }

    @Override
    public boolean supports(CountryCode countryCode) {
        return countryCode.isBelongsToVies() && countryCode != CountryCode.PORTUGAL;
    }
}