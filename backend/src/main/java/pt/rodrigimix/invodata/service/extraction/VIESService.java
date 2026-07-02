package pt.rodrigimix.invodata.service.extraction;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.VIESResponse;
import pt.rodrigimix.invodata.model.CountryCode;

@Deprecated
@Service
public class VIESService {

    private final RestTemplate restTemplate = new RestTemplate();

    private final AppConfig appConfig;

    @Autowired
    public VIESService(AppConfig appConfig) {
        this.appConfig = appConfig;
    }

    public VIESResponse validateVat(CountryCode countryCode, String vatNumber) {
        try {
            String url = appConfig.getViesUrl() + countryCode.getIsoCode() + "/vat/" + vatNumber;
            return restTemplate.getForObject(url, VIESResponse.class);
        } catch (Exception e) {
            return null;
        }
    }
}
