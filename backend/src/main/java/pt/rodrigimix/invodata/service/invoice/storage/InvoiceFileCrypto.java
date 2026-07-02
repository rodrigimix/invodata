package pt.rodrigimix.invodata.service.invoice.storage;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;

final class InvoiceFileCrypto {
  private static final byte[] MAGIC = "INVODATA1".getBytes(StandardCharsets.UTF_8);
  private static final int IV_LENGTH = 12;
  private static final int TAG_LENGTH = 128;

  private InvoiceFileCrypto() {
  }

  static byte[] encrypt(byte[] plaintext, SecretKey key) {
    try {
      byte[] iv = new byte[IV_LENGTH];
      new SecureRandom().nextBytes(iv);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH, iv));
      byte[] ciphertext = cipher.doFinal(plaintext);
      byte[] out = new byte[MAGIC.length + IV_LENGTH + ciphertext.length];
      System.arraycopy(MAGIC, 0, out, 0, MAGIC.length);
      System.arraycopy(iv, 0, out, MAGIC.length, IV_LENGTH);
      System.arraycopy(ciphertext, 0, out, MAGIC.length + IV_LENGTH, ciphertext.length);
      return out;
    } catch (Exception e) {
      throw new IllegalStateException("Failed to encrypt file.", e);
    }
  }

  static byte[] decryptIfEncrypted(byte[] payload, SecretKey key) {
    if (!isEncrypted(payload)) {
      return payload;
    }
    try {
      byte[] iv = Arrays.copyOfRange(payload, MAGIC.length, MAGIC.length + IV_LENGTH);
      byte[] ciphertext = Arrays.copyOfRange(payload, MAGIC.length + IV_LENGTH, payload.length);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_LENGTH, iv));
      return cipher.doFinal(ciphertext);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to decrypt file.", e);
    }
  }

  private static boolean isEncrypted(byte[] payload) {
    if (payload == null || payload.length < MAGIC.length + IV_LENGTH + 1) {
      return false;
    }
    for (int i = 0; i < MAGIC.length; i++) {
      if (payload[i] != MAGIC[i]) {
        return false;
      }
    }
    return true;
  }
}
