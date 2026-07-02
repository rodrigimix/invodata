package pt.rodrigimix.invodata.service.invoice.issuerEnrichment;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.SicaeResponse;
import pt.rodrigimix.invodata.dto.VIESResponse;
import pt.rodrigimix.invodata.model.Issuer;
import pt.rodrigimix.invodata.model.CountryCode;
import pt.rodrigimix.invodata.service.ai.AIService;
import pt.rodrigimix.invodata.service.extraction.VIESService;
import pt.rodrigimix.invodata.service.extraction.SicaeService;

@Deprecated
@Component
public class PortugalEnrichmentStrategy extends EuropeanEnrichmentStrategy {

    private final Logger logger = LoggerFactory.getLogger(PortugalEnrichmentStrategy.class);

    private final SicaeService sicaeService;

    @Autowired
    public PortugalEnrichmentStrategy(SicaeService sicaeService, VIESService VIESService, AIService aiService,
            AppConfig appConfig) {
        super(VIESService, aiService, appConfig);
        this.sicaeService = sicaeService;
    }

    @Override
    public void enrich(Issuer issuer) {
        logger.info("Starting enrichment process for issuer.");

        String category;
        if (!appConfig.getAiEnabled()) {
            VIESResponse viesResponse = VIESService.validateVat(issuer.getCountry(), issuer.getTaxId());
            if (viesResponse != null && viesResponse.getIsValid()) {
                logger.debug("VIES validation successful. Setting issuer name.");
                issuer.setName(viesResponse.getName());
            } else {
                logger.warn("VIES validation failed or returned invalid.");
            }

            logger.debug("Consulting SICAE.");
            SicaeResponse sicaeResponse = sicaeService.consultSicae(issuer.getTaxId());

            if (sicaeResponse != null) {
                logger.debug("Categorizing issuer with CAE designation: {}",
                        sicaeResponse.designationCae());
                category = aiService.categorizeIssuer(issuer.getName(), sicaeResponse.designationCae());
            } else {
                logger.debug("Categorizing issuer.");
                category = aiService.categorizeIssuer(issuer.getName(), null);
            }
        }

        else {
            logger.debug("Categorizing issuer.");
            category = aiService.categorizeIssuer(issuer.getName(), null);
        }

        issuer.setCategory(category);

        logger.info("Enrichment completed for issuer. Assigned category: {}",
                category);
    }

    @Override
    public boolean supports(CountryCode countryCode) {
        return CountryCode.PORTUGAL.equals(countryCode);
    }
}
