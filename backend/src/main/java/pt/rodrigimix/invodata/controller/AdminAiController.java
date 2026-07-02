package pt.rodrigimix.invodata.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pt.rodrigimix.invodata.service.system.SystemSettingsService;

@RestController
@RequestMapping("/api/admin/ai-credentials")
@CrossOrigin("*")
public class AdminAiController {
    private final SystemSettingsService settingsService;

    public AdminAiController(SystemSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @PostMapping
    public ResponseEntity<Void> uploadCredentials(
            @RequestHeader(value = "X-Admin-Password", required = false) String headerPassword,
            @RequestParam(value = "password", required = false) String queryPassword,
            @RequestPart("file") MultipartFile file) {
        String provided = (headerPassword != null && !headerPassword.isBlank()) ? headerPassword : queryPassword;
        settingsService.storeAiCredentials(file, provided, false);
        return ResponseEntity.noContent().build();
    }
}
