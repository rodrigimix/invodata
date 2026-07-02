package pt.rodrigimix.invodata.service.system;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.SetupRequest;
import pt.rodrigimix.invodata.dto.SetupStatusResponse;
import pt.rodrigimix.invodata.model.SystemSettings;
import pt.rodrigimix.invodata.repository.SystemSettingsRepository;
import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class SystemSettingsService {
    public static final long SETTINGS_ID = 1L;

    private final SystemSettingsRepository repository;
    private final AppConfig appConfig;
    private final PasswordEncoder passwordEncoder;
    @Autowired
    public SystemSettingsService(SystemSettingsRepository repository, AppConfig appConfig,
            PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.appConfig = appConfig;
        this.passwordEncoder = passwordEncoder;
    }

    public SetupStatusResponse getSetupStatus() {
        SystemSettings settings = repository.findById(SETTINGS_ID).orElse(null);
        if (settings == null) {
            return new SetupStatusResponse(false, "local", defaultLocalPath(), defaultNfsPath(),
                    defaultAiEnabled(), false);
        }
        return new SetupStatusResponse(Boolean.TRUE.equals(settings.getSetupCompleted()),
                normalizeStorageTarget(settings.getStorageTarget()),
                coalesce(settings.getLocalPath(), defaultLocalPath()),
                coalesce(settings.getNfsPath(), defaultNfsPath()),
                Boolean.TRUE.equals(settings.getAiEnabled()),
                Boolean.TRUE.equals(settings.getAllowPublicShares()));
    }

    public SystemSettings completeSetup(SetupRequest request) {
        SystemSettings settings = repository.findById(SETTINGS_ID).orElse(null);
        if (settings != null && Boolean.TRUE.equals(settings.getSetupCompleted())) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "Setup already completed.");
        }
        if (request.adminPassword() == null || request.adminPassword().isBlank() || request.adminPassword().length() < 8) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Admin password must be at least 8 characters.");
        }

        SystemSettings target = Optional.ofNullable(settings).orElseGet(() -> SystemSettings.builder()
                .id(SETTINGS_ID)
                .build());

        target.setAdminPasswordHash(passwordEncoder.encode(request.adminPassword()));
        target.setSetupCompleted(true);
        target.setStorageTarget(normalizeStorageTarget(request.storageTarget()));
        target.setLocalPath(trimOrDefault(request.localPath(), defaultLocalPath()));
        target.setNfsPath(trimOrDefault(request.nfsPath(), defaultNfsPath()));
        target.setAiEnabled(request.aiEnabled() != null ? request.aiEnabled() : defaultAiEnabled());
        target.setAllowPublicShares(request.allowPublicShares() != null && request.allowPublicShares());

        return repository.save(target);
    }

    public boolean isSetupCompleted() {
        return repository.findById(SETTINGS_ID)
                .map(SystemSettings::getSetupCompleted)
                .orElse(false);
    }

    public boolean isAiEnabled() {
        SystemSettings settings = repository.findById(SETTINGS_ID).orElse(null);
        if (settings == null) {
            return defaultAiEnabled();
        }
        return Boolean.TRUE.equals(settings.getAiEnabled());
    }

    public boolean allowPublicShares() {
        return repository.findById(SETTINGS_ID)
                .map(SystemSettings::getAllowPublicShares)
                .orElse(false);
    }

    public boolean updateAllowPublicShares(boolean allowPublicShares) {
        SystemSettings settings = repository.findById(SETTINGS_ID).orElse(null);
        SystemSettings target = Optional.ofNullable(settings).orElseGet(() -> SystemSettings.builder()
                .id(SETTINGS_ID)
                .build());
        target.setAllowPublicShares(allowPublicShares);
        return repository.save(target).getAllowPublicShares();
    }

    public StorageOptions resolveStorage() {
        SystemSettings settings = repository.findById(SETTINGS_ID).orElse(null);
        String target = normalizeStorageTarget(settings != null ? settings.getStorageTarget() : null);
        String localPath = trimOrDefault(settings != null ? settings.getLocalPath() : null, defaultLocalPath());
        String nfsPath = trimOrDefault(settings != null ? settings.getNfsPath() : null, defaultNfsPath());
        String resolvedPath = "nfs".equals(target) ? nfsPath : localPath;
        boolean encryptionEnabled = appConfig.isStorageEncryptionEnabled();
        if ("nfs".equals(target)) {
            encryptionEnabled = false;
        }
        return new StorageOptions(resolvedPath, encryptionEnabled);
    }

    public String getStorageTarget() {
        SystemSettings settings = repository.findById(SETTINGS_ID).orElse(null);
        return normalizeStorageTarget(settings != null ? settings.getStorageTarget() : null);
    }

    public String resolveLocalPath() {
        SystemSettings settings = repository.findById(SETTINGS_ID).orElse(null);
        return trimOrDefault(settings != null ? settings.getLocalPath() : null, defaultLocalPath());
    }

    public String resolveNfsPath() {
        SystemSettings settings = repository.findById(SETTINGS_ID).orElse(null);
        return trimOrDefault(settings != null ? settings.getNfsPath() : null, defaultNfsPath());
    }

    public SystemSettings updateStorageSettings(String storageTarget, String localPath, String nfsPath) {
        String normalizedTarget = storageTarget != null ? storageTarget.trim().toLowerCase() : "";
        if (!"local".equals(normalizedTarget) && !"nfs".equals(normalizedTarget) && !"both".equals(normalizedTarget)) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid storage target.");
        }
        if (("local".equals(normalizedTarget) || "both".equals(normalizedTarget))
                && (localPath == null || localPath.isBlank())) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Local path is required.");
        }
        if (("nfs".equals(normalizedTarget) || "both".equals(normalizedTarget))
                && (nfsPath == null || nfsPath.isBlank())) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "NFS path is required.");
        }

        SystemSettings settings = repository.findById(SETTINGS_ID).orElse(null);
        SystemSettings target = Optional.ofNullable(settings).orElseGet(() -> SystemSettings.builder()
                .id(SETTINGS_ID)
                .build());
        target.setStorageTarget(normalizedTarget);
        target.setLocalPath(trimOrDefault(localPath, defaultLocalPath()));
        target.setNfsPath(trimOrDefault(nfsPath, defaultNfsPath()));
        return repository.save(target);
    }

    public boolean validateAdminPassword(String provided) {
        if (provided == null || provided.isBlank()) {
            return false;
        }
        SystemSettings settings = repository.findById(SETTINGS_ID).orElse(null);
        if (settings != null && settings.getAdminPasswordHash() != null && !settings.getAdminPasswordHash().isBlank()) {
            return passwordEncoder.matches(provided, settings.getAdminPasswordHash());
        }
        String legacy = appConfig.getAdminStatsPassword();
        return legacy != null && !legacy.isBlank() && legacy.equals(provided);
    }

    public Path storeAiCredentials(MultipartFile file, String providedPassword, boolean allowWhenIncomplete) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Credentials file is required.");
        }
        if (!allowWhenIncomplete || isSetupCompleted()) {
            if (!validateAdminPassword(providedPassword)) {
                throw new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN,
                        "Invalid admin password.");
            }
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".json")) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Credentials must be a JSON file.");
        }

        Path target = Path.of(appConfig.getAiCredentialsPath());
        try {
            if (target.getParent() != null) {
                Files.createDirectories(target.getParent());
            }
            file.transferTo(target);
        } catch (Exception ex) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to store credentials.");
        }
        return target;
    }

    private String defaultLocalPath() {
        return trimOrDefault(appConfig.getMedia_path(), "mnt/invodata/");
    }

    private String defaultNfsPath() {
        return "/data/local";
    }

    private boolean defaultAiEnabled() {
        return appConfig.getAiEnabled() != null && appConfig.getAiEnabled();
    }

    private String trimOrDefault(String value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String trimmed = value.trim();
        return trimmed.isBlank() ? fallback : trimmed;
    }

    private String coalesce(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String normalizeStorageTarget(String value) {
        if (value == null) {
            return "local";
        }
        String normalized = value.trim().toLowerCase();
        if ("nfs".equals(normalized) || "both".equals(normalized)) {
            return normalized;
        }
        return "local";
    }

    public record StorageOptions(String mediaPath, boolean encryptionEnabled) {
    }
}
