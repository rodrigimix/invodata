package pt.rodrigimix.invodata.security.encryption;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class UserKeyExceptionHandler {

  @ExceptionHandler(MissingUserKeyException.class)
  public ResponseEntity<Map<String, Object>> handleMissingKey(MissingUserKeyException ex) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(Map.of("error", Map.of(
            "code", "USER_KEY_REQUIRED",
            "message", ex.getMessage())));
  }
}
