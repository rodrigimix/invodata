package pt.rodrigimix.invodata.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.dto.AdminStorageSettings;
import pt.rodrigimix.invodata.model.SystemSettings;
import pt.rodrigimix.invodata.service.system.SystemSettingsService;

@RestController
@RequestMapping("/api/admin/storage")
@CrossOrigin("*")
public class AdminStorageController {
    private final SystemSettingsService settingsService;

    public AdminStorageController(SystemSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public ResponseEntity<AdminStorageSettings> getSettings(
            @RequestHeader(value = "X-Admin-Password", required = false) String headerPassword,
            @RequestParam(value = "password", required = false) String queryPassword) {
        validatePassword(headerPassword, queryPassword);
        return ResponseEntity.ok(currentSettings());
    }

    @PutMapping
    public ResponseEntity<AdminStorageSettings> updateSettings(
            @RequestHeader(value = "X-Admin-Password", required = false) String headerPassword,
            @RequestParam(value = "password", required = false) String queryPassword,
            @RequestBody AdminStorageSettings request) {
        validatePassword(headerPassword, queryPassword);
        SystemSettings updated = settingsService.updateStorageSettings(
                request.storageTarget(),
                request.localPath(),
                request.nfsPath());
        return ResponseEntity.ok(new AdminStorageSettings(
                updated.getStorageTarget(),
                updated.getLocalPath(),
                updated.getNfsPath()));
    }

    private void validatePassword(String headerPassword, String queryPassword) {
        String provided = (headerPassword != null && !headerPassword.isBlank()) ? headerPassword : queryPassword;
        if (!settingsService.validateAdminPassword(provided)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN, "Invalid admin password.");
        }
    }

    private AdminStorageSettings currentSettings() {
        return new AdminStorageSettings(
                settingsService.getStorageTarget(),
                settingsService.resolveLocalPath(),
                settingsService.resolveNfsPath());
    }
}
