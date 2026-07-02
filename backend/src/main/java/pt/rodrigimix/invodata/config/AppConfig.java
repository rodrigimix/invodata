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

    @Value("${invodata.jwt.secret}")
    private String jwtSecret;

    @Value("${invodata.jwt.expiration}")
    private long jwtExpiration;

    @Value("${admin.stats.password:}")
    private String adminStatsPassword;

    @Value("${invodata.frontend.url}")
    private String frontendUrl;

    @Value("${invodata.cors.allowed-origins:}")
    private String corsAllowedOrigins;

    @Value("${invodata.mail.from}")
    private String mailFrom;

    @Value("${invodata.mail.enabled:true}")
    private boolean mailEnabled;

    @Value("${invodata.ai.enable}")
    private Boolean aiEnabled;

    @Value("${invodata.ai.credentials.path:/data/local/credentials/google.json}")
    private String aiCredentialsPath;

    @Value("${invodata.ai.consent.version:v1}")
    private String aiConsentVersion;

    @Value("${invodata.privacy.version:v1}")
    private String privacyPolicyVersion;

    @Value("${invodata.media.path}")
    private String media_path;

    @Value("${invodata.storage.type:local}")
    private String storageType;

    @Value("${invodata.storage.encryption.enabled:false}")
    private boolean storageEncryptionEnabled;

    @Value("${invodata.storage.encryption.key:}")
    private String storageEncryptionKey;

    @Value("${invodata.storage.encryption.kmsKey:}")
    private String storageEncryptionKmsKey;

    @Value("${invodata.gcs.bucket:}")
    private String gcsBucket;

    @Value("${invodata.upload.max-concurrent:1}")
    private int uploadMaxConcurrent;

    @Value("${invodata.mfa.trust-days:30}")
    private int mfaTrustDays;

    @Value("${invodata.password.reset-minutes:30}")
    private int passwordResetMinutes;

    @Value("${invodata.notifications.test-enabled:false}")
    private boolean notificationsTestEnabled;

    @Value("${invodata.project.path:/workspace}")
    private String projectPath;

    @Value("${invodata.allow.compose.restart:false}")
    private boolean allowComposeRestart;
}
