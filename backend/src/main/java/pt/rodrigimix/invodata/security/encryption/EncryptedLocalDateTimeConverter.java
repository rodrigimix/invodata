package pt.rodrigimix.invodata.security.encryption;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.time.LocalDateTime;

@Converter
public class EncryptedLocalDateTimeConverter implements AttributeConverter<LocalDateTime, String> {
  @Override
  public String convertToDatabaseColumn(LocalDateTime attribute) {
    if (attribute == null) {
      return null;
    }
    return UserCrypto.encryptString(attribute.toString());
  }

  @Override
  public LocalDateTime convertToEntityAttribute(String dbData) {
    if (dbData == null) {
      return null;
    }
    String decrypted = UserCrypto.decryptString(dbData);
    return decrypted == null || decrypted.isBlank() ? null : LocalDateTime.parse(decrypted);
  }
}
