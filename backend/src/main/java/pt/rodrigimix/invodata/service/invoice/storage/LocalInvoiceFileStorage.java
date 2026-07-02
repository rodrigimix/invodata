package pt.rodrigimix.invodata.service.invoice.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.InvoiceFileData;
import pt.rodrigimix.invodata.security.encryption.UserKeyContext;
import pt.rodrigimix.invodata.service.system.SystemSettingsService;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

@Service
@ConditionalOnProperty(name = "invodata.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalInvoiceFileStorage implements InvoiceFileStorage {

    private final Logger logger = LoggerFactory.getLogger(LocalInvoiceFileStorage.class);
    private final AppConfig appConfig;
    private final SystemSettingsService settingsService;

    public LocalInvoiceFileStorage(AppConfig appConfig, SystemSettingsService settingsService) {
        this.appConfig = appConfig;
        this.settingsService = settingsService;
    }

    @Override
    public String save(String contentType, byte[] contents, InvoiceFilePathContext context) {
        try {
            String fileId = buildUniquePath(contentType, context);
            Path targetPath = Path.of(resolveMediaPath(), fileId);
            ensureDirectory(targetPath.getParent());
            if (Files.exists(targetPath)) {
                logger.warn("File already exists.");
                return fileId;
            }
            byte[] toWrite = encryptIfConfigured(contents);
            Files.write(targetPath, toWrite);
            writeSecondaryCopy(fileId, contents);
            logger.info("File saved.");
            return fileId;
        } catch (Exception e) {
            logger.error("Failed to save file", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save file.");
        }
    }

    @Override
    public String move(String fileId, InvoiceFilePathContext context) {
        if (fileId == null || fileId.isBlank()) {
            return fileId;
        }
        try {
            String extension = InvoiceFilePathBuilder.extensionFromFilename(fileId);
            String targetId = buildUniquePathFromExtension(extension, context);
            if (targetId.equals(fileId)) {
                return fileId;
            }
            movePath(Path.of(resolveMediaPath(), fileId), Path.of(resolveMediaPath(), targetId));
            moveSecondaryCopy(fileId, targetId);
            return targetId;
        } catch (Exception e) {
            logger.warn("Failed to move file {}: {}", fileId, e.getMessage());
            return fileId;
        }
    }

    @Override
    public InvoiceFileData load(String fileId) {
        Path path = Path.of(resolveMediaPath(), fileId);
        if (!Files.exists(path)) {
            Path fallback = resolveFallbackPath(fileId);
            if (fallback == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found.");
            }
            path = fallback;
        }
        try {
            byte[] content = Files.readAllBytes(path);
            content = decryptIfConfigured(content, path);
            String contentType = Files.probeContentType(path);
            if (contentType == null) {
                contentType = inferContentType(fileId);
            }
            String filename = Path.of(fileId).getFileName().toString();
            return new InvoiceFileData(content, filename, contentType);
        } catch (pt.rodrigimix.invodata.security.encryption.MissingUserKeyException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load file.");
        }
    }

    @Override
    public void delete(String fileId) {
        try {
            Path path = Path.of(resolveMediaPath(), fileId);
            Files.deleteIfExists(path);
            deleteSecondaryCopy(fileId);
        } catch (Exception ignored) {
            // Best-effort delete to avoid breaking request.
        }
    }

    private byte[] encryptIfConfigured(byte[] contents) {
        SecretKey key = resolveKey();
        if (key == null) {
            return contents;
        }
        return InvoiceFileCrypto.encrypt(contents, key);
    }

    private byte[] decryptIfConfigured(byte[] contents, Path path) {
        SecretKey userKey = resolveKey();
        if (userKey == null) {
            return contents;
        }
        try {
            return InvoiceFileCrypto.decryptIfEncrypted(contents, userKey);
        } catch (IllegalStateException ex) {
            SecretKey legacyKey = resolveLegacyKey();
            if (legacyKey == null) {
                throw ex;
            }
            byte[] decrypted = InvoiceFileCrypto.decryptIfEncrypted(contents, legacyKey);
            try {
                byte[] rotated = InvoiceFileCrypto.encrypt(decrypted, userKey);
                Files.write(path, rotated);
            } catch (Exception ignored) {
                // Best-effort rotation; keep serving decrypted bytes.
            }
            return decrypted;
        }
    }

    private SecretKey resolveKey() {
        if (!isEncryptionEnabled()) {
            return null;
        }
        byte[] keyBytes = UserKeyContext.requireKey();
        return new SecretKeySpec(keyBytes, "AES");
    }

    private SecretKey resolveLegacyKey() {
        String legacy = appConfig.getStorageEncryptionKey();
        if (legacy == null || legacy.isBlank()) {
            return null;
        }
        byte[] decoded = Base64.getDecoder().decode(legacy.trim());
        if (decoded.length != 32) {
            throw new IllegalStateException("Invalid legacy storage key length.");
        }
        return new SecretKeySpec(decoded, "AES");
    }

    private String inferContentType(String fileId) {
        if (fileId == null) {
            return "application/octet-stream";
        }
        String lower = fileId.toLowerCase();
        if (lower.endsWith(".pdf")) {
            return "application/pdf";
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        return "application/octet-stream";
    }

    private String resolveMediaPath() {
        return settingsService.resolveStorage().mediaPath();
    }

    private void ensureDirectory(Path path) throws Exception {
        if (path == null) {
            return;
        }
        if (!Files.exists(path)) {
            Files.createDirectories(path);
            logger.info("Created media directory.");
        }
    }

    private void writeSecondaryCopy(String fileId, byte[] bytes) {
        if (!"both".equals(settingsService.getStorageTarget())) {
            return;
        }
        try {
            Path nfsPath = Paths.get(settingsService.resolveNfsPath(), fileId);
            ensureDirectory(nfsPath.getParent());
            if (Files.exists(nfsPath)) {
                return;
            }
            Files.write(nfsPath, bytes);
        } catch (Exception ex) {
            logger.warn("Failed to write secondary copy: {}", ex.getMessage());
        }
    }

    private void moveSecondaryCopy(String fileId, String targetId) {
        if (!"both".equals(settingsService.getStorageTarget())) {
            return;
        }
        try {
            Path source = Path.of(settingsService.resolveNfsPath(), fileId);
            Path target = Path.of(settingsService.resolveNfsPath(), targetId);
            movePath(source, target);
        } catch (Exception ignored) {
            // Best-effort move.
        }
    }

    private Path resolveFallbackPath(String fileId) {
        if (!"both".equals(settingsService.getStorageTarget())) {
            return null;
        }
        Path nfsPath = Path.of(settingsService.resolveNfsPath(), fileId);
        return Files.exists(nfsPath) ? nfsPath : null;
    }

    private void deleteSecondaryCopy(String fileId) {
        if (!"both".equals(settingsService.getStorageTarget())) {
            return;
        }
        try {
            Path path = Path.of(settingsService.resolveNfsPath(), fileId);
            Files.deleteIfExists(path);
        } catch (Exception ignored) {
            // Best-effort delete.
        }
    }

    private String buildUniquePath(String contentType, InvoiceFilePathContext context) throws Exception {
        String directory = InvoiceFilePathBuilder.buildDirectory(context);
        String baseName = InvoiceFilePathBuilder.buildBaseName(context);
        String extension = InvoiceFilePathBuilder.extensionFromMimeType(contentType);
        return buildUniquePath(directory, baseName, extension);
    }

    private String buildUniquePathFromExtension(String extension, InvoiceFilePathContext context) throws Exception {
        String directory = InvoiceFilePathBuilder.buildDirectory(context);
        String baseName = InvoiceFilePathBuilder.buildBaseName(context);
        return buildUniquePath(directory, baseName, extension);
    }

    private String buildUniquePath(String directory, String baseName, String extension) throws Exception {
        String candidate = directory + "/" + baseName + extension;
        Path root = Paths.get(resolveMediaPath());
        if (!Files.exists(root.resolve(candidate))) {
            return candidate;
        }
        for (int counter = 2; counter <= 999; counter++) {
            String attempt = directory + "/" + baseName + "_" + counter + extension;
            if (!Files.exists(root.resolve(attempt))) {
                return attempt;
            }
        }
        return directory + "/" + baseName + "_" + System.currentTimeMillis() + extension;
    }

    private void movePath(Path source, Path target) throws Exception {
        if (!Files.exists(source)) {
            return;
        }
        ensureDirectory(target.getParent());
        Files.move(source, target);
    }

    private boolean isEncryptionEnabled() {
        return settingsService.resolveStorage().encryptionEnabled();
    }
}
