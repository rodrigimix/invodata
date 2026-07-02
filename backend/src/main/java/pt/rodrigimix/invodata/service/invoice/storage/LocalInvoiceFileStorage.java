package pt.rodrigimix.invodata.service.invoice.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.InvoiceFileData;

import java.io.File;
import java.nio.file.InvalidPathException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;

@Service
@ConditionalOnProperty(name = "invodata.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalInvoiceFileStorage implements InvoiceFileStorage {

    private final Logger logger = LoggerFactory.getLogger(LocalInvoiceFileStorage.class);
    private final AppConfig appConfig;

    public LocalInvoiceFileStorage(AppConfig appConfig) {
        this.appConfig = appConfig;
    }

    @Override
    public String save(String contentType, byte[] contents, String preferredPath) {
        try {
            String fallbackFileId = InvoiceFileId.build(contentType, contents);
            String fileId = normalizeStorageKey(preferredPath, fallbackFileId);

            Path rootPath = Paths.get(appConfig.getMedia_path()).toAbsolutePath().normalize();
            if (!Files.exists(rootPath)) {
                Files.createDirectories(rootPath);
                logger.info("Created media directory.");
            }

            String currentFileId = fileId;
            int collisionIndex = 1;
            while (true) {
                Path candidatePath = resolveStoragePath(rootPath, currentFileId);
                Path parent = candidatePath.getParent();
                if (parent != null && !Files.exists(parent)) {
                    Files.createDirectories(parent);
                }

                File file = candidatePath.toFile();
                if (!file.exists()) {
                    Files.write(candidatePath, contents);
                    logger.info("Ficheiro gravado com sucesso em: {}", candidatePath);
                    return currentFileId;
                }

                byte[] existingBytes = Files.readAllBytes(candidatePath);
                if (Arrays.equals(existingBytes, contents)) {
                    logger.warn("File already exists.");
                    return currentFileId;
                }

                currentFileId = withCollisionSuffix(fileId, collisionIndex++);
            }
        } catch (Exception e) {
            logger.error("Failed to save file", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save file.");
        }
    }

    @Override
    public InvoiceFileData load(String fileId) {
        Path path = Path.of(appConfig.getMedia_path(), fileId);
        if (!Files.exists(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found.");
        }
        try {
            byte[] content = Files.readAllBytes(path);
            String contentType = Files.probeContentType(path);
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
            return new InvoiceFileData(content, path.getFileName().toString(), contentType);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load file.");
        }
    }

    @Override
    public void delete(String fileId) {
        try {
            Path path = Path.of(appConfig.getMedia_path(), fileId);
            Files.deleteIfExists(path);
        } catch (Exception ignored) {
            // Best-effort delete to avoid breaking request.
        }
    }

    private String normalizeStorageKey(String preferredPath, String fallbackFileId) {
        if (preferredPath == null || preferredPath.isBlank()) {
            return fallbackFileId;
        }
        String normalized = preferredPath
                .replace('\\', '/')
                .replaceAll("^/+", "")
                .replaceAll("/+", "/");
        if (normalized.contains("..") || normalized.isBlank()) {
            return fallbackFileId;
        }
        return normalized;
    }

    private Path resolveStoragePath(Path rootPath, String fileId) {
        try {
            Path candidate = rootPath.resolve(fileId).normalize();
            if (!candidate.startsWith(rootPath)) {
                throw new IllegalArgumentException("Invalid storage path.");
            }
            return candidate;
        } catch (InvalidPathException ex) {
            throw new IllegalArgumentException("Invalid storage path.", ex);
        }
    }

    private String withCollisionSuffix(String fileId, int index) {
        int slash = fileId.lastIndexOf('/');
        String directory = slash >= 0 ? fileId.substring(0, slash + 1) : "";
        String name = slash >= 0 ? fileId.substring(slash + 1) : fileId;
        int dot = name.lastIndexOf('.');
        if (dot <= 0) {
            return directory + name + "-" + index;
        }
        String base = name.substring(0, dot);
        String ext = name.substring(dot);
        return directory + base + "-" + index + ext;
    }
}
