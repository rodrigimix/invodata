package pt.rodrigimix.invodata.security.encryption;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class EncryptedBooleanConverter implements AttributeConverter<Boolean, String> {
  @Override
  public String convertToDatabaseColumn(Boolean attribute) {
    if (attribute == null) {
      return null;
    }
    return UserCrypto.encryptString(Boolean.toString(attribute));
  }

  @Override
  public Boolean convertToEntityAttribute(String dbData) {
    if (dbData == null) {
      return null;
    }
    String decrypted = UserCrypto.decryptString(dbData);
    return decrypted == null || decrypted.isBlank() ? null : Boolean.valueOf(decrypted);
  }
}
