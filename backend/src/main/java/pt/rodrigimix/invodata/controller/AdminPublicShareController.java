package pt.rodrigimix.invodata.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.dto.AdminPublicShareSettings;
import pt.rodrigimix.invodata.service.system.SystemSettingsService;

@RestController
@RequestMapping("/api/admin/public-shares")
@CrossOrigin("*")
public class AdminPublicShareController {
    private final SystemSettingsService settingsService;

    public AdminPublicShareController(SystemSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public ResponseEntity<AdminPublicShareSettings> getSettings(
            @RequestHeader(value = "X-Admin-Password", required = false) String headerPassword,
            @RequestParam(value = "password", required = false) String queryPassword) {
        ensureAdmin(headerPassword, queryPassword);
        return ResponseEntity.ok(new AdminPublicShareSettings(settingsService.allowPublicShares()));
    }

    @PutMapping
    public ResponseEntity<AdminPublicShareSettings> updateSettings(
            @RequestHeader(value = "X-Admin-Password", required = false) String headerPassword,
            @RequestParam(value = "password", required = false) String queryPassword,
            @Valid @RequestBody AdminPublicShareSettings request) {
        ensureAdmin(headerPassword, queryPassword);
        boolean updated = settingsService.updateAllowPublicShares(request.allowPublicShares());
        return ResponseEntity.ok(new AdminPublicShareSettings(updated));
    }

    private void ensureAdmin(String headerPassword, String queryPassword) {
        String provided = (headerPassword != null && !headerPassword.isBlank()) ? headerPassword : queryPassword;
        if (!settingsService.validateAdminPassword(provided)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid admin password.");
        }
    }
}
