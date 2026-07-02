package pt.rodrigimix.invodata.security.encryption;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.math.BigDecimal;

@Converter
public class EncryptedBigDecimalConverter implements AttributeConverter<BigDecimal, String> {
  @Override
  public String convertToDatabaseColumn(BigDecimal attribute) {
    if (attribute == null) {
      return null;
    }
    return UserCrypto.encryptString(attribute.toPlainString());
  }

  @Override
  public BigDecimal convertToEntityAttribute(String dbData) {
    if (dbData == null) {
      return null;
    }
    String decrypted = UserCrypto.decryptString(dbData);
    return decrypted == null || decrypted.isBlank() ? null : new BigDecimal(decrypted);
  }
}
