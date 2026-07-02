package pt.rodrigimix.invodata.service.invoice.storage;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.regex.Pattern;

public final class InvoiceFilePathBuilder {
    private static final Pattern NON_ALNUM = Pattern.compile("[^A-Za-z0-9]+");
    private static final int MAX_ISSUER_LENGTH = 80;

    private InvoiceFilePathBuilder() {
    }

    public static String buildDirectory(InvoiceFilePathContext context) {
        LocalDate date = resolveDate(context);
        String year = String.valueOf(date.getYear());
        String month = String.format("%02d", date.getMonthValue());
        String type = context != null && context.revenue() ? "Receita" : "Despesa";
        String userSegment = sanitizeUsername(context != null ? context.username() : null);
        return userSegment + "/" + year + "/" + type + "/" + month;
    }

    public static String buildBaseName(InvoiceFilePathContext context) {
        LocalDate date = resolveDate(context);
        String issuer = sanitizeIssuerName(context != null ? context.issuerName() : null);
        String datePart = String.format("%02d%02d%04d", date.getDayOfMonth(), date.getMonthValue(), date.getYear());
        String suffix = context != null && context.redacted() ? "_mascarada" : "";
        return datePart + "_" + issuer + suffix;
    }

    public static String extensionFromMimeType(String contentType) {
        if (contentType == null) {
            return "";
        }
        return switch (contentType) {
            case "application/pdf" -> ".pdf";
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            default -> "";
        };
    }

    public static String extensionFromFilename(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        if (dot == -1 || dot == filename.length() - 1) {
            return "";
        }
        return filename.substring(dot);
    }

    private static LocalDate resolveDate(InvoiceFilePathContext context) {
        if (context == null || context.date() == null) {
            return LocalDate.now();
        }
        return context.date();
    }

    private static String sanitizeIssuerName(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            return "empresa";
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String cleaned = NON_ALNUM.matcher(normalized).replaceAll("_");
        cleaned = cleaned.replaceAll("^_+|_+$", "");
        cleaned = cleaned.replaceAll("_+", "_");
        if (cleaned.isBlank()) {
            return "empresa";
        }
        if (cleaned.length() > MAX_ISSUER_LENGTH) {
            cleaned = cleaned.substring(0, MAX_ISSUER_LENGTH);
        }
        return cleaned;
    }

    private static String sanitizeUsername(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            return "user";
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String cleaned = NON_ALNUM.matcher(normalized).replaceAll("_");
        cleaned = cleaned.replaceAll("^_+|_+$", "");
        cleaned = cleaned.replaceAll("_+", "_");
        if (cleaned.isBlank()) {
            return "user";
        }
        if (cleaned.length() > MAX_ISSUER_LENGTH) {
            cleaned = cleaned.substring(0, MAX_ISSUER_LENGTH);
        }
        return cleaned;
    }
}
