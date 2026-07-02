package pt.rodrigimix.invodata.security.encryption;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class EncryptedIntegerConverter implements AttributeConverter<Integer, String> {
  @Override
  public String convertToDatabaseColumn(Integer attribute) {
    if (attribute == null) {
      return null;
    }
    return UserCrypto.encryptString(Integer.toString(attribute));
  }

  @Override
  public Integer convertToEntityAttribute(String dbData) {
    if (dbData == null) {
      return null;
    }
    String decrypted = UserCrypto.decryptString(dbData);
    return decrypted == null || decrypted.isBlank() ? null : Integer.valueOf(decrypted);
  }
}
