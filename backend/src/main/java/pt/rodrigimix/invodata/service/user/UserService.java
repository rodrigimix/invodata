package pt.rodrigimix.invodata.service.user;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.LoginRequest;
import pt.rodrigimix.invodata.dto.LoginResult;
import pt.rodrigimix.invodata.dto.RegisterRequest;
import pt.rodrigimix.invodata.dto.UpdatePasswordRequest;
import pt.rodrigimix.invodata.dto.UpdateUserRequest;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.UserRepository;
import pt.rodrigimix.invodata.service.notification.EmailService;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

@Service
public class UserService {
    private final UserRepository userRepository;

    private final PasswordEncoder passwordEncoder;

    private final AppConfig appConfig;

    private final MfaService mfaService;

    private final EmailService emailService;

    @Autowired
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, AppConfig appConfig,
            MfaService mfaService, EmailService emailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.appConfig = appConfig;
        this.mfaService = mfaService;
        this.emailService = emailService;
    }

    public User register(RegisterRequest request) {
        if (!Boolean.TRUE.equals(request.privacyConsent())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Privacy policy consent is required.");
        }
        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new RuntimeException("User already exists.");
        }
        String normalizedEmail = request.email() != null ? request.email().trim() : null;
        if (normalizedEmail != null && !normalizedEmail.isBlank()
                && userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists.");
        }
        String normalizedTaxId = request.taxId() != null ? request.taxId().trim() : null;
        if (normalizedTaxId != null && !normalizedTaxId.isBlank()
                && userRepository.existsByTaxIdIgnoreCase(normalizedTaxId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tax ID already exists.");
        }

        boolean consent = Boolean.TRUE.equals(request.aiConsent());
        boolean privacyConsent = Boolean.TRUE.equals(request.privacyConsent());
        User user = User.builder()
                .username(request.username())
                .password(passwordEncoder.encode(request.password()))
                .email(normalizedEmail != null && !normalizedEmail.isBlank() ? normalizedEmail : null)
                .name(request.name())
                .taxId(normalizedTaxId != null && !normalizedTaxId.isBlank() ? normalizedTaxId : null)
                .encryptionSalt(generateEncryptionSalt())
                .aiConsent(consent)
                .aiConsentAt(consent ? java.time.LocalDateTime.now() : null)
                .aiConsentVersion(consent ? appConfig.getAiConsentVersion() : null)
                .privacyConsent(privacyConsent)
                .privacyConsentAt(privacyConsent ? java.time.LocalDateTime.now() : null)
                .privacyConsentVersion(privacyConsent ? appConfig.getPrivacyPolicyVersion() : null)
                .build();
        return userRepository.save(user);
    }

    public boolean verifyPassword(String rawPassword, String encodedPassword) {
        return passwordEncoder.matches(rawPassword, encodedPassword);
    }

    public LoginResult login(LoginRequest request) {
        User user = userRepository.findByUsernameIgnoreCase(request.username())
                .orElseThrow(() -> new RuntimeException("User not found."));

        if (!verifyPassword(request.password(), user.getPassword())) {
            throw new RuntimeException("Invalid credentials.");
        }

        String trustToken = null;
        if (Boolean.TRUE.equals(user.getMfaEnabled())) {
            boolean trusted = isTrustedDevice(user, request.trustToken());
            if (!trusted) {
                if (request.totp() == null || request.totp().isBlank()) {
                    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "MFA_REQUIRED");
                }
                if (!mfaService.isCodeValid(user.getMfaSecret(), request.totp())) {
                    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "INVALID_MFA_CODE");
                }
                if (Boolean.TRUE.equals(request.rememberDevice())) {
                    trustToken = issueTrustToken(user);
                }
            }
        }

        ensureEncryptionSalt(user);
        return new LoginResult(issueToken(user), trustToken);
    }

    public String getOrCreateEncryptionSalt(String username) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        ensureEncryptionSalt(user);
        return user.getEncryptionSalt();
    }

    public String deriveUserKeyBase64(String password, String saltBase64) {
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("Password is required.");
        }
        if (saltBase64 == null || saltBase64.isBlank()) {
            throw new IllegalArgumentException("Encryption salt is required.");
        }
        try {
            byte[] salt = Base64.getDecoder().decode(saltBase64.trim());
            KeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 150_000, 256);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] key = factory.generateSecret(spec).getEncoded();
            return Base64.getEncoder().encodeToString(key);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to derive encryption key.", ex);
        }
    }

    public Map<String, String> setupMfa(String username) {
        User user = getUserFromUsername(username);
        if (Boolean.TRUE.equals(user.getMfaEnabled())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MFA_ALREADY_ENABLED");
        }
        var credentials = mfaService.createCredentials();
        user.setMfaSecret(credentials.getKey());
        user.setMfaEnabled(false);
        user.setMfaEnabledAt(null);
        userRepository.save(user);
        String otpauthUrl = mfaService.buildOtpAuthUrl(user.getUsername(), credentials.getKey());
        return Map.of(
                "secret", credentials.getKey(),
                "otpauthUrl", otpauthUrl);
    }

    public void enableMfa(String username, String code) {
        User user = getUserFromUsername(username);
        if (user.getMfaSecret() == null || user.getMfaSecret().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MFA_NOT_SETUP");
        }
        if (!mfaService.isCodeValid(user.getMfaSecret(), code)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_MFA_CODE");
        }
        user.setMfaEnabled(true);
        user.setMfaEnabledAt(LocalDateTime.now());
        user.setMfaTrustedTokenHash(null);
        user.setMfaTrustedUntil(null);
        userRepository.save(user);
    }

    public void disableMfa(String username, String password, String code) {
        User user = getUserFromUsername(username);
        if (!verifyPassword(password, user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid password.");
        }
        if (Boolean.TRUE.equals(user.getMfaEnabled())) {
            if (!mfaService.isCodeValid(user.getMfaSecret(), code)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_MFA_CODE");
            }
        }
        user.setMfaEnabled(false);
        user.setMfaSecret(null);
        user.setMfaEnabledAt(null);
        user.setMfaTrustedTokenHash(null);
        user.setMfaTrustedUntil(null);
        userRepository.save(user);
    }

    private boolean isTrustedDevice(User user, String trustToken) {
        if (trustToken == null || trustToken.isBlank()) {
            return false;
        }
        if (user.getMfaTrustedTokenHash() == null || user.getMfaTrustedUntil() == null) {
            return false;
        }
        if (user.getMfaTrustedUntil().isBefore(LocalDateTime.now())) {
            return false;
        }
        String hash = hashToken(trustToken);
        return MessageDigest.isEqual(hash.getBytes(StandardCharsets.UTF_8),
                user.getMfaTrustedTokenHash().getBytes(StandardCharsets.UTF_8));
    }

    private String issueTrustToken(User user) {
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        user.setMfaTrustedTokenHash(hashToken(token));
        user.setMfaTrustedUntil(LocalDateTime.now().plusDays(appConfig.getMfaTrustDays()));
        userRepository.save(user);
        return token;
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to hash token", ex);
        }
    }

    private String generateResetToken() {
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(random);
    }

    public User getUserFromUsername(String username) {
        return userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new RuntimeException("User not found."));
    }

    public User updateAiConsent(String username, boolean consent) {
        User user = getUserFromUsername(username);
        user.setAiConsent(consent);
        if (consent) {
            user.setAiConsentAt(java.time.LocalDateTime.now());
            user.setAiConsentVersion(appConfig.getAiConsentVersion());
        } else {
            user.setAiConsentAt(null);
            user.setAiConsentVersion(null);
        }
        return userRepository.save(user);
    }

    private void ensureEncryptionSalt(User user) {
        if (user.getEncryptionSalt() == null || user.getEncryptionSalt().isBlank()) {
            user.setEncryptionSalt(generateEncryptionSalt());
            userRepository.save(user);
        }
    }

    private String generateEncryptionSalt() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    public User updateUserProfile(String username, UpdateUserRequest request) {
        User user = getUserFromUsername(username);
        if (request.username() != null && !request.username().equalsIgnoreCase(user.getUsername())) {
            if (request.username().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is required.");
            }
            if (userRepository.existsByUsernameIgnoreCase(request.username())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists.");
            }
            user.setUsername(request.username());
        }
        if (request.name() != null) {
            user.setName(request.name());
        }
        if (request.email() != null) {
            String normalizedEmail = request.email().trim();
            if (normalizedEmail.isBlank()) {
                user.setEmail(null);
            } else if (!normalizedEmail.equalsIgnoreCase(user.getEmail())
                    && userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists.");
            } else {
                user.setEmail(normalizedEmail);
            }
        }
        if (request.taxId() != null) {
            String normalizedTaxId = request.taxId().trim();
            if (normalizedTaxId.isBlank()) {
                user.setTaxId(null);
            } else {
                String currentTaxId = user.getTaxId();
                if (currentTaxId == null || !currentTaxId.equalsIgnoreCase(normalizedTaxId)) {
                    if (userRepository.existsByTaxIdIgnoreCase(normalizedTaxId)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "Tax ID already exists.");
                    }
                }
                user.setTaxId(normalizedTaxId);
            }
        }
        if (request.language() != null) {
            user.setLanguage(request.language());
        }
        if (request.newPassword() != null) {
            if (request.currentPassword() == null || request.currentPassword().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is required.");
            }
            if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is invalid.");
            }
            user.setPassword(passwordEncoder.encode(request.newPassword()));
        }
        return userRepository.save(user);
    }

    public User updateUsername(String username, String newUsername) {
        User user = getUserFromUsername(username);
        if (newUsername.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is required.");
        }
        if (userRepository.existsByUsernameIgnoreCase(newUsername)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists.");
        }
        user.setUsername(newUsername);
        return userRepository.save(user);
    }

    public void updatePassword(String username, UpdatePasswordRequest request) {
        User user = getUserFromUsername(username);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is invalid.");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    public Map<String, String> requestPasswordReset(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Identifier is required.");
        }
        String normalized = identifier.trim();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(normalized);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByUsernameIgnoreCase(normalized);
        }

        if (userOpt.isEmpty()) {
            return Map.of("status", "ok");
        }

        User user = userOpt.get();
        String token = generateResetToken();
        user.setPasswordResetTokenHash(hashToken(token));
        user.setPasswordResetTokenExpiresAt(LocalDateTime.now().plusMinutes(appConfig.getPasswordResetMinutes()));
        userRepository.save(user);

        String resetLink = appConfig.getFrontendUrl().replaceAll("/+$", "")
                + "/reset-password?token=" + token;
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            emailService.sendPasswordResetEmail(user.getEmail(), resetLink, user.getLanguage());
        }

        if (!appConfig.isMailEnabled() || appConfig.isNotificationsTestEnabled()) {
            return Map.of(
                    "status", "ok",
                    "resetToken", token,
                    "expiresAt", user.getPasswordResetTokenExpiresAt().toString());
        }

        return Map.of("status", "ok");
    }

    public void resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token is required.");
        }
        String tokenHash = hashToken(token.trim());
        User user = userRepository.findByPasswordResetTokenHash(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired token."));
        if (user.getPasswordResetTokenExpiresAt() == null
                || user.getPasswordResetTokenExpiresAt().isBefore(LocalDateTime.now())) {
            user.setPasswordResetTokenHash(null);
            user.setPasswordResetTokenExpiresAt(null);
            userRepository.save(user);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired token.");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordResetTokenHash(null);
        user.setPasswordResetTokenExpiresAt(null);
        userRepository.save(user);
    }

    public void resetPasswordAsAdmin(String username, String newPassword) {
        if (newPassword == null || newPassword.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password is required.");
        }
        User user = getUserFromUsername(username);
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordResetTokenHash(null);
        user.setPasswordResetTokenExpiresAt(null);
        userRepository.save(user);
    }

    public String issueToken(User user) {
        java.security.Key key = io.jsonwebtoken.security.Keys.hmacShaKeyFor(appConfig.getJwtSecret().getBytes());

        return io.jsonwebtoken.Jwts.builder()
                .setSubject(user.getUsername())
                .claim("userId", user.getId())
                .setIssuedAt(new java.util.Date())
                .setExpiration(new java.util.Date(System.currentTimeMillis() + appConfig.getJwtExpiration()))
                .signWith(key)
                .compact();
    }
}
