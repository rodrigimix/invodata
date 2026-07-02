package pt.rodrigimix.invodata.security.encryption;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.time.LocalDate;

@Converter
public class EncryptedLocalDateConverter implements AttributeConverter<LocalDate, String> {
  @Override
  public String convertToDatabaseColumn(LocalDate attribute) {
    if (attribute == null) {
      return null;
    }
    return UserCrypto.encryptString(attribute.toString());
  }

  @Override
  public LocalDate convertToEntityAttribute(String dbData) {
    if (dbData == null) {
      return null;
    }
    String decrypted = UserCrypto.decryptString(dbData);
    return decrypted == null || decrypted.isBlank() ? null : LocalDate.parse(decrypted);
  }
}
