package pt.rodrigimix.invodata.security.encryption;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class EncryptedDoubleConverter implements AttributeConverter<Double, String> {
  @Override
  public String convertToDatabaseColumn(Double attribute) {
    if (attribute == null) {
      return null;
    }
    return UserCrypto.encryptString(Double.toString(attribute));
  }

  @Override
  public Double convertToEntityAttribute(String dbData) {
    if (dbData == null) {
      return null;
    }
    String decrypted = UserCrypto.decryptString(dbData);
    return decrypted == null || decrypted.isBlank() ? null : Double.valueOf(decrypted);
  }
}
