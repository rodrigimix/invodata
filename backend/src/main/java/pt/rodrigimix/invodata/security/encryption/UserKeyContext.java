package pt.rodrigimix.invodata.security.encryption;

import java.util.Base64;

public final class UserKeyContext {
  private static final ThreadLocal<byte[]> CURRENT_KEY = new ThreadLocal<>();

  private UserKeyContext() {
  }

  public static void setKeyFromBase64(String base64Key) {
    if (base64Key == null || base64Key.isBlank()) {
      CURRENT_KEY.remove();
      return;
    }
    byte[] decoded = Base64.getDecoder().decode(base64Key.trim());
    if (decoded.length != 32) {
      throw new MissingUserKeyException("Invalid user key length.");
    }
    CURRENT_KEY.set(decoded);
  }

  public static byte[] getKey() {
    return CURRENT_KEY.get();
  }

  public static byte[] requireKey() {
    byte[] key = CURRENT_KEY.get();
    if (key == null || key.length == 0) {
      throw new MissingUserKeyException("User encryption key required.");
    }
    return key;
  }

  public static void clear() {
    CURRENT_KEY.remove();
  }
}
