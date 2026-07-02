package pt.rodrigimix.invodata.service.user;

import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
public class MfaService {

  private static final String ISSUER = "Invodata";
  private final GoogleAuthenticator authenticator = new GoogleAuthenticator();

  public GoogleAuthenticatorKey createCredentials() {
    return authenticator.createCredentials();
  }

  public boolean isCodeValid(String secret, String code) {
    if (secret == null || secret.isBlank() || code == null || code.isBlank()) {
      return false;
    }
    int parsed;
    try {
      parsed = Integer.parseInt(code);
    } catch (NumberFormatException ex) {
      return false;
    }
    return authenticator.authorize(secret, parsed);
  }

  public String buildOtpAuthUrl(String username, String secret) {
    String label = ISSUER + ":" + username;
    return String.format(
        "otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
        urlEncode(label),
        urlEncode(secret),
        urlEncode(ISSUER));
  }

  private String urlEncode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
