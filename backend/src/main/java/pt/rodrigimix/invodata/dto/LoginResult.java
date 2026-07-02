package pt.rodrigimix.invodata.dto;

public record LoginResult(
    String token,
    String mfaTrustToken) {
}
