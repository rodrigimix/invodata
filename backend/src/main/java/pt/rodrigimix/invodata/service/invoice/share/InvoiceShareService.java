package pt.rodrigimix.invodata.service.invoice.share;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.dto.InvoiceShareCreateRequest;
import pt.rodrigimix.invodata.dto.InvoiceShareResponse;
import pt.rodrigimix.invodata.dto.InvoiceShareSnapshotResponse;
import pt.rodrigimix.invodata.dto.InvoiceCreateRequest;
import pt.rodrigimix.invodata.dto.InvoiceFileData;
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.InvoiceShare;
import pt.rodrigimix.invodata.model.Item;
import pt.rodrigimix.invodata.model.Notification;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.InvoiceRepository;
import pt.rodrigimix.invodata.repository.InvoiceShareRepository;
import pt.rodrigimix.invodata.repository.NotificationRepository;
import pt.rodrigimix.invodata.repository.UserRepository;
import pt.rodrigimix.invodata.service.invoice.InvoiceService;
import pt.rodrigimix.invodata.security.encryption.MissingUserKeyException;
import pt.rodrigimix.invodata.security.encryption.UserKeyContext;
import pt.rodrigimix.invodata.service.invoice.storage.InvoiceFileStorage;
import pt.rodrigimix.invodata.service.system.SystemSettingsService;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class InvoiceShareService {
    private static final String TEMP_SHARE_DIR = "share-temp";
    private static final int TEMP_SHARE_DEFAULT_DAYS = 7;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceShareRepository shareRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SystemSettingsService settingsService;
    private final InvoiceService invoiceService;
    private final InvoiceFileStorage fileStorage;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public InvoiceShareService(InvoiceRepository invoiceRepository, InvoiceShareRepository shareRepository,
            NotificationRepository notificationRepository, UserRepository userRepository,
            SystemSettingsService settingsService, InvoiceService invoiceService, InvoiceFileStorage fileStorage) {
        this.invoiceRepository = invoiceRepository;
        this.shareRepository = shareRepository;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.settingsService = settingsService;
        this.invoiceService = invoiceService;
        this.fileStorage = fileStorage;
    }

    public InvoiceShareResponse createShare(String publicId, User owner, InvoiceShareCreateRequest request) {
        Invoice invoice = invoiceRepository.findByPublicIdAndUserUsernameIgnoreCase(publicId, owner.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found."));

        boolean publicLink = request.publicLink() != null && request.publicLink();
        if (publicLink && !settingsService.allowPublicShares()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Public shares are disabled.");
        }

        User sharedWith = null;
        if (!publicLink) {
            if (request.username() == null || request.username().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is required.");
            }
            sharedWith = userRepository.findByUsernameIgnoreCase(request.username().trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        }

        LocalDateTime expiresAt = resolveExpiry(request.expiresInDays());
        boolean allowImport = publicLink && (request.allowImport() == null || request.allowImport());
        boolean allowPdf = request.allowPdf() == null || request.allowPdf();
        boolean allowPdfDownload = allowPdf && (request.allowPdfDownload() == null || request.allowPdfDownload());
        InvoiceShare share = InvoiceShare.builder()
                .invoice(invoice)
                .createdBy(owner)
                .sharedWith(sharedWith)
                .token(publicLink ? UUID.randomUUID().toString().replace("-", "") : null)
                .expiresAt(expiresAt)
            .allowImport(allowImport)
            .allowPdf(allowPdf)
            .allowPdfDownload(allowPdfDownload)
            .fileId(invoice.getFileID())
            .redactedFileId(invoice.getRedactedFileID())
                .build();

        share.setSnapshot(buildSnapshot(invoice));
        InvoiceShare saved = shareRepository.save(share);
        if (allowPdf && settingsService.resolveStorage().encryptionEnabled()) {
            createTemporaryShareFile(saved);
        }
        if (!publicLink && saved.getSharedWith() != null) {
            createShareNotification(saved);
        }
        return toResponse(saved, publicLink ? "public" : "user");
    }

    public List<InvoiceShareResponse> listShares(String publicId, User owner) {
        return shareRepository.findByInvoicePublicIdAndCreatedByUsernameIgnoreCase(publicId, owner.getUsername())
                .stream()
                .filter(share -> share.getRevokedAt() == null)
                .map(share -> toResponse(share, share.getToken() != null ? "public" : "user"))
                .toList();
    }

    public void revokeShare(String publicId, Long shareId, User owner) {
        InvoiceShare share = shareRepository.findById(shareId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share not found."));
        if (!share.getInvoice().getPublicId().equals(publicId)
                || !share.getCreatedBy().getUsername().equalsIgnoreCase(owner.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Share access denied.");
        }
        cleanupTempFile(share);
        invoiceRepository.deleteBySharedFromShareId(shareId);
        share.setRevokedAt(LocalDateTime.now());
        shareRepository.save(share);
    }

    public InvoiceShareSnapshotResponse getShareByToken(String token) {
        InvoiceShare share = shareRepository.findByTokenAndRevokedAtIsNull(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share not found."));
        ensureActive(share);
        return toSnapshotResponse(share, "public");
    }

    public Invoice importShareByToken(String token, User user) {
        InvoiceShare share = shareRepository.findByTokenAndRevokedAtIsNull(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share not found."));
        ensureActive(share);
        if (!Boolean.TRUE.equals(share.getAllowImport())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Import disabled for this share.");
        }
        InvoiceCreateRequest request = buildImportRequest(share);
        return invoiceService.createSharedInvoice(request, user, share.getId());
    }

    public InvoiceShareSnapshotResponse getShareForUser(Long shareId, User user) {
        InvoiceShare share = shareRepository.findById(shareId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share not found."));
        if (share.getSharedWith() == null
                || !share.getSharedWith().getUsername().equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Share access denied.");
        }
        ensureActive(share);
        ensureAccepted(share);
        return toSnapshotResponse(share, "user");
    }

    public Invoice importShareForUser(Long shareId, User user) {
        InvoiceShare share = shareRepository.findById(shareId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share not found."));
        if (share.getSharedWith() == null
                || !share.getSharedWith().getUsername().equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Share access denied.");
        }
        ensureActive(share);
        ensureAccepted(share);
        if (!Boolean.TRUE.equals(share.getAllowImport())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Import disabled for this share.");
        }
        InvoiceCreateRequest request = buildImportRequest(share);
        return invoiceService.createManualInvoice(request, user);
    }

    public ShareFileResult getShareFileByToken(String token) {
        InvoiceShare share = shareRepository.findByTokenAndRevokedAtIsNull(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share not found."));
        ensureActive(share);
        return resolveShareFile(share);
    }

    public ShareFileResult getShareFileForUser(Long shareId, User user) {
        InvoiceShare share = shareRepository.findById(shareId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share not found."));
        if (share.getSharedWith() == null
                || !share.getSharedWith().getUsername().equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Share access denied.");
        }
        ensureActive(share);
        ensureAccepted(share);
        return resolveShareFile(share);
    }

    public List<InvoiceShareSnapshotResponse> listSharesForUser(User user) {
        return shareRepository
            .findBySharedWithUsernameIgnoreCaseAndRevokedAtIsNullAndAcceptedAtIsNotNullAndDeclinedAtIsNull(
                user.getUsername())
                .stream()
                .filter(this::isActive)
                .map(share -> toSnapshotResponse(share, "user"))
                .toList();
    }

        public InvoiceShareSnapshotResponse acceptShareForUser(Long shareId, User user) {
        InvoiceShare share = shareRepository.findById(shareId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share not found."));
        if (share.getSharedWith() == null
            || !share.getSharedWith().getUsername().equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Share access denied.");
        }
        ensureActive(share);
        share.setAcceptedAt(LocalDateTime.now());
        share.setDeclinedAt(null);
        shareRepository.save(share);
        return toSnapshotResponse(share, "user");
        }

        public void declineShareForUser(Long shareId, User user) {
        InvoiceShare share = shareRepository.findById(shareId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Share not found."));
        if (share.getSharedWith() == null
            || !share.getSharedWith().getUsername().equalsIgnoreCase(user.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Share access denied.");
        }
        share.setDeclinedAt(LocalDateTime.now());
        shareRepository.save(share);
        }

    private boolean isActive(InvoiceShare share) {
        if (share.getRevokedAt() != null) {
            return false;
        }
        if (share.getExpiresAt() == null) {
            return true;
        }
        return share.getExpiresAt().isAfter(LocalDateTime.now());
    }

    private void ensureActive(InvoiceShare share) {
        if (!isActive(share)) {
            if (share.getTempFileId() != null) {
                cleanupTempFile(share);
                shareRepository.save(share);
            }
            throw new ResponseStatusException(HttpStatus.GONE, "Share expired.");
        }
    }

    private void ensureAccepted(InvoiceShare share) {
        if (share.getAcceptedAt() == null || share.getDeclinedAt() != null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Share invitation not accepted.");
        }
    }

    private LocalDateTime resolveExpiry(Integer expiresInDays) {
        if (expiresInDays == null || expiresInDays <= 0) {
            return null;
        }
        return LocalDateTime.now().plusDays(expiresInDays);
    }

    private String buildSnapshot(Invoice invoice) {
        InvoiceShareSnapshotResponse.InvoiceShareSnapshot snapshot = new InvoiceShareSnapshotResponse.InvoiceShareSnapshot(
                invoice.getPublicId(),
                invoice.getDocumentNum(),
                invoice.getDate() != null ? invoice.getDate().toString() : null,
                invoice.getIssuer() != null ? invoice.getIssuer().getName() : null,
                invoice.getIssuer() != null ? invoice.getIssuer().getTaxId() : null,
                invoice.getCategory(),
                invoice.isRevenue(),
                invoice.getTotalAmount(),
                invoice.getTaxAmount(),
                invoice.getNetAmount(),
                invoice.getPaymentMethod(),
                invoice.getNotes(),
                invoice.getOriginalFileName(),
                invoice.getCreatedAt() != null ? invoice.getCreatedAt().toString() : null,
                mapItems(invoice.getItems()));
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to snapshot invoice.");
        }
    }

    private List<InvoiceShareSnapshotResponse.InvoiceShareItem> mapItems(List<Item> items) {
        if (items == null) {
            return List.of();
        }
        return items.stream()
                .map(item -> new InvoiceShareSnapshotResponse.InvoiceShareItem(
                        item.getDescription(),
                        item.getQuantity(),
                        item.getUnitPrice(),
                        item.getTotalPrice(),
                        item.getTaxPrice(),
                        item.getTaxPercent()))
                .toList();
    }

    private InvoiceCreateRequest buildImportRequest(InvoiceShare share) {
        InvoiceShareSnapshotResponse.InvoiceShareSnapshot snapshot = parseSnapshot(share);
        if (snapshot == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Share snapshot unavailable.");
        }

        LocalDate date = null;
        if (snapshot.date() != null && !snapshot.date().isBlank()) {
            try {
                date = LocalDate.parse(snapshot.date());
            } catch (DateTimeParseException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid shared invoice date.");
            }
        }

        List<Item> items = mapShareItems(snapshot.items());

        return new InvoiceCreateRequest(
                snapshot.documentNum(),
                date,
                snapshot.revenue() != null ? snapshot.revenue() : false,
                snapshot.totalAmount(),
                snapshot.taxAmount(),
                snapshot.netAmount(),
                null,
                snapshot.paymentMethod(),
                snapshot.notes(),
                snapshot.issuerTaxId(),
                snapshot.issuerName(),
                snapshot.category(),
                items,
                null
        );
    }

    private List<Item> mapShareItems(List<InvoiceShareSnapshotResponse.InvoiceShareItem> items) {
        if (items == null) {
            return List.of();
        }
        return items.stream()
                .map(item -> Item.builder()
                        .description(item.description())
                        .quantity(item.quantity())
                        .unitPrice(item.unitPrice())
                        .totalPrice(item.totalPrice())
                        .taxPrice(item.taxPrice())
                        .taxPercent(item.taxPercent())
                        .build())
                .toList();
    }

    private InvoiceShareSnapshotResponse toSnapshotResponse(InvoiceShare share, String type) {
        InvoiceShareSnapshotResponse.InvoiceShareSnapshot snapshot = parseSnapshot(share);
        return new InvoiceShareSnapshotResponse(share.getId(), share.getToken(), type, share.getCreatedAt(),
                share.getExpiresAt(), share.getAllowImport(), share.getAllowPdf(), share.getAllowPdfDownload(),
                snapshot);
    }

    private ShareFileResult resolveShareFile(InvoiceShare share) {
        if (!Boolean.TRUE.equals(share.getAllowPdf())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "PDF access disabled for this share.");
        }
        if (settingsService.resolveStorage().encryptionEnabled()) {
            ShareFileResult tempFile = resolveTemporaryShareFile(share);
            if (tempFile != null) {
                return tempFile;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "PDF access disabled while encryption is enabled.");
        }
        String fileId = resolveShareFileId(share);
        if (fileId == null || fileId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not available.");
        }
        InvoiceFileData data = fileStorage.load(fileId);
        String filename = resolveShareFilename(share, data.filename());
        return new ShareFileResult(data, filename);
    }

    private void createTemporaryShareFile(InvoiceShare share) {
        if (UserKeyContext.getKey() == null) {
            throw new MissingUserKeyException("User encryption key required to share PDF.");
        }
        cleanupTempFile(share);
        String fileId = resolveShareFileId(share);
        if (fileId == null || fileId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not available.");
        }
        InvoiceFileData data = fileStorage.load(fileId);
        String extension = extractExtension(fileId);
        String tempId = "share-" + share.getId() + "-" + UUID.randomUUID().toString().replace("-", "") + extension;
        Path targetDir = Paths.get(settingsService.resolveStorage().mediaPath(), TEMP_SHARE_DIR);
        try {
            Files.createDirectories(targetDir);
            Files.write(targetDir.resolve(tempId), data.content());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to prepare shared PDF.");
        }
        share.setTempFileId(tempId);
        share.setTempFileExpiresAt(resolveTempExpiry(share));
        shareRepository.save(share);
    }

    private ShareFileResult resolveTemporaryShareFile(InvoiceShare share) {
        String tempFileId = share.getTempFileId();
        if (tempFileId == null || tempFileId.isBlank()) {
            return null;
        }
        if (share.getTempFileExpiresAt() != null
                && share.getTempFileExpiresAt().isBefore(LocalDateTime.now())) {
            cleanupTempFile(share);
            shareRepository.save(share);
            return null;
        }
        Path tempPath = Paths.get(settingsService.resolveStorage().mediaPath(), TEMP_SHARE_DIR, tempFileId);
        if (!Files.exists(tempPath)) {
            cleanupTempFile(share);
            shareRepository.save(share);
            return null;
        }
        try {
            byte[] content = Files.readAllBytes(tempPath);
            String contentType = Files.probeContentType(tempPath);
            if (contentType == null) {
                contentType = inferContentType(tempFileId);
            }
            InvoiceFileData data = new InvoiceFileData(content, tempFileId, contentType);
            String filename = resolveShareFilename(share, data.filename());
            return new ShareFileResult(data, filename);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to load shared PDF.");
        }
    }

    private void cleanupTempFile(InvoiceShare share) {
        String tempFileId = share.getTempFileId();
        if (tempFileId == null || tempFileId.isBlank()) {
            return;
        }
        Path tempPath = Paths.get(settingsService.resolveStorage().mediaPath(), TEMP_SHARE_DIR, tempFileId);
        try {
            Files.deleteIfExists(tempPath);
        } catch (Exception ignored) {
            // Best-effort cleanup.
        }
        share.setTempFileId(null);
        share.setTempFileExpiresAt(null);
    }

    private LocalDateTime resolveTempExpiry(InvoiceShare share) {
        if (share.getExpiresAt() != null) {
            return share.getExpiresAt();
        }
        return LocalDateTime.now().plusDays(TEMP_SHARE_DEFAULT_DAYS);
    }

    private String resolveShareFileId(InvoiceShare share) {
        String fileId = share.getFileId();
        if (fileId == null || fileId.isBlank()) {
            fileId = share.getRedactedFileId();
        }
        return fileId;
    }

    private String extractExtension(String fileId) {
        if (fileId == null) {
            return "";
        }
        int dot = fileId.lastIndexOf('.');
        if (dot == -1 || dot == fileId.length() - 1) {
            return "";
        }
        return fileId.substring(dot);
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

    private String resolveShareFilename(InvoiceShare share, String fallback) {
        InvoiceShareSnapshotResponse.InvoiceShareSnapshot snapshot = parseSnapshot(share);
        if (snapshot != null && snapshot.originalFileName() != null && !snapshot.originalFileName().isBlank()) {
            return snapshot.originalFileName();
        }
        return fallback;
    }

    private void createShareNotification(InvoiceShare share) {
        String username = share.getCreatedBy() != null ? share.getCreatedBy().getUsername() : "";
        String message = "Invoice shared by " + (username.isBlank() ? "another user" : username) + ".";
        Notification notification = Notification.builder()
                .user(share.getSharedWith())
                .message(message)
                .type(Notification.NotificationType.SHARE)
                .createdAt(LocalDateTime.now())
                .isRead(false)
                .actionUrl(null)
                .shareId(share.getId())
                .build();
        notificationRepository.save(notification);
    }

    public record ShareFileResult(InvoiceFileData data, String filename) {
    }

    private InvoiceShareSnapshotResponse.InvoiceShareSnapshot parseSnapshot(InvoiceShare share) {
        if (share.getSnapshot() == null || share.getSnapshot().isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(share.getSnapshot(), InvoiceShareSnapshotResponse.InvoiceShareSnapshot.class);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read shared invoice.");
        }
    }

    private InvoiceShareResponse toResponse(InvoiceShare share, String type) {
        String sharedWith = share.getSharedWith() != null ? share.getSharedWith().getUsername() : null;
        return new InvoiceShareResponse(share.getId(), type, sharedWith, share.getToken(), share.getCreatedAt(),
                share.getExpiresAt());
    }
}
