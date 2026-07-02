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
import pt.rodrigimix.invodata.dto.PasswordConfirmRequest;
import pt.rodrigimix.invodata.dto.UpdatePasswordRequest;
import pt.rodrigimix.invodata.dto.UpdateUserRequest;
import pt.rodrigimix.invodata.dto.UpdateUsernameRequest;
import pt.rodrigimix.invodata.service.account.AccountService;
import pt.rodrigimix.invodata.service.user.DataPrivacyService;
import pt.rodrigimix.invodata.service.user.UserService;

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

    @Autowired
    public UserController(UserService userService, AccountService accountService,
            DataPrivacyService dataPrivacyService) {
        this.userService = userService;
        this.accountService = accountService;
        this.dataPrivacyService = dataPrivacyService;
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
        byte[] zip = dataPrivacyService.exportUserDataZip(principal.getName());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"user-data.zip\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(zip.length)
                .body(zip);
    }

    @DeleteMapping
    public ResponseEntity<Map<String, String>> deleteUser(@Valid @RequestBody PasswordConfirmRequest request,
            Principal principal) {
        ensurePassword(principal, request);
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
        return ResponseEntity.ok(Map.of("ai_consent", user.getAiConsent()));
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
