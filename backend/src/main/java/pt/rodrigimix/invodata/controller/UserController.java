package pt.rodrigimix.invodata.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.dto.AiConsentRequest;
import pt.rodrigimix.invodata.dto.AccountUpdateRequest;
import pt.rodrigimix.invodata.dto.MfaCodeRequest;
import pt.rodrigimix.invodata.dto.MfaDisableRequest;
import pt.rodrigimix.invodata.dto.PasswordConfirmRequest;
import pt.rodrigimix.invodata.dto.UpdatePasswordRequest;
import pt.rodrigimix.invodata.dto.UpdateUserRequest;
import pt.rodrigimix.invodata.dto.UpdateUsernameRequest;
import pt.rodrigimix.invodata.service.account.AccountService;
import pt.rodrigimix.invodata.service.audit.AuditLogService;
import pt.rodrigimix.invodata.service.user.DataPrivacyService;
import pt.rodrigimix.invodata.service.user.EncryptionMigrationService;
import pt.rodrigimix.invodata.service.user.UserService;
import pt.rodrigimix.invodata.security.encryption.UserKeyContext;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@CrossOrigin("*")
@Validated
public class UserController {

    private final UserService userService;

    private final AccountService accountService;

    private final DataPrivacyService dataPrivacyService;

    private final AuditLogService auditLogService;

    private final EncryptionMigrationService encryptionMigrationService;

    @Autowired
    public UserController(UserService userService, AccountService accountService,
            DataPrivacyService dataPrivacyService,
            AuditLogService auditLogService,
            EncryptionMigrationService encryptionMigrationService) {
        this.userService = userService;
        this.accountService = accountService;
        this.dataPrivacyService = dataPrivacyService;
        this.auditLogService = auditLogService;
        this.encryptionMigrationService = encryptionMigrationService;
    }

    @GetMapping("/")
    public ResponseEntity<User> getUser(Principal principal) {
        return ResponseEntity.ok(userService.getUserFromUsername(principal.getName()));
    }

    @PutMapping
    public ResponseEntity<Map<String, Object>> updateUser(@Valid @RequestBody UpdateUserRequest request,
            Principal principal) {
        String currentUsername = principal.getName();
        User updated = userService.updateUserProfile(currentUsername, request);
        Map<String, Object> response = new java.util.HashMap<>();
        response.put("user", updated);
        if (!updated.getUsername().equalsIgnoreCase(currentUsername)) {
            response.put("token", userService.issueToken(updated));
        }
        return ResponseEntity.ok(response);
    }

    @PutMapping("/username")
    public ResponseEntity<Map<String, Object>> updateUsername(@Valid @RequestBody UpdateUsernameRequest request,
            Principal principal) {
        User updated = userService.updateUsername(principal.getName(), request.username());
        String token = userService.issueToken(updated);
        return ResponseEntity.ok(Map.of("user", updated, "token", token));
    }

    @PutMapping("/password")
    public ResponseEntity<Map<String, String>> updatePassword(@Valid @RequestBody UpdatePasswordRequest request,
            Principal principal) {
        userService.updatePassword(principal.getName(), request);
        return ResponseEntity.ok(Map.of("message", "Password updated successfully."));
    }

    @PostMapping("/account")
    public ResponseEntity<Account> createAccount(@RequestBody Account account, Principal principal) {
        if (accountService.getAccountByName(account.getName(),
                userService.getUserFromUsername(principal.getName())) != null) {
            return ResponseEntity.status(400).body(null);
        }
        User user = userService.getUserFromUsername(principal.getName());
        account.setUser(user);
        return ResponseEntity.ok(accountService.createAccount(account));
    }

    @GetMapping("/account")
    public ResponseEntity<List<Account>> getAccounts(Principal principal) {
        return ResponseEntity
                .ok(accountService.getAccountsByUser(userService.getUserFromUsername(principal.getName())));
    }

    @GetMapping("/account/{id}")
    public ResponseEntity<Account> getAccountById(Principal principal, @PathVariable Long id) {
        return ResponseEntity
                .ok(accountService.getAccountById(id, userService.getUserFromUsername(principal.getName())));
    }

    @PutMapping("/account/{id}")
    public ResponseEntity<Account> updateAccount(@PathVariable Long id,
            @RequestBody AccountUpdateRequest request,
            Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(accountService.updateAccount(id, request, user));
    }

    @DeleteMapping("/account/{id}")
    public ResponseEntity<Void> deleteAccount(@PathVariable Long id, Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        accountService.deleteAccount(id, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/export", produces = "application/zip")
    public ResponseEntity<byte[]> exportUserData(@Valid @RequestBody PasswordConfirmRequest request,
            Principal principal) {
        ensurePassword(principal, request);
        User user = userService.getUserFromUsername(principal.getName());
        String salt = userService.getOrCreateEncryptionSalt(user.getUsername());
        String derivedKey = userService.deriveUserKeyBase64(request.password(), salt);
        UserKeyContext.setKeyFromBase64(derivedKey);
        try {
            auditLogService.log(principal.getName(), "DATA_EXPORT", Map.of("format", "zip"));
            byte[] zip = dataPrivacyService.exportUserDataZip(principal.getName());
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"user-data.zip\"")
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .contentLength(zip.length)
                    .body(zip);
        } finally {
            UserKeyContext.clear();
        }
    }

    @DeleteMapping
    public ResponseEntity<Map<String, String>> deleteUser(@Valid @RequestBody PasswordConfirmRequest request,
            Principal principal) {
        ensurePassword(principal, request);
        auditLogService.log(principal.getName(), "DATA_DELETE", Map.of("scope", "user"));
        dataPrivacyService.deleteUserData(principal.getName());
        return ResponseEntity.ok(Map.of("message", "User deleted successfully."));
    }

    @GetMapping("/consent")
    public ResponseEntity<Map<String, Object>> getAiConsent(Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(Map.of("ai_consent", user.getAiConsent()));
    }

    @PutMapping("/consent")
    public ResponseEntity<Map<String, Object>> updateAiConsent(Principal principal,
            @RequestBody AiConsentRequest request) {
        User user = userService.updateAiConsent(principal.getName(), request.consent());
        auditLogService.log(principal.getName(), "AI_CONSENT_CHANGED", Map.of(
                "consent", user.getAiConsent(),
                "version", user.getAiConsentVersion(),
                "timestamp", user.getAiConsentAt()));
        return ResponseEntity.ok(Map.of("ai_consent", user.getAiConsent()));
    }

    @PostMapping("/migrate-encryption")
    public ResponseEntity<Map<String, Object>> migrateEncryption(Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        Map<String, Object> result = encryptionMigrationService.migrateUserData(user);
        auditLogService.log(principal.getName(), "ENCRYPTION_MIGRATION", result);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/mfa/setup")
    public ResponseEntity<Map<String, String>> setupMfa(Principal principal) {
        return ResponseEntity.ok(userService.setupMfa(principal.getName()));
    }

    @PostMapping("/mfa/enable")
    public ResponseEntity<Map<String, String>> enableMfa(Principal principal,
            @Valid @RequestBody MfaCodeRequest request) {
        userService.enableMfa(principal.getName(), request.code());
        auditLogService.log(principal.getName(), "MFA_ENABLED", Map.of());
        return ResponseEntity.ok(Map.of("status", "enabled"));
    }

    @PostMapping("/mfa/disable")
    public ResponseEntity<Map<String, String>> disableMfa(Principal principal,
            @Valid @RequestBody MfaDisableRequest request) {
        userService.disableMfa(principal.getName(), request.password(), request.code());
        auditLogService.log(principal.getName(), "MFA_DISABLED", Map.of());
        return ResponseEntity.ok(Map.of("status", "disabled"));
    }

    private void ensurePassword(Principal principal, PasswordConfirmRequest request) {
        if (request == null || request.password() == null || request.password().isBlank()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Password is required.");
        }
        User user = userService.getUserFromUsername(principal.getName());
        if (!userService.verifyPassword(request.password(), user.getPassword())) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Invalid password.");
        }
    }

}
