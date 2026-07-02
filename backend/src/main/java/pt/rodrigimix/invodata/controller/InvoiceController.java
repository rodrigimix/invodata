package pt.rodrigimix.invodata.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import pt.rodrigimix.invodata.dto.InvoiceCreateRequest;
import pt.rodrigimix.invodata.dto.InvoiceFileData;
import pt.rodrigimix.invodata.dto.InvoiceTotalsResponse;
import pt.rodrigimix.invodata.dto.InvoiceUploadUsageResponse;
import pt.rodrigimix.invodata.dto.InvoiceUpdateRequest;
import pt.rodrigimix.invodata.dto.UploadJobCreateResponse;
import pt.rodrigimix.invodata.dto.UploadJobStatusResponse;
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.InvoiceUploadCounter;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.invoice.InvoiceService;
import pt.rodrigimix.invodata.service.invoice.InvoiceUploadCounterService;
import pt.rodrigimix.invodata.service.invoice.upload.UploadJob;
import pt.rodrigimix.invodata.service.invoice.upload.UploadJobService;
import pt.rodrigimix.invodata.service.ai.AIService;
import pt.rodrigimix.invodata.service.user.UserService;
import pt.rodrigimix.invodata.security.encryption.MissingUserKeyException;
import pt.rodrigimix.invodata.security.encryption.UserKeyContext;

import java.security.Principal;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/invoices")
@CrossOrigin("*")
public class InvoiceController {

    private final InvoiceService invoiceService;

    private final UserService userService;
    private final UploadJobService uploadJobService;
    private final AIService aiService;
    private final InvoiceUploadCounterService uploadCounterService;

    @Autowired
    public InvoiceController(InvoiceService invoiceService,
            UserService userService,
            UploadJobService uploadJobService,
            AIService aiService,
            InvoiceUploadCounterService uploadCounterService) {
        this.invoiceService = invoiceService;
        this.userService = userService;
        this.uploadJobService = uploadJobService;
        this.aiService = aiService;
        this.uploadCounterService = uploadCounterService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<Invoice>> uploadInvoice(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(value = "redactedFiles", required = false) List<MultipartFile> redactedFiles,
            @RequestParam(value = "userTaxId", required = false) String userTaxId,
            @RequestParam(value = "redactName", required = false) String redactName,
            @RequestParam(value = "redactTerms", required = false) String redactTerms,
            @RequestParam(value = "storeRedactedOnly", required = false) Boolean storeRedactedOnly,
            @RequestHeader(value = "X-User-Key", required = false) String userKey,
            Principal principal) {
        try {

            String resolvedUserKey = resolveUserKey(userKey);

            String username = principal.getName();
            User user = userService.getUserFromUsername(username);
            // 1. Quota check for bulk uploads
            long newFilesCount = files.stream().filter(f -> !f.isEmpty()).count();

            if (uploadCounterService.wouldExceed(user, newFilesCount)) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
            }
            List<CompletableFuture<List<Invoice>>> futures = files.stream()
                    .filter(file -> !file.isEmpty())
                    .map(file -> invoiceService.processFileAsync(
                            file,
                            user,
                            userTaxId,
                            redactName,
                            redactTerms,
                            Boolean.TRUE.equals(storeRedactedOnly),
                            null,
                            null,
                            resolvedUserKey))
                    .toList();

            List<Invoice> allInvoices = futures.stream()
                    .map(CompletableFuture::join)
                    .flatMap(List::stream)
                    .toList();

            uploadCounterService.increment(user, newFilesCount);

            return ResponseEntity.ok(allInvoices);
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping(value = "/upload-job", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadJobCreateResponse> createUploadJob(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "redactedFile", required = false) MultipartFile redactedFile,
            @RequestParam(value = "userTaxId", required = false) String userTaxId,
            @RequestParam(value = "redactName", required = false) String redactName,
            @RequestParam(value = "redactTerms", required = false) String redactTerms,
            @RequestParam(value = "storeRedactedOnly", required = false) Boolean storeRedactedOnly,
            @RequestHeader(value = "X-User-Key", required = false) String userKey,
            Principal principal) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        String username = principal.getName();
        User user = userService.getUserFromUsername(username);
        if (uploadCounterService.wouldExceed(user, 1)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        String resolvedUserKey = resolveUserKey(userKey);
        String jobId = uploadJobService.createJob(
                file,
                redactedFile,
                user,
                userTaxId,
                redactName,
                redactTerms,
                Boolean.TRUE.equals(storeRedactedOnly),
                resolvedUserKey);
        uploadCounterService.increment(user, 1);
        return ResponseEntity.ok(new UploadJobCreateResponse(jobId));
    }

    @GetMapping("/usage")
    public ResponseEntity<InvoiceUploadUsageResponse> getUploadUsage(Principal principal) {
        String username = principal.getName();
        User user = userService.getUserFromUsername(username);
        InvoiceUploadCounter counter = uploadCounterService.getCounter(user);
        int limit = Integer.MAX_VALUE;
        long used = counter.getUsedCount();
        long remaining = Math.max(0, limit - used);
        LocalDate now = LocalDate.now();
        LocalDate period = counter.getFirstUploadAt() != null
                ? counter.getFirstUploadAt().toLocalDate()
                : now;
        return ResponseEntity.ok(new InvoiceUploadUsageResponse(used, limit, remaining, period.getMonthValue(),
                period.getYear()));
    }

    private String resolveUserKey(String userKey) {
        if (userKey != null && !userKey.isBlank()) {
            return userKey;
        }
        byte[] keyBytes = UserKeyContext.getKey();
        if (keyBytes == null || keyBytes.length == 0) {
            throw new MissingUserKeyException("User encryption key required.");
        }
        return Base64.getEncoder().encodeToString(keyBytes);
    }

    @PostMapping(value = "/redact-preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> redactPreview(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "userTaxId", required = false) String userTaxId,
            @RequestParam(value = "redactName", required = false) String redactName,
            @RequestParam(value = "redactTerms", required = false) String redactTerms,
            @RequestParam(value = "redactBoxes", required = false) String redactBoxes,
            Principal principal) {
        try {
            User user = userService.getUserFromUsername(principal.getName());
            byte[] redacted = aiService.redactFile(
                    file.getBytes(),
                    file.getOriginalFilename(),
                    file.getContentType(),
                    user,
                    userTaxId,
                    redactName,
                    redactTerms,
                    redactBoxes);
            String contentType = file.getContentType() != null ? file.getContentType()
                    : MediaType.APPLICATION_OCTET_STREAM_VALUE;
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .body(redacted);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/upload-job/{jobId}")
    public ResponseEntity<UploadJobStatusResponse> getUploadJob(@PathVariable String jobId, Principal principal) {
        UploadJob job = uploadJobService.getJob(jobId);
        if (job == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (!job.getUsername().equalsIgnoreCase(principal.getName())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(new UploadJobStatusResponse(
                job.getId(),
                job.getStatus().name(),
                job.getInvoices(),
                job.getExistingInvoices(),
                job.getError()));
    }

    @PostMapping("/upload-job/{jobId}/cancel")
    public ResponseEntity<Void> cancelUploadJob(@PathVariable String jobId, Principal principal) {
        UploadJob job = uploadJobService.getJob(jobId);
        if (job == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (!job.getUsername().equalsIgnoreCase(principal.getName())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        uploadJobService.cancelJob(jobId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    public ResponseEntity<Invoice> createInvoice(@RequestBody InvoiceCreateRequest request, Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        Invoice invoice = invoiceService.createManualInvoice(request, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(invoice);
    }

    @GetMapping
    public ResponseEntity<Page<Invoice>> getAllInvoices(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String issuerName,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String fileName,
            @RequestParam(required = false) Long accountId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdOn,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Double minAmount,
            @RequestParam(required = false) String period,
            @RequestParam(required = false) Boolean revenue,
            Pageable pageable,
            Principal principal) {

        LocalDate resolvedStartDate = startDate;
        LocalDate resolvedEndDate = endDate;
        if (period != null && (startDate == null && endDate == null)) {
            LocalDate today = LocalDate.now();
            String normalized = period.trim().toLowerCase();
            switch (normalized) {
                case "alltime" -> resolvedStartDate = null;
                case "month" -> resolvedStartDate = today.withDayOfMonth(1);
                case "quarter" -> {
                    int quarter = (today.getMonthValue() - 1) / 3;
                    int startMonth = quarter * 3 + 1;
                    resolvedStartDate = LocalDate.of(today.getYear(), startMonth, 1);
                }
                case "year" -> resolvedStartDate = LocalDate.of(today.getYear(), 1, 1);
                default -> {
                }
            }
            if (resolvedStartDate != null) {
                resolvedEndDate = today;
            } else if ("alltime".equals(normalized)) {
                resolvedEndDate = null;
            }
        }

        Page<Invoice> invoices = invoiceService.getFilteredInvoices(
                principal.getName(),
                search,
                issuerName,
                category,
                paymentMethod,
                fileName,
                accountId,
                createdOn,
                resolvedStartDate,
                resolvedEndDate,
                minAmount,
                revenue,
                pageable);

        return ResponseEntity.ok(invoices);
    }

    @GetMapping("/summary")
    public ResponseEntity<InvoiceTotalsResponse> getInvoiceSummary(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String issuerName,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String fileName,
            @RequestParam(required = false) Long accountId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdOn,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Double minAmount,
            @RequestParam(required = false) String period,
            @RequestParam(required = false) Boolean revenue,
            Principal principal) {

        LocalDate resolvedStartDate = startDate;
        LocalDate resolvedEndDate = endDate;
        if (period != null && (startDate == null && endDate == null)) {
            LocalDate today = LocalDate.now();
            String normalized = period.trim().toLowerCase();
            switch (normalized) {
                case "alltime" -> resolvedStartDate = null;
                case "month" -> resolvedStartDate = today.withDayOfMonth(1);
                case "quarter" -> {
                    int quarter = (today.getMonthValue() - 1) / 3;
                    int startMonth = quarter * 3 + 1;
                    resolvedStartDate = LocalDate.of(today.getYear(), startMonth, 1);
                }
                case "year" -> resolvedStartDate = LocalDate.of(today.getYear(), 1, 1);
                default -> {
                }
            }
            if (resolvedStartDate != null) {
                resolvedEndDate = today;
            } else if ("alltime".equals(normalized)) {
                resolvedEndDate = null;
            }
        }

        InvoiceTotalsResponse totals = invoiceService.getInvoiceTotals(
                principal.getName(),
                search,
                issuerName,
                category,
                paymentMethod,
                fileName,
                accountId,
                createdOn,
                resolvedStartDate,
                resolvedEndDate,
                minAmount,
                revenue);
        return ResponseEntity.ok(totals);
    }

    @GetMapping("/{publicId}")
    public ResponseEntity<Invoice> getInvoiceById(@PathVariable String publicId, Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(invoiceService.getInvoiceByPublicIdForAccess(publicId, user));
    }

    @GetMapping("/{publicId}/file")
    public ResponseEntity<byte[]> downloadInvoiceFile(@PathVariable String publicId,
            @RequestHeader(value = "X-User-Key", required = false) String userKey,
            Principal principal) {
        applyUserKey(userKey);
        User user = userService.getUserFromUsername(principal.getName());
        InvoiceFileData file = invoiceService.getInvoiceFile(publicId, user);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.filename() + "\"")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.content());
    }

    @GetMapping("/{publicId}/file/redacted")
    public ResponseEntity<byte[]> downloadRedactedInvoiceFile(@PathVariable String publicId,
            @RequestHeader(value = "X-User-Key", required = false) String userKey,
            Principal principal) {
        applyUserKey(userKey);
        User user = userService.getUserFromUsername(principal.getName());
        InvoiceFileData file = invoiceService.getRedactedInvoiceFile(publicId, user);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.filename() + "\"")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.content());
    }

    private void applyUserKey(String userKey) {
        if (userKey != null && !userKey.isBlank()) {
            UserKeyContext.setKeyFromBase64(userKey);
            return;
        }
        if (UserKeyContext.getKey() == null) {
            throw new MissingUserKeyException("User encryption key required.");
        }
    }

    @PutMapping("/{publicId}")
    public ResponseEntity<Invoice> updateInvoice(@PathVariable String publicId,
            @RequestBody InvoiceUpdateRequest request,
            Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(invoiceService.updateInvoice(publicId, request, user));
    }

    @DeleteMapping("/{publicId}")
    public ResponseEntity<Void> deleteInvoice(@PathVariable String publicId, Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        invoiceService.deleteInvoice(publicId, user);
        return ResponseEntity.noContent().build();
    }
}
