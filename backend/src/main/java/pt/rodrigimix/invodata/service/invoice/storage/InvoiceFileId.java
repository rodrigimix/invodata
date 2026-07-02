package pt.rodrigimix.invodata.service.invoice.storage;

import java.security.MessageDigest;
import java.util.HexFormat;

public final class InvoiceFileId {

    private InvoiceFileId() {
    }

    public static String build(String contentType, byte[] contents) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(contents);
            String fileId = HexFormat.of().formatHex(hashBytes);
            return fileId + getExtensionFromMimeType(contentType);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate file id.", e);
        }
    }

    private static String getExtensionFromMimeType(String contentType) {
        if (contentType == null) return "";
        return switch (contentType) {
            case "application/pdf" -> ".pdf";
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            default -> "";
        };
    }
}
