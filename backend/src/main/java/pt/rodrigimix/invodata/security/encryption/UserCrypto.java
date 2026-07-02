package pt.rodrigimix.invodata.security.encryption;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

public final class UserCrypto {
  private static final String PREFIX = "ENCv1:";
  private static final int IV_LENGTH = 12;
  private static final int TAG_LENGTH = 128;

  private UserCrypto() {
  }

  public static String encryptString(String value) {
    if (value == null) {
      return null;
    }
    byte[] key = UserKeyContext.requireKey();
    try {
      byte[] iv = new byte[IV_LENGTH];
      new SecureRandom().nextBytes(iv);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_LENGTH, iv));
      byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
      byte[] payload = new byte[iv.length + ciphertext.length];
      System.arraycopy(iv, 0, payload, 0, iv.length);
      System.arraycopy(ciphertext, 0, payload, iv.length, ciphertext.length);
      return PREFIX + Base64.getEncoder().encodeToString(payload);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to encrypt value.", e);
    }
  }

  public static String decryptString(String value) {
    if (value == null) {
      return null;
    }
    if (!value.startsWith(PREFIX)) {
      return value;
    }
    byte[] key = UserKeyContext.requireKey();
    try {
      byte[] payload = Base64.getDecoder().decode(value.substring(PREFIX.length()));
      if (payload.length < IV_LENGTH) {
        throw new IllegalStateException("Invalid encrypted payload.");
      }
      byte[] iv = new byte[IV_LENGTH];
      byte[] ciphertext = new byte[payload.length - IV_LENGTH];
      System.arraycopy(payload, 0, iv, 0, IV_LENGTH);
      System.arraycopy(payload, IV_LENGTH, ciphertext, 0, ciphertext.length);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_LENGTH, iv));
      byte[] plaintext = cipher.doFinal(ciphertext);
      return new String(plaintext, StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to decrypt value.", e);
    }
  }
}
