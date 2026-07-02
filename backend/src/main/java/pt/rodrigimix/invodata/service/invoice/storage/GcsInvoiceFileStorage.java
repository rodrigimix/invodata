package pt.rodrigimix.invodata.service.invoice.storage;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.InvoiceFileData;

@Service
@ConditionalOnProperty(name = "invodata.storage.type", havingValue = "gcs")
public class GcsInvoiceFileStorage implements InvoiceFileStorage {

    private final Logger logger = LoggerFactory.getLogger(GcsInvoiceFileStorage.class);
    private final Storage storage;
    private final String bucketName;

    public GcsInvoiceFileStorage(AppConfig appConfig) {
        this.storage = StorageOptions.getDefaultInstance().getService();
        this.bucketName = appConfig.getGcsBucket();
        if (bucketName == null || bucketName.isBlank()) {
            throw new IllegalStateException("invodata.gcs.bucket must be set when using GCS storage.");
        }
    }

    @Override
    public String save(String contentType, byte[] contents, String preferredPath) {
        try {
            String fallbackFileId = InvoiceFileId.build(contentType, contents);
            String fileId = normalizeStorageKey(preferredPath, fallbackFileId);
            String currentFileId = fileId;
            int collisionIndex = 1;
            while (true) {
                BlobId blobId = BlobId.of(bucketName, currentFileId);
                Blob existing = storage.get(blobId);
                if (existing == null) {
                    BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                            .setContentType(contentType == null ? "application/octet-stream" : contentType)
                            .build();
                    storage.create(blobInfo, contents);
                    return currentFileId;
                }

                byte[] existingBytes = existing.getContent();
                if (java.util.Arrays.equals(existingBytes, contents)) {
                    logger.warn("GCS file already exists.");
                    return currentFileId;
                }

                currentFileId = withCollisionSuffix(fileId, collisionIndex++);
            }
        } catch (Exception e) {
            logger.error("Failed to save file to GCS", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save file.");
        }
    }

    @Override
    public InvoiceFileData load(String fileId) {
        BlobId blobId = BlobId.of(bucketName, fileId);
        Blob blob = storage.get(blobId);
        if (blob == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found.");
        }
        byte[] content = blob.getContent();
        String contentType = blob.getContentType();
        if (contentType == null) {
            contentType = "application/octet-stream";
        }
        String downloadName = fileId.contains("/") ? fileId.substring(fileId.lastIndexOf('/') + 1) : fileId;
        return new InvoiceFileData(content, downloadName, contentType);
    }

    @Override
    public void delete(String fileId) {
        try {
            storage.delete(BlobId.of(bucketName, fileId));
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
