package pt.rodrigimix.invodata.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.dto.LoginRequest;
import pt.rodrigimix.invodata.dto.LoginResult;
import pt.rodrigimix.invodata.dto.RegisterRequest;
import pt.rodrigimix.invodata.dto.ForgotPasswordRequest;
import pt.rodrigimix.invodata.dto.ResetPasswordRequest;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.user.UserService;

import jakarta.validation.Valid;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin("*")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            User newUser = userService.register(request);
            String token = userService.issueToken(newUser);
            return ResponseEntity.ok(Map.of(
                    "message", "User created successfully!",
                    "token", token,
                    "user", newUser));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", Map.of(
                            "code", "AUTH_REGISTER_FAILED",
                            "message", e.getMessage())));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            LoginResult login = userService.login(request);
            User user = userService.getUserFromUsername(request.username());
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("token", login.token());
            body.put("user", user);
            if (login.mfaTrustToken() != null) {
                body.put("mfaTrustToken", login.mfaTrustToken());
            }
            return ResponseEntity.ok(body);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(Map.of(
                    "error", Map.of(
                            "code", "AUTH_MFA_REQUIRED",
                            "message", e.getReason())));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", Map.of(
                            "code", "AUTH_INVALID_CREDENTIALS",
                            "message", e.getMessage())));
        }
    }

    @GetMapping("/salt")
    public ResponseEntity<?> getEncryptionSalt(@RequestParam("username") String username) {
        if (username == null || username.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", Map.of(
                            "code", "AUTH_SALT_REQUIRED",
                            "message", "Username is required")));
        }
        String salt = userService.getOrCreateEncryptionSalt(username.trim());
        return ResponseEntity.ok(Map.of("salt", salt));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        Map<String, String> response = userService.requestPasswordReset(request.identifier());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        userService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
