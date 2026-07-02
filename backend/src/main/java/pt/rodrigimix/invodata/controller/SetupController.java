package pt.rodrigimix.invodata.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pt.rodrigimix.invodata.dto.SetupRequest;
import pt.rodrigimix.invodata.dto.SetupStatusResponse;
import pt.rodrigimix.invodata.service.system.SystemSettingsService;

@RestController
@RequestMapping("/api/setup")
@CrossOrigin("*")
public class SetupController {
    private final SystemSettingsService settingsService;

    public SetupController(SystemSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping("/status")
    public ResponseEntity<SetupStatusResponse> getStatus() {
        return ResponseEntity.ok(settingsService.getSetupStatus());
    }

    @PostMapping
    public ResponseEntity<SetupStatusResponse> completeSetup(@Valid @RequestBody SetupRequest request) {
        settingsService.completeSetup(request);
        return ResponseEntity.ok(settingsService.getSetupStatus());
    }

    @PostMapping("/ai-credentials")
    public ResponseEntity<Void> uploadAiCredentials(
            @RequestHeader(value = "X-Admin-Password", required = false) String headerPassword,
            @RequestParam(value = "password", required = false) String queryPassword,
            @RequestPart("file") MultipartFile file) {
        String provided = (headerPassword != null && !headerPassword.isBlank()) ? headerPassword : queryPassword;
        settingsService.storeAiCredentials(file, provided, true);
        return ResponseEntity.noContent().build();
    }
}
