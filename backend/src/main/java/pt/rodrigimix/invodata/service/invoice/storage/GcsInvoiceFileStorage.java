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
import pt.rodrigimix.invodata.security.encryption.UserKeyContext;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

@Service
@ConditionalOnProperty(name = "invodata.storage.type", havingValue = "gcs")
public class GcsInvoiceFileStorage implements InvoiceFileStorage {

    private final Logger logger = LoggerFactory.getLogger(GcsInvoiceFileStorage.class);
    private final AppConfig appConfig;
    private final Storage storage;
    private final String bucketName;
    private final boolean encryptionEnabled;
    private final String kmsKeyName;

    public GcsInvoiceFileStorage(AppConfig appConfig) {
        this.appConfig = appConfig;
        this.storage = StorageOptions.getDefaultInstance().getService();
        this.bucketName = appConfig.getGcsBucket();
        this.encryptionEnabled = appConfig.isStorageEncryptionEnabled();
        this.kmsKeyName = appConfig.getStorageEncryptionKmsKey();
        if (bucketName == null || bucketName.isBlank()) {
            throw new IllegalStateException("invodata.gcs.bucket must be set when using GCS storage.");
        }
    }

    @Override
    public String save(String contentType, byte[] contents, InvoiceFilePathContext context) {
        try {
            String fileId = buildUniquePath(contentType, context);
            BlobId blobId = BlobId.of(bucketName, fileId);

            BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                    .setContentType(contentType == null ? "application/octet-stream" : contentType)
                    .build();
            byte[] payload = encryptionEnabled ? InvoiceFileCrypto.encrypt(contents, resolveUserKey()) : contents;
            if (kmsKeyName != null && !kmsKeyName.isBlank() && encryptionEnabled) {
                storage.create(blobInfo, payload, Storage.BlobTargetOption.kmsKeyName(kmsKeyName));
            } else {
                storage.create(blobInfo, payload);
            }
            return fileId;
        } catch (Exception e) {
            logger.error("Failed to save file to GCS", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save file.");
        }
    }

    @Override
    public String move(String fileId, InvoiceFilePathContext context) {
        if (fileId == null || fileId.isBlank()) {
            return fileId;
        }
        try {
            BlobId sourceId = BlobId.of(bucketName, fileId);
            Blob source = storage.get(sourceId);
            if (source == null) {
                return fileId;
            }
            String extension = InvoiceFilePathBuilder.extensionFromFilename(fileId);
            String targetId = buildUniquePathFromExtension(extension, context);
            if (targetId.equals(fileId)) {
                return fileId;
            }
            BlobId targetBlobId = BlobId.of(bucketName, targetId);
            source.copyTo(targetBlobId);
            storage.delete(sourceId);
            return targetId;
        } catch (Exception e) {
            logger.warn("Failed to move GCS file {}: {}", fileId, e.getMessage());
            return fileId;
        }
    }

    @Override
    public InvoiceFileData load(String fileId) {
        try {
            BlobId blobId = BlobId.of(bucketName, fileId);
            Blob blob = storage.get(blobId);
            if (blob == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found.");
            }
            byte[] content = blob.getContent();
            if (encryptionEnabled) {
                content = decryptWithRotation(content, blobId, blob.getContentType());
            }
            String contentType = blob.getContentType();
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
            String filename = java.nio.file.Path.of(fileId).getFileName().toString();
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
            storage.delete(BlobId.of(bucketName, fileId));
        } catch (Exception ignored) {
            // Best-effort delete to avoid breaking request.
        }
    }

    private SecretKey resolveUserKey() {
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

    private byte[] decryptWithRotation(byte[] payload, BlobId blobId, String contentType) {
        SecretKey userKey = resolveUserKey();
        try {
            return InvoiceFileCrypto.decryptIfEncrypted(payload, userKey);
        } catch (IllegalStateException ex) {
            SecretKey legacyKey = resolveLegacyKey();
            if (legacyKey == null) {
                throw ex;
            }
            byte[] decrypted = InvoiceFileCrypto.decryptIfEncrypted(payload, legacyKey);
            try {
                byte[] rotated = InvoiceFileCrypto.encrypt(decrypted, userKey);
                BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                        .setContentType(contentType == null ? "application/octet-stream" : contentType)
                        .build();
                if (kmsKeyName != null && !kmsKeyName.isBlank() && encryptionEnabled) {
                    storage.create(blobInfo, rotated, Storage.BlobTargetOption.kmsKeyName(kmsKeyName));
                } else {
                    storage.create(blobInfo, rotated);
                }
            } catch (Exception ignored) {
                // Best-effort rotation; keep serving decrypted bytes.
            }
            return decrypted;
        }
    }

    private String buildUniquePath(String contentType, InvoiceFilePathContext context) {
        String directory = InvoiceFilePathBuilder.buildDirectory(context);
        String baseName = InvoiceFilePathBuilder.buildBaseName(context);
        String extension = InvoiceFilePathBuilder.extensionFromMimeType(contentType);
        return buildUniquePath(directory, baseName, extension);
    }

    private String buildUniquePathFromExtension(String extension, InvoiceFilePathContext context) {
        String directory = InvoiceFilePathBuilder.buildDirectory(context);
        String baseName = InvoiceFilePathBuilder.buildBaseName(context);
        return buildUniquePath(directory, baseName, extension);
    }

    private String buildUniquePath(String directory, String baseName, String extension) {
        String candidate = directory + "/" + baseName + extension;
        if (storage.get(BlobId.of(bucketName, candidate)) == null) {
            return candidate;
        }
        for (int counter = 2; counter <= 999; counter++) {
            String attempt = directory + "/" + baseName + "_" + counter + extension;
            if (storage.get(BlobId.of(bucketName, attempt)) == null) {
                return attempt;
            }
        }
        return directory + "/" + baseName + "_" + System.currentTimeMillis() + extension;
    }
}
