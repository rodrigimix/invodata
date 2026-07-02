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
import pt.rodrigimix.invodata.service.system.SystemSettingsService;

@Deprecated
@Component
public class EuropeanEnrichmentStrategy implements IssuerEnrichmentStratergy {

    private static final Logger logger = LoggerFactory.getLogger(EuropeanEnrichmentStrategy.class);

    protected final VIESService VIESService;

    protected final AIService aiService;

    protected final AppConfig appConfig;
    protected final SystemSettingsService settingsService;

    @Autowired
    public EuropeanEnrichmentStrategy(VIESService VIESService, AIService aiService, AppConfig appConfig,
            SystemSettingsService settingsService) {
        this.VIESService = VIESService;
        this.aiService = aiService;
        this.appConfig = appConfig;
        this.settingsService = settingsService;
    }

    @Override
    public void enrich(Issuer issuer) {
        logger.debug("Enriching issuer for country: {}", issuer.getCountry());

        if (!settingsService.isAiEnabled()) {
            VIESResponse viesResponse = VIESService.validateVat(issuer.getCountry(), issuer.getTaxId());

            if (viesResponse != null && viesResponse.getIsValid()) {
                logger.info("VIES validation successful. Setting issuer name from VIES.");
                issuer.setName(viesResponse.getName());
            } else {
                logger.warn("VIES validation failed or returned invalid.");
            }
        }

        logger.debug("Categorizing issuer (ignored at issuer level).");
    }

    @Override
    public boolean supports(CountryCode countryCode) {
        return countryCode.isBelongsToVies() && countryCode != CountryCode.PORTUGAL;
    }
}