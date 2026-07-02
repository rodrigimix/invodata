package pt.rodrigimix.invodata.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.dto.AdminResetPasswordRequest;
import pt.rodrigimix.invodata.dto.AdminUserResponse;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.UserRepository;
import pt.rodrigimix.invodata.service.system.SystemSettingsService;
import pt.rodrigimix.invodata.service.user.DataPrivacyService;
import pt.rodrigimix.invodata.service.user.UserService;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@CrossOrigin("*")
public class AdminUserController {
    private final SystemSettingsService settingsService;
    private final UserRepository userRepository;
    private final UserService userService;
    private final DataPrivacyService dataPrivacyService;

    public AdminUserController(SystemSettingsService settingsService, UserRepository userRepository,
            UserService userService, DataPrivacyService dataPrivacyService) {
        this.settingsService = settingsService;
        this.userRepository = userRepository;
        this.userService = userService;
        this.dataPrivacyService = dataPrivacyService;
    }

    @GetMapping
    public ResponseEntity<List<AdminUserResponse>> listUsers(
            @RequestHeader(value = "X-Admin-Password", required = false) String headerPassword,
            @RequestParam(value = "password", required = false) String queryPassword) {
        ensureAdmin(headerPassword, queryPassword);
        List<AdminUserResponse> users = userRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(users);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(
            @RequestHeader(value = "X-Admin-Password", required = false) String headerPassword,
            @RequestParam(value = "password", required = false) String queryPassword,
            @Valid @RequestBody AdminResetPasswordRequest request) {
        ensureAdmin(headerPassword, queryPassword);
        userService.resetPasswordAsAdmin(request.username(), request.newPassword());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{username}")
    public ResponseEntity<Void> deleteUser(
            @RequestHeader(value = "X-Admin-Password", required = false) String headerPassword,
            @RequestParam(value = "password", required = false) String queryPassword,
            @PathVariable String username) {
        ensureAdmin(headerPassword, queryPassword);
        dataPrivacyService.deleteUserData(username);
        return ResponseEntity.noContent().build();
    }

    private void ensureAdmin(String headerPassword, String queryPassword) {
        String provided = (headerPassword != null && !headerPassword.isBlank()) ? headerPassword : queryPassword;
        if (!settingsService.validateAdminPassword(provided)) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Invalid admin password.");
        }
    }

    private AdminUserResponse toResponse(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getUsername(),
                user.getName(),
                user.getEmail(),
                user.getCreatedAt());
    }
}
