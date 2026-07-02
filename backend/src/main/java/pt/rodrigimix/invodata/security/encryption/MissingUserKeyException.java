package pt.rodrigimix.invodata.security.encryption;

public class MissingUserKeyException extends RuntimeException {
  public MissingUserKeyException(String message) {
    super(message);
  }
}
