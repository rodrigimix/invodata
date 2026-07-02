package pt.rodrigimix.invodata.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.dto.LoginRequest;
import pt.rodrigimix.invodata.dto.RegisterRequest;
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
                    "user", newUser
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", Map.of(
                            "code", "AUTH_REGISTER_FAILED",
                            "message", e.getMessage()
                    )
            ));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            String token = userService.login(request);
            User user = userService.getUserFromUsername(request.username());
            return ResponseEntity.ok(Map.of("token", token, "user", user));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", Map.of(
                            "code", "AUTH_INVALID_CREDENTIALS",
                            "message", e.getMessage()
                    )
            ));
        }
    }
}
