package pt.rodrigimix.invodata.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
@Getter
public class AppConfig {

    @Value("${invodata.python.api}")
    private String pythonApi;

    @Value("${invodata.vies.url}")
    private String viesUrl;

    @Value("${invodata.sicae.url}")
    private String sicaeUrl;

    @Value("${invodata.admin.registration-key}")
    private String registrationKey;

    @Value("${invodata.jwt.secret}")
    private String jwtSecret;

    @Value("${invodata.jwt.expiration}")
    private long jwtExpiration;

    @Value("${invodata.ai.enable}")
    private Boolean aiEnabled;

    @Value("${invodata.media.path}")
    private String media_path;

    @Value("${invodata.storage.type:local}")
    private String storageType;

    @Value("${invodata.gcs.bucket:}")
    private String gcsBucket;

    @Value("${invodata.max.upload}")
    private int maxUpload;

    @Value("${invodata.upload.max-concurrent:1}")
    private int uploadMaxConcurrent;

    @Value("${invodata.frontend.url:http://localhost:8081}")
    private String frontendUrl;
}
