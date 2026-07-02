package pt.rodrigimix.invodata.service.user;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.LoginRequest;
import pt.rodrigimix.invodata.dto.RegisterRequest;
import pt.rodrigimix.invodata.dto.UpdatePasswordRequest;
import pt.rodrigimix.invodata.dto.UpdateUserRequest;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.UserRepository;

@Service
public class UserService {
    private final UserRepository userRepository;

    private final PasswordEncoder passwordEncoder;

    private final AppConfig appConfig;

    @Autowired
    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, AppConfig appConfig) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.appConfig = appConfig;
    }

    public User register(RegisterRequest request) {
        if (!appConfig.getRegistrationKey().equals(request.adminKey())) {
            throw new RuntimeException("Invalid Admin Key! Access denied.");
        }
        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new RuntimeException("User already exists.");
        }
        if (request.email() != null && userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists.");
        }
        String normalizedTaxId = request.taxId() != null ? request.taxId().trim() : null;
        if (normalizedTaxId != null && !normalizedTaxId.isBlank()
                && userRepository.existsByTaxIdIgnoreCase(normalizedTaxId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tax ID already exists.");
        }

        User user = User.builder()
                .username(request.username())
                .password(passwordEncoder.encode(request.password()))
                .email(request.email())
                .name(request.name())
                .taxId(normalizedTaxId != null && !normalizedTaxId.isBlank() ? normalizedTaxId : null)
                .aiConsent(Boolean.TRUE.equals(request.aiConsent()))
                .build();
        return userRepository.save(user);
    }

    public boolean verifyPassword(String rawPassword, String encodedPassword) {
        return passwordEncoder.matches(rawPassword, encodedPassword);
    }

    public String login(LoginRequest request) {
        User user = userRepository.findByUsernameIgnoreCase(request.username())
                .orElseThrow(() -> new RuntimeException("User not found."));

        if (!verifyPassword(request.password(), user.getPassword())) {
            throw new RuntimeException("Invalid credentials.");
        }

        return issueToken(user);
    }

    public User getUserFromUsername(String username) {
        return userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new RuntimeException("User not found."));
    }

    public User updateAiConsent(String username, boolean consent) {
        User user = getUserFromUsername(username);
        user.setAiConsent(consent);
        return userRepository.save(user);
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
            if (!request.email().equalsIgnoreCase(user.getEmail())
                    && userRepository.existsByEmailIgnoreCase(request.email())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists.");
            }
            user.setEmail(request.email());
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
