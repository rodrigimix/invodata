package pt.rodrigimix.invodata.service.invoice;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.dto.InvoiceCreateRequest;
import pt.rodrigimix.invodata.dto.InvoiceFileData;
import pt.rodrigimix.invodata.dto.InvoiceUpdateRequest;
import pt.rodrigimix.invodata.dto.InvoiceShareSnapshotResponse;
import pt.rodrigimix.invodata.model.*;
import pt.rodrigimix.invodata.repository.BudgetRepository;
import pt.rodrigimix.invodata.repository.InvoiceRepository;
import pt.rodrigimix.invodata.repository.InvoiceShareRepository;
import pt.rodrigimix.invodata.repository.IssuerRepository;
import pt.rodrigimix.invodata.repository.NotificationRepository;
import pt.rodrigimix.invodata.repository.UserRepository;
import pt.rodrigimix.invodata.service.account.AccountService;
import pt.rodrigimix.invodata.service.ai.AIService;
import pt.rodrigimix.invodata.service.extraction.ExtractService;
import pt.rodrigimix.invodata.service.invoice.storage.InvoiceFilePathContext;
import pt.rodrigimix.invodata.service.invoice.storage.InvoiceFileStorage;
import pt.rodrigimix.invodata.service.system.SystemSettingsService;
import pt.rodrigimix.invodata.security.encryption.UserKeyContext;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CancellationException;

@Service
public class InvoiceService {

    private final Logger logger = LoggerFactory.getLogger(InvoiceService.class);
    private static final String TEMP_SHARE_DIR = "share-temp";

    private final InvoiceRepository invoiceRepository;

    private final IssuerRepository issuerRepository;

    private final ExtractService extractService;

    private final AccountService accountService;

    private final AIService aiService;

    private final InvoiceFileStorage fileStorage;

    private final InvoiceShareRepository invoiceShareRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final UserRepository userRepository;

    private final SystemSettingsService settingsService;

    private BudgetRepository budgetRepository;

    private NotificationRepository notificationRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    public InvoiceService(InvoiceRepository invoiceRepository,
            IssuerRepository issuerRepository,
            ExtractService extractService,
            AccountService accountService,
            AIService aiService,
            InvoiceFileStorage fileStorage,
            BudgetRepository budgetRepository,
            NotificationRepository notificationRepository,
            UserRepository userRepository,
            InvoiceShareRepository invoiceShareRepository,
            SystemSettingsService settingsService) {
        this.invoiceRepository = invoiceRepository;
        this.issuerRepository = issuerRepository;
        this.extractService = extractService;
        this.accountService = accountService;
        this.aiService = aiService;
        this.fileStorage = fileStorage;
        this.budgetRepository = budgetRepository;
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.invoiceShareRepository = invoiceShareRepository;
        this.settingsService = settingsService;
    }

    public List<Invoice> extractInvoices(List<Invoice> invoices, User user) {
        logger.debug("Starting invoice extraction process for {} invoices", invoices.size());
        List<Invoice> validInvoices = new ArrayList<>();

        for (Invoice invoice : invoices) {
            invoice.setUser(user);
            logger.trace("Processing invoice.");

            if (invoice.getIssuer().getTaxId() != null || invoice.getIssuer().getName() != null) {
                associateIssue(invoice);
            }

            if (invoice.getAccount() != null) {
                String accountName = invoice.getAccount().getName();
                if (accountName != null) {
                    enrichAccount(invoice, accountName, invoice.getUser());
                } else if (invoice.getAccount().getLast4() != null) {
                    Account matched = accountService.getAccountByLast4(invoice.getAccount().getLast4(),
                            invoice.getUser());
                    if (matched != null) {
                        invoice.setAccount(matched);
                    } else {
                        invoice.setAccount(null);
                    }
                }
            }

            validInvoices.add(invoice);
        }

        logger.info("Successfully extracted {} invoices", invoices.size());
        return validInvoices;
    }

    private record InvoiceSaveResult(List<Invoice> saved, List<Invoice> duplicates, int duplicateCount,
            int totalCount) {
    }

    private InvoiceSaveResult saveInvoices(List<Invoice> invoices, byte[] contents, String contentType,
            String originalFileName) {
        return saveInvoices(invoices, contents, contentType, originalFileName, null, null, false);
    }

    private InvoiceSaveResult saveInvoices(List<Invoice> invoices,
            byte[] contents,
            String contentType,
            String originalFileName,
            byte[] redactedContents,
            String redactedContentType,
            boolean storeRedactedOnly) {
        List<Invoice> newInvoices = new ArrayList<>();
        List<Invoice> duplicateInvoices = new ArrayList<>();
        int duplicateCount = 0;
        User owner = invoices.isEmpty() ? null : invoices.get(0).getUser();
        List<Invoice> existingInvoices = owner != null ? invoiceRepository.findByUser(owner) : List.of();
        for (Invoice invoice : invoices) {
            if (invoice.getOriginalFileName() == null || invoice.getOriginalFileName().isBlank()) {
                invoice.setOriginalFileName(originalFileName);
            }
            Optional<Invoice> existing = findDuplicate(existingInvoices, invoice);
            if (existing.isEmpty()) {
                newInvoices.add(invoice);
            } else {
                duplicateCount++;
                existing.ifPresent(duplicateInvoices::add);
                logger.debug("Duplicate invoice detected. Skipping.");
            }
        }

        if (newInvoices.isEmpty()) {
            return new InvoiceSaveResult(List.of(), duplicateInvoices, duplicateCount, invoices.size());
        }

        String fileId = null;
        String redactedFileId = null;
        Invoice referenceInvoice = newInvoices.get(0);
        InvoiceFilePathContext baseContext = buildFilePathContext(referenceInvoice, false);
        InvoiceFilePathContext redactedContext = buildFilePathContext(referenceInvoice, true);
        if (storeRedactedOnly) {
            if (redactedContents == null) {
                throw new RuntimeException("Redacted file not available.");
            }
            String redactedType = (redactedContentType != null && !redactedContentType.isBlank())
                    ? redactedContentType
                    : contentType;
            redactedFileId = fileStorage.save(redactedType, redactedContents, redactedContext);
            fileId = redactedFileId;
        } else {
            fileId = fileStorage.save(contentType, contents, baseContext);
        }
        for (Invoice invoice : newInvoices) {
            auxiliarSaveInvoice(invoice, fileId);
            if (redactedFileId != null) {
                invoice.setRedactedFileID(redactedFileId);
            }
        }
        invoiceRepository.saveAll(newInvoices);
        return new InvoiceSaveResult(newInvoices, duplicateInvoices, duplicateCount, invoices.size());
    }

    private Optional<Invoice> findDuplicate(List<Invoice> existingInvoices, Invoice candidate) {
        if (candidate == null || candidate.getDocumentNum() == null || candidate.getIssuer() == null
                || candidate.getUser() == null) {
            return Optional.empty();
        }
        String docNum = candidate.getDocumentNum();
        String taxId = candidate.getIssuer().getTaxId();
        String issuerName = candidate.getIssuer().getName();
        String username = candidate.getUser().getUsername();
        return existingInvoices.stream()
                .filter(inv -> inv.getUser() != null && username.equalsIgnoreCase(inv.getUser().getUsername()))
                .filter(inv -> inv.getDocumentNum() != null
                        && inv.getDocumentNum().equalsIgnoreCase(docNum))
                .filter(inv -> {
                    if (inv.getIssuer() == null)
                        return false;
                    if (taxId != null && inv.getIssuer().getTaxId() != null) {
                        return inv.getIssuer().getTaxId().equalsIgnoreCase(taxId);
                    }
                    return issuerName != null && inv.getIssuer().getName() != null
                            && inv.getIssuer().getName().equalsIgnoreCase(issuerName);
                })
                .findFirst();
    }

    private void auxiliarSaveInvoice(Invoice invoice, String fileId) {
        if (invoice.isRevenue() && isBlank(invoice.getCategory())) {
            invoice.setCategory("REVENUE");
        }
        if (issuerRepository.findByNameOrTaxIdIgnoreCase(invoice.getIssuer().getName(), invoice.getIssuer().getTaxId())
                .isEmpty()) {
            issuerRepository.save(invoice.getIssuer());
        } else if (invoice.isRevenue() && invoice.getIssuer() != null) {
            issuerRepository.save(invoice.getIssuer());
        }
        invoice.setFileID(fileId);

        if (invoice.getUser() != null) {
            checkBudgetThresholds(invoice.getUser(), invoice);
        }

        if (invoice.getAccount() != null) {
            accountService.updateBalance(invoice.getAccount(), invoice.getTotalAmount(), invoice.isRevenue());
        }
    }

    private InvoiceFilePathContext buildFilePathContext(Invoice invoice, boolean redacted) {
        if (invoice == null) {
            return new InvoiceFilePathContext(null, false, null, null, redacted);
        }
        String issuerName = invoice.getIssuer() != null ? invoice.getIssuer().getName() : null;
        String username = invoice.getUser() != null ? invoice.getUser().getUsername() : null;
        return new InvoiceFilePathContext(invoice.getDate(), invoice.isRevenue(), issuerName, username, redacted);
    }

    private void associateIssue(Invoice invoice) {
        Issuer issuer = issuerRepository
                .findByNameOrTaxIdIgnoreCase(invoice.getIssuer().getName(), invoice.getIssuer().getTaxId())
                .orElseGet(() -> {
                    logger.debug("Issuer not found. Creating new issuer.");
                    Issuer rawIssuer = invoice.getIssuer();

                    String resolvedCategory = null;
                    if (invoice.getUser() != null && rawIssuer.getTaxId() != null) {
                        resolvedCategory = resolveInvoiceCategory(invoice.getUser(), rawIssuer.getTaxId(), null);
                    }
                    if (resolvedCategory == null && invoice.getUser() != null
                            && Boolean.TRUE.equals(invoice.getUser().getAiConsent())) {
                        logger.trace("Attempting to enrich issuer via AI.");
                        resolvedCategory = categorizeInvoiceCategory(rawIssuer, invoice.getItems());
                    }
                    if (invoice.getCategory() == null) {
                        invoice.setCategory(resolvedCategory);
                    }

                    try {
                        return issuerRepository.save(rawIssuer);
                    } catch (DataIntegrityViolationException ex) {
                        if (rawIssuer.getTaxId() != null) {
                            return issuerRepository.findByTaxIdIgnoreCase(rawIssuer.getTaxId())
                                    .orElseThrow(() -> ex);
                        }
                        throw ex;
                    }
                });

        invoice.setIssuer(issuer);
        logger.trace("Issuer set for invoice.");

        if (invoice.getCategory() == null && invoice.getUser() != null && issuer.getTaxId() != null) {
            invoice.setCategory(resolveInvoiceCategory(invoice.getUser(), issuer.getTaxId(), null));
        }

        Optional<Invoice> existingInvoice = invoiceRepository.findByUser(invoice.getUser()).stream()
                .filter(inv -> inv.getDocumentNum() != null
                        && invoice.getDocumentNum() != null
                        && inv.getDocumentNum().equalsIgnoreCase(invoice.getDocumentNum()))
                .filter(inv -> inv.getIssuer() != null
                        && ((issuer.getTaxId() != null && inv.getIssuer().getTaxId() != null
                                && inv.getIssuer().getTaxId().equalsIgnoreCase(issuer.getTaxId()))
                                || (issuer.getTaxId() == null && inv.getIssuer().getName() != null
                                        && inv.getIssuer().getName().equalsIgnoreCase(issuer.getName()))))
                .findFirst();

        existingInvoice.ifPresent(value -> {
            logger.debug("Found existing invoice. Updating ID.");
            invoice.setId(value.getId());
        });
    }

    private void enrichAccount(Invoice invoice, String extractedAccountName, User user) {
        if (extractedAccountName != null && !extractedAccountName.isEmpty()) {
            try {
                Account account = accountService.getAccountByName(extractedAccountName, user);
                invoice.setAccount(account);
            } catch (RuntimeException e) {
                logger.warn("AI suggested account does not exist for user.");
            }
        }
    }

    private String categorizeInvoiceCategory(Issuer issuer, List<Item> items) {
        try {
            String category = aiService.categorizeIssuer(issuer.getName(), "Unknown", items);
            if (isBlank(category)) {
                return null;
            }
            logger.debug("Invoice category inferred: {}", category);
            return category;
        } catch (Exception e) {
            logger.error("Failed to infer invoice category: {}", e.getMessage());
            return null;
        }
    }

    public Page<Invoice> getFilteredInvoices(String username, String search, String issuerName, String category,
            String paymentMethod, String originalFileName, Long accountId, LocalDate createdOn, LocalDate startDate,
            LocalDate endDate, Double minAmount, Boolean revenue, Pageable pageable) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        List<Invoice> invoices = invoiceRepository.findByUser(user);
        List<Invoice> merged = new ArrayList<>(invoices);
        applySharedImportMetadata(merged);
        List<pt.rodrigimix.invodata.model.InvoiceShare> shares = invoiceShareRepository
            .findBySharedWithUsernameIgnoreCaseAndRevokedAtIsNullAndAcceptedAtIsNotNullAndDeclinedAtIsNull(
                username);
        for (pt.rodrigimix.invodata.model.InvoiceShare share : shares) {
            if (!isShareActive(share)) {
                continue;
            }
            Invoice sharedInvoice = buildSharedInvoiceFromSnapshot(share);
            if (sharedInvoice == null || sharedInvoice.getPublicId() == null) {
                continue;
            }
            boolean alreadyIncluded = merged.stream()
                    .anyMatch(inv -> sharedInvoice.getPublicId().equals(inv.getPublicId()));
            if (alreadyIncluded) {
                continue;
            }
            merged.add(sharedInvoice);
        }

        List<Invoice> filtered = merged.stream()
                .filter(invoice -> matchesFilter(invoice, search, issuerName, category, paymentMethod,
                        originalFileName, accountId, createdOn, startDate, endDate, minAmount, revenue))
                .toList();

        List<Invoice> needsId = filtered.stream()
                .filter(inv -> inv.getPublicId() == null || inv.getPublicId().isBlank())
                .toList();
        if (!needsId.isEmpty()) {
            needsId.forEach(inv -> inv.setPublicId(java.util.UUID.randomUUID().toString()));
            invoiceRepository.saveAll(needsId);
        }

        List<Invoice> sorted = applySort(filtered, pageable);
        int total = sorted.size();
        int pageSize = pageable.getPageSize();
        int pageNumber = pageable.getPageNumber();
        int fromIndex = Math.min(pageNumber * pageSize, total);
        int toIndex = Math.min(fromIndex + pageSize, total);
        List<Invoice> pageContent = sorted.subList(fromIndex, toIndex);
        return new PageImpl<>(pageContent, pageable, total);
    }

    public pt.rodrigimix.invodata.dto.InvoiceTotalsResponse getInvoiceTotals(String username, String search,
            String issuerName, String category, String paymentMethod, String originalFileName, Long accountId,
            LocalDate createdOn, LocalDate startDate, LocalDate endDate, Double minAmount, Boolean revenue) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        List<Invoice> invoices = invoiceRepository.findByUser(user);
        List<Invoice> filtered = invoices.stream()
                .filter(invoice -> matchesFilter(invoice, search, issuerName, category, paymentMethod,
                        originalFileName, accountId, createdOn, startDate, endDate, minAmount, revenue))
                .toList();
        double netTotal = filtered.stream().map(Invoice::getNetAmount).filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue).sum();
        double taxTotal = filtered.stream().map(Invoice::getTaxAmount).filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue).sum();
        double totalAmount = filtered.stream().map(Invoice::getTotalAmount).filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue).sum();
        return new pt.rodrigimix.invodata.dto.InvoiceTotalsResponse(netTotal, taxTotal, totalAmount);
    }

    private boolean matchesFilter(Invoice invoice, String search, String issuerName, String category,
            String paymentMethod, String originalFileName, Long accountId, LocalDate createdOn, LocalDate startDate,
            LocalDate endDate, Double minAmount, Boolean revenue) {
        if (search != null && !search.isBlank()) {
            String normalized = search.trim().toLowerCase();
            boolean matches = false;
            if (invoice.getDocumentNum() != null
                    && invoice.getDocumentNum().toLowerCase().contains(normalized)) {
                matches = true;
            }
            if (!matches && invoice.getIssuer() != null && invoice.getIssuer().getName() != null
                    && invoice.getIssuer().getName().toLowerCase().contains(normalized)) {
                matches = true;
            }
            if (!matches && invoice.getLicensePlate() != null
                    && invoice.getLicensePlate().toLowerCase().contains(normalized)) {
                matches = true;
            }
            if (!matches && invoice.getOriginalFileName() != null
                    && invoice.getOriginalFileName().toLowerCase().contains(normalized)) {
                matches = true;
            }
            if (!matches) {
                LocalDate parsedDate = parseSearchDate(normalized);
                if (parsedDate != null && parsedDate.equals(invoice.getDate())) {
                    matches = true;
                }
            }
            if (!matches) {
                String numeric = normalized.replace(",", ".").replaceAll("[^0-9.]", "");
                if (!numeric.isBlank()) {
                    try {
                        Double amount = Double.parseDouble(numeric);
                        matches = Objects.equals(invoice.getTotalAmount(), amount);
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
            if (!matches) {
                return false;
            }
        }

        if (issuerName != null && !issuerName.isEmpty()) {
            if (invoice.getIssuer() == null || invoice.getIssuer().getName() == null
                    || !invoice.getIssuer().getName().toLowerCase().contains(issuerName.toLowerCase())) {
                return false;
            }
        }

        if (category != null && !category.isEmpty()) {
            if (invoice.getCategory() == null || !invoice.getCategory().equalsIgnoreCase(category)) {
                return false;
            }
        }

        if (paymentMethod != null && !paymentMethod.isBlank()) {
            String normalized = paymentMethod.trim().toLowerCase();
            List<String> terms = new ArrayList<>();
            switch (normalized) {
                case "card" -> terms.addAll(List.of("card", "cartao", "cartão"));
                case "transfer" -> terms.addAll(List.of("transfer", "transferencia", "transferência"));
                case "cash" -> terms.addAll(List.of("cash", "dinheiro"));
                case "mbway" -> terms.addAll(List.of("mb way", "mbway"));
                case "other" -> terms.addAll(List.of("other", "outro"));
                default -> terms.add(normalized);
            }
            String method = invoice.getPaymentMethod() != null ? invoice.getPaymentMethod().toLowerCase() : "";
            boolean match = terms.stream().anyMatch(method::contains);
            if (!match) {
                return false;
            }
        }

        if (revenue != null && invoice.isRevenue() != revenue) {
            return false;
        }

        if (originalFileName != null && !originalFileName.isEmpty()) {
            if (invoice.getOriginalFileName() == null
                    || !invoice.getOriginalFileName().equalsIgnoreCase(originalFileName)) {
                return false;
            }
        }

        if (accountId != null) {
            if (invoice.getAccount() == null || !Objects.equals(invoice.getAccount().getId(), accountId)) {
                return false;
            }
        }

        if (createdOn != null) {
            LocalDateTime startOfDay = createdOn.atStartOfDay();
            LocalDateTime nextDay = createdOn.plusDays(1).atStartOfDay();
            LocalDateTime createdAt = invoice.getCreatedAt();
            if (createdAt == null || createdAt.isBefore(startOfDay) || !createdAt.isBefore(nextDay)) {
                return false;
            }
        }

        if (startDate != null || endDate != null) {
            LocalDate date = invoice.getDate();
            if (date == null) {
                return false;
            }
            if (startDate != null && date.isBefore(startDate)) {
                return false;
            }
            if (endDate != null && date.isAfter(endDate)) {
                return false;
            }
        }

        if (minAmount != null) {
            Double total = invoice.getTotalAmount();
            if (total == null || total < minAmount) {
                return false;
            }
        }

        return true;
    }

    private List<Invoice> applySort(List<Invoice> invoices, Pageable pageable) {
        if (pageable == null || pageable.getSort().isUnsorted()) {
            return invoices.stream()
                    .sorted((a, b) -> {
                        LocalDateTime left = a.getCreatedAt();
                        LocalDateTime right = b.getCreatedAt();
                        if (left == null && right == null)
                            return 0;
                        if (left == null)
                            return 1;
                        if (right == null)
                            return -1;
                        return right.compareTo(left);
                    })
                    .toList();
        }

        var order = pageable.getSort().iterator().next();
        String property = order.getProperty();
        boolean ascending = order.isAscending();
        java.util.Comparator<Invoice> comparator = switch (property) {
            case "date" ->
                java.util.Comparator.comparing(Invoice::getDate, java.util.Comparator.nullsLast(LocalDate::compareTo));
            case "totalAmount" -> java.util.Comparator.comparing(Invoice::getTotalAmount,
                    java.util.Comparator.nullsLast(Double::compareTo));
            case "createdAt" -> java.util.Comparator.comparing(Invoice::getCreatedAt,
                    java.util.Comparator.nullsLast(LocalDateTime::compareTo));
            default -> java.util.Comparator.comparing(Invoice::getCreatedAt,
                    java.util.Comparator.nullsLast(LocalDateTime::compareTo));
        };
        if (!ascending) {
            comparator = comparator.reversed();
        }
        return invoices.stream().sorted(comparator).toList();
    }

    private Specification<Invoice> buildInvoiceSpecification(String username, String search, String issuerName,
            String category, String paymentMethod, String originalFileName, Long accountId, LocalDate createdOn,
            LocalDate startDate, LocalDate endDate, Double minAmount, Boolean revenue) {
        Specification<Invoice> spec = (root, query, cb) -> cb.equal(root.get("user").get("username"), username);

        if (search != null && !search.isBlank()) {
            String normalized = search.trim().toLowerCase();
            String like = "%" + normalized + "%";
            spec = spec.and((root, query, cb) -> {
                List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
                predicates.add(cb.like(cb.lower(root.get("documentNum")), like));
                predicates.add(cb.like(cb.lower(root.get("issuer").get("name")), like));
                predicates.add(cb.like(cb.lower(root.get("licensePlate")), like));
                predicates.add(cb.like(cb.lower(root.get("originalFileName")), like));
                LocalDate parsedDate = parseSearchDate(normalized);
                if (parsedDate != null) {
                    predicates.add(cb.equal(root.get("date"), parsedDate));
                }
                String numeric = normalized.replace(",", ".").replaceAll("[^0-9.]", "");
                if (!numeric.isBlank()) {
                    try {
                        Double amount = Double.parseDouble(numeric);
                        predicates.add(cb.equal(root.get("totalAmount"), amount));
                    } catch (NumberFormatException ignored) {
                    }
                }
                return cb.or(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
            });
        }

        if (issuerName != null && !issuerName.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("issuer").get("name")),
                    "%" + issuerName.toLowerCase() + "%"));
        }

        if (category != null && !category.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.equal(cb.lower(root.get("issuer").get("category")),
                    category.toLowerCase()));
        }

        if (paymentMethod != null && !paymentMethod.isBlank()) {
            String normalized = paymentMethod.trim().toLowerCase();
            List<String> terms = new ArrayList<>();
            switch (normalized) {
                case "card" -> terms.addAll(List.of("card", "cartao", "cartão"));
                case "transfer" -> terms.addAll(List.of("transfer", "transferencia", "transferência"));
                case "cash" -> terms.addAll(List.of("cash", "dinheiro"));
                case "mbway" -> terms.addAll(List.of("mb way", "mbway"));
                case "other" -> terms.addAll(List.of("other", "outro"));
                default -> terms.add(normalized);
            }
            spec = spec.and((root, query, cb) -> cb.or(
                    terms.stream()
                            .map(term -> cb.like(cb.lower(root.get("paymentMethod")), "%" + term + "%"))
                            .toArray(jakarta.persistence.criteria.Predicate[]::new)));
        }

        if (revenue != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("revenue"), revenue));
        }

        if (originalFileName != null && !originalFileName.isEmpty()) {
            spec = spec.and((root, query, cb) -> cb.equal(cb.lower(root.get("originalFileName")),
                    originalFileName.toLowerCase()));
        }

        if (accountId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("account").get("id"), accountId));
        }

        if (createdOn != null) {
            LocalDateTime startOfDay = createdOn.atStartOfDay();
            LocalDateTime nextDay = createdOn.plusDays(1).atStartOfDay();
            spec = spec.and((root, query, cb) -> cb.and(
                    cb.greaterThanOrEqualTo(root.get("createdAt"), startOfDay),
                    cb.lessThan(root.get("createdAt"), nextDay)));
        }

        if (startDate != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("date"), startDate));
        }

        if (endDate != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("date"), endDate));
        }

        if (minAmount != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("totalAmount"), minAmount));
        }

        return spec;
    }

    private LocalDate parseSearchDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("d/M/uuuu")
                .withResolverStyle(ResolverStyle.STRICT);
        try {
            return LocalDate.parse(value, formatter);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    public Invoice getInvoiceByPublicId(String publicId, User user) {
        return invoiceRepository.findByPublicIdAndUserUsernameIgnoreCase(publicId, user.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found."));
    }

    public Invoice getInvoiceByPublicIdForAccess(String publicId, User user) {
        try {
            Invoice invoice = getInvoiceByPublicId(publicId, user);
            applySharedImportMetadata(List.of(invoice));
            return invoice;
        } catch (ResponseStatusException ex) {
            if (ex.getStatusCode() != HttpStatus.NOT_FOUND) {
                throw ex;
            }
        }
        var share = invoiceShareRepository.findByInvoicePublicIdAndSharedWithUsernameIgnoreCaseAndRevokedAtIsNull(
                publicId,
                user.getUsername());
        if (share.isEmpty() || !isShareActive(share.get())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found.");
        }
        if (!isShareAccepted(share.get())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Share invitation not accepted.");
        }
        Invoice invoice = buildSharedInvoiceFromSnapshot(share.get());
        if (invoice == null || invoice.getPublicId() == null
                || !invoice.getPublicId().equals(publicId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found.");
        }
        return invoice;
    }

    private boolean isShareAccepted(pt.rodrigimix.invodata.model.InvoiceShare share) {
        return share.getAcceptedAt() != null && share.getDeclinedAt() == null;
    }

    private Invoice buildSharedInvoiceFromSnapshot(pt.rodrigimix.invodata.model.InvoiceShare share) {
        InvoiceShareSnapshotResponse.InvoiceShareSnapshot snapshot = parseShareSnapshot(share);
        if (snapshot == null || snapshot.publicId() == null || snapshot.publicId().isBlank()) {
            return null;
        }
        Issuer issuer = null;
        if ((snapshot.issuerName() != null && !snapshot.issuerName().isBlank())
                || (snapshot.issuerTaxId() != null && !snapshot.issuerTaxId().isBlank())) {
            issuer = Issuer.builder()
                    .name(snapshot.issuerName())
                    .taxId(snapshot.issuerTaxId())
                    .build();
        }

        LocalDate date = null;
        if (snapshot.date() != null && !snapshot.date().isBlank()) {
            try {
                date = LocalDate.parse(snapshot.date());
            } catch (DateTimeParseException ignored) {
                date = null;
            }
        }

        LocalDateTime createdAt = null;
        if (snapshot.createdAt() != null && !snapshot.createdAt().isBlank()) {
            try {
                createdAt = LocalDateTime.parse(snapshot.createdAt());
            } catch (DateTimeParseException ignored) {
                createdAt = null;
            }
        }

        Invoice invoice = new Invoice();
        invoice.setPublicId(snapshot.publicId());
        invoice.setDocumentNum(snapshot.documentNum());
        invoice.setDate(date);
        invoice.setIssuer(issuer);
        invoice.setCategory(snapshot.category());
        invoice.setRevenue(Boolean.TRUE.equals(snapshot.revenue()));
        invoice.setTotalAmount(snapshot.totalAmount());
        invoice.setTaxAmount(snapshot.taxAmount());
        invoice.setNetAmount(snapshot.netAmount());
        invoice.setPaymentMethod(snapshot.paymentMethod());
        invoice.setNotes(snapshot.notes());
        invoice.setOriginalFileName(snapshot.originalFileName());
        invoice.setCreatedAt(createdAt);
        invoice.setItems(mapShareItems(snapshot.items()));
        invoice.setShared(true);
        invoice.setSharedBy(share.getCreatedBy() != null ? share.getCreatedBy().getUsername() : null);
        invoice.setShareId(share.getId());
        return invoice;
    }

    private InvoiceShareSnapshotResponse.InvoiceShareSnapshot parseShareSnapshot(
            pt.rodrigimix.invodata.model.InvoiceShare share) {
        String payload = share.getSnapshot();
        if (payload == null || payload.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(payload, InvoiceShareSnapshotResponse.InvoiceShareSnapshot.class);
        } catch (Exception ex) {
            logger.warn("Failed to parse share snapshot {}: {}", share.getId(), ex.getMessage());
            return null;
        }
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

    private void applySharedImportMetadata(List<Invoice> invoices) {
        List<Long> shareIds = invoices.stream()
                .map(Invoice::getSharedFromShareId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (shareIds.isEmpty()) {
            return;
        }
        var shares = invoiceShareRepository.findAllById(shareIds).stream()
                .filter(this::isShareActive)
                .collect(java.util.stream.Collectors.toMap(
                        pt.rodrigimix.invodata.model.InvoiceShare::getId,
                        share -> share));
        invoices.forEach(invoice -> {
            Long shareId = invoice.getSharedFromShareId();
            if (shareId == null) {
                return;
            }
            var share = shares.get(shareId);
            if (share == null) {
                return;
            }
            invoice.setShared(true);
            invoice.setSharedBy(share.getCreatedBy() != null ? share.getCreatedBy().getUsername() : null);
            invoice.setShareId(shareId);
        });
    }

    private boolean isShareActive(pt.rodrigimix.invodata.model.InvoiceShare share) {
        if (share.getRevokedAt() != null) {
            return false;
        }
        if (share.getExpiresAt() == null) {
            return true;
        }
        return share.getExpiresAt().isAfter(LocalDateTime.now());
    }

    public InvoiceFileData getInvoiceFile(String publicId, User user) {
        Invoice invoice = getInvoiceByPublicId(publicId, user);
        String fileId = invoice.getFileID();
        if (fileId == null || fileId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not available.");
        }
        return fileStorage.load(fileId);
    }

    public InvoiceFileData getRedactedInvoiceFile(String publicId, User user) {
        Invoice invoice = getInvoiceByPublicId(publicId, user);
        String fileId = invoice.getRedactedFileID();
        if (fileId == null || fileId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Redacted file not available.");
        }
        InvoiceFileData file = fileStorage.load(fileId);
        String safeName = invoice.getOriginalFileName();
        String fallbackName = safeName != null && !safeName.isBlank() ? safeName : "fatura-mascarada.pdf";
        String maskedName = fallbackName.replaceFirst("(\\.[^./\\\\]+)?$", "-mascarada$1");
        return new InvoiceFileData(file.content(), maskedName, file.contentType());
    }

    public List<Invoice> processBytes(byte[] contents, String filename, String contentType, User user) {
        return processBytes(contents, filename, contentType, user, null, null, null, false, null, null);
    }

    public List<Invoice> processBytes(byte[] contents,
            String filename,
            String contentType,
            User user,
            String userTaxId,
            String redactName,
            String redactTerms,
            boolean storeRedactedOnly,
            byte[] redactedContents,
            String redactedContentType) {
        if (Thread.currentThread().isInterrupted()) {
            throw new CancellationException("Upload canceled.");
        }
        if (storeRedactedOnly && redactedContents == null) {
            try {
                redactedContents = aiService.redactFile(contents, filename, contentType, user, userTaxId, redactName,
                        redactTerms, null);
                redactedContentType = contentType;
            } catch (Exception e) {
                logger.warn("Failed to generate redacted file: {}", e.getMessage());
            }
        }
        if (!storeRedactedOnly) {
            redactedContents = null;
            redactedContentType = null;
        }
        if (storeRedactedOnly && redactedContents == null) {
            redactedContents = contents;
            redactedContentType = contentType;
        }
        List<Invoice> extraction;
        try {
            extraction = extractService.extract(contents, filename, contentType, user, userTaxId, redactName,
                    redactTerms);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to parse AI extraction response.", e);
        }

        if (Thread.currentThread().isInterrupted()) {
            throw new CancellationException("Upload canceled.");
        }
        List<Invoice> invoiceList = extractInvoices(extraction, user);

        if (Thread.currentThread().isInterrupted()) {
            throw new CancellationException("Upload canceled.");
        }
        InvoiceSaveResult saveResult = saveInvoices(
                invoiceList,
                contents,
                contentType,
                filename,
                redactedContents,
                redactedContentType,
                storeRedactedOnly);
        if (saveResult.saved().isEmpty() && saveResult.duplicateCount() > 0) {
            throw new DuplicateInvoiceException("Fatura já existe no sistema.", saveResult.duplicates());
        }

        return saveResult.saved();
    }

    @Async
    public CompletableFuture<List<Invoice>> processBytesAsync(byte[] contents, String filename, String contentType,
            User user) {
        return processBytesAsync(contents, filename, contentType, user, null, null, null, false, null, null, null);
    }

    @Async
    public CompletableFuture<List<Invoice>> processBytesAsync(byte[] contents,
            String filename,
            String contentType,
            User user,
            String userTaxId,
            String redactName,
            String redactTerms,
            boolean storeRedactedOnly,
            byte[] redactedContents,
            String redactedContentType,
            String userKey) {
        try {
            if (userKey != null && !userKey.isBlank()) {
                UserKeyContext.setKeyFromBase64(userKey);
            }
            return CompletableFuture.completedFuture(
                    processBytes(contents,
                            filename,
                            contentType,
                            user,
                            userTaxId,
                            redactName,
                            redactTerms,
                            storeRedactedOnly,
                            redactedContents,
                            redactedContentType));
        } catch (Exception e) {
            if (e instanceof DuplicateInvoiceException) {
                logger.info("Duplicate invoice detected for uploaded file.");
            } else {
                logger.error("Failed to process file asynchronously", e);
            }
            return CompletableFuture.failedFuture(e);
        } finally {
            UserKeyContext.clear();
        }
    }

    public CompletableFuture<List<Invoice>> processFileAsync(MultipartFile file, User user) {
        return processFileAsync(file, user, null, null, null, false, null, null, null);
    }

    public CompletableFuture<List<Invoice>> processFileAsync(MultipartFile file,
            User user,
            String userTaxId,
            String redactName,
            String redactTerms,
            boolean storeRedactedOnly,
            byte[] redactedContents,
            String redactedContentType,
            String userKey) {
        try {
            byte[] contents = file.getBytes();
            return processBytesAsync(
                    contents,
                    file.getOriginalFilename(),
                    file.getContentType(),
                    user,
                    userTaxId,
                    redactName,
                    redactTerms,
                    storeRedactedOnly,
                    redactedContents,
                    redactedContentType,
                    userKey);
        } catch (IOException e) {
            return CompletableFuture.failedFuture(e);
        }
    }

    private void checkBudgetThresholds(User user, Invoice newInvoice) {
        // 1. Ignore if it is revenue (Invoice.java uses boolean isRevenue)
        if (newInvoice.isRevenue())
            return;

        // 2. Ensure the invoice has a category
        if (newInvoice.getCategory() == null)
            return;

        String category = newInvoice.getCategory();
        LocalDate date = newInvoice.getDate();

        // 3. Fetch budget for invoice category and month/year
        // Note: BudgetRepository uses findByCategoryIgnoreCaseAndMonthAndYear
        Optional<Budget> budgetOpt = budgetRepository.findByUser(user).stream()
                .filter(budget -> budget.getCategory() != null
                        && budget.getCategory().equalsIgnoreCase(category))
                .filter(budget -> budget.getMonth() != null && budget.getMonth() == date.getMonthValue())
                .filter(budget -> budget.getYear() != null && budget.getYear() == date.getYear())
                .findFirst();

        if (budgetOpt.isPresent()) {
            Budget budget = budgetOpt.get();

            // 4. Compute total spent: (DB sum) + (current invoice being processed)
            // Uses sumByCategoryAndMonthIgnoreCase from InvoiceRepository
            List<Invoice> invoices = invoiceRepository.findByUser(user);
            double dbTotal = invoices.stream()
                    .filter(invoice -> invoice.getCategory() != null
                            && invoice.getCategory().equalsIgnoreCase(category))
                    .filter(invoice -> invoice.getDate() != null
                            && invoice.getDate().getMonthValue() == date.getMonthValue()
                            && invoice.getDate().getYear() == date.getYear())
                    .filter(invoice -> !invoice.isRevenue())
                    .map(Invoice::getTotalAmount)
                    .filter(value -> value != null)
                    .mapToDouble(Double::doubleValue)
                    .sum();

            double totalSpent = dbTotal + (newInvoice.getTotalAmount() != null ? newInvoice.getTotalAmount() : 0.0);
            double limit = budget.getMonthlyLimit(); // Assumes Budget model uses monthlyLimit

            // 5. Check thresholds (100% and 80%)
            if (totalSpent >= limit) {
                // Over the limit
                createNotification(user,
                        "Warning: You exceeded the budget limit for " + category + "!",
                        Notification.NotificationType.BUDGET_ALERT);
            } else if (totalSpent >= (limit * 0.8)) {
                // Reached 80% of the limit
                createNotification(user,
                        "Alert: You reached 80% of your budget for " + category + "!",
                        Notification.NotificationType.BUDGET_ALERT);
            }
        }
    }

    private void createNotification(User user, String message, Notification.NotificationType type) {
        Notification notif = Notification.builder()
                .user(user)
                .message(message)
                .type(type)
                .createdAt(LocalDateTime.now())
                .isRead(false)
                .build();
        notificationRepository.save(notif);
    }

    @Transactional
    public Invoice saveInvoice(Invoice invoice, Long accountId) {
        if (invoice.getUser() != null && invoice.getIssuer() != null) {
            String taxId = invoice.getIssuer().getTaxId();
            String issuerName = invoice.getIssuer().getName();
            List<Invoice> existingInvoices = invoiceRepository.findByUser(invoice.getUser());
            Optional<Invoice> duplicate = existingInvoices.stream()
                    .filter(inv -> inv.getDocumentNum() != null
                            && invoice.getDocumentNum() != null
                            && inv.getDocumentNum().equalsIgnoreCase(invoice.getDocumentNum()))
                    .filter(inv -> {
                        if (inv.getIssuer() == null)
                            return false;
                        if (taxId != null && inv.getIssuer().getTaxId() != null) {
                            return inv.getIssuer().getTaxId().equalsIgnoreCase(taxId);
                        }
                        return issuerName != null && inv.getIssuer().getName() != null
                                && inv.getIssuer().getName().equalsIgnoreCase(issuerName);
                    })
                    .findFirst();
            if (duplicate.isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Fatura já existe no sistema.");
            }
        }
        // 1. Save the invoice
        Invoice savedInvoice = invoiceRepository.save(invoice);

        // 2. Update account balance
        // If the invoice has a value, update the linked account balance
        if (accountId != null && savedInvoice.getTotalAmount() != null) {
            accountService.updateBalance(
                    accountId,
                    BigDecimal.valueOf(savedInvoice.getTotalAmount()),
                    savedInvoice.isRevenue());
        }

        return savedInvoice;
    }

    @Transactional
    public Invoice createManualInvoice(InvoiceCreateRequest request, User user) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dados da fatura em falta.");
        }
        if (isBlank(request.documentNum()) || request.date() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Número e data da fatura são obrigatórios.");
        }
        if (request.revenue() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de fatura obrigatório.");
        }
        if (request.totalAmount() == null || request.taxAmount() == null || request.netAmount() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Totais da fatura são obrigatórios.");
        }
        String issuerTaxId = isBlank(request.issuerTaxId()) ? null : request.issuerTaxId().trim();
        String issuerName = isBlank(request.issuerName()) ? null : request.issuerName().trim();
        String issuerCategory = isBlank(request.issuerCategory()) ? null : request.issuerCategory().trim();
        boolean hasIssuerTaxId = issuerTaxId != null;
        boolean hasIssuerName = issuerName != null;
        if (hasIssuerTaxId && !hasIssuerName) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Preencha o nome do emissor.");
        }

        Issuer issuer = null;
        if (hasIssuerName) {
            issuer = resolveIssuer(issuerTaxId, issuerName);
        }
        Account account = null;
        if (request.accountId() != null) {
            account = accountService.getAccountById(request.accountId(), user);
            if (account == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found.");
            }
        }

        Invoice invoice = Invoice.builder()
                .user(user)
                .account(account)
                .documentNum(request.documentNum())
                .date(request.date())
                .issuer(issuer)
                .category(resolveInvoiceCategory(user, issuerTaxId, issuerCategory))
                .items(request.items())
                .revenue(request.revenue())
                .totalAmount(request.totalAmount())
                .taxAmount(request.taxAmount())
                .netAmount(request.netAmount())
                .licensePlate(request.licensePlate())
                .paymentMethod(request.paymentMethod())
                .notes(request.notes())
                .build();

        if (invoice.isRevenue() && isBlank(invoice.getCategory())) {
            invoice.setCategory("REVENUE");
        }

        checkBudgetThresholds(user, invoice);

        return saveInvoice(invoice, request.accountId());
    }

    @Transactional
    public Invoice createSharedInvoice(InvoiceCreateRequest request, User user, Long shareId) {
        Invoice invoice = createManualInvoice(request, user);
        invoice.setSharedFromShareId(shareId);
        return invoiceRepository.save(invoice);
    }

    @Transactional
    public Invoice updateInvoice(String publicId, InvoiceUpdateRequest request, User user) {
        Invoice invoice = invoiceRepository.findByPublicIdAndUserUsernameIgnoreCase(publicId, user.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found."));

        Account oldAccount = invoice.getAccount();
        Double oldTotal = invoice.getTotalAmount();
        boolean oldRevenue = invoice.isRevenue();
        String oldFileId = invoice.getFileID();
        String oldRedactedFileId = invoice.getRedactedFileID();

        if (request.documentNum() != null) {
            invoice.setDocumentNum(request.documentNum());
        }
        if (request.date() != null) {
            invoice.setDate(request.date());
        }
        if (request.revenue() != null) {
            invoice.setRevenue(request.revenue());
        }
        if (request.totalAmount() != null) {
            invoice.setTotalAmount(request.totalAmount());
        }
        if (request.taxAmount() != null) {
            invoice.setTaxAmount(request.taxAmount());
        }
        if (request.netAmount() != null) {
            invoice.setNetAmount(request.netAmount());
        }
        if (request.licensePlate() != null) {
            invoice.setLicensePlate(request.licensePlate());
        }
        if (request.paymentMethod() != null) {
            invoice.setPaymentMethod(request.paymentMethod());
        }
        if (request.notes() != null) {
            invoice.setNotes(request.notes());
        }
        if (request.items() != null) {
            invoice.setItems(request.items());
        }

        if (request.issuerName() != null || request.issuerTaxId() != null) {
            String issuerName = isBlank(request.issuerName())
                    ? null
                    : request.issuerName().trim();
            String issuerTaxId = isBlank(request.issuerTaxId())
                    ? null
                    : request.issuerTaxId().trim();
            if (issuerTaxId != null && issuerName == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Preencha o nome do emissor.");
            }
            if (issuerName != null) {
                Issuer issuer = resolveIssuer(issuerTaxId, issuerName);
                invoice.setIssuer(issuer);
                if (invoice.getCategory() == null) {
                    invoice.setCategory(resolveInvoiceCategory(user, issuerTaxId, null));
                }
            }
        }

        if (request.issuerCategory() != null) {
            String trimmedCategory = isBlank(request.issuerCategory()) ? null : request.issuerCategory().trim();
            invoice.setCategory(trimmedCategory);
        }

        if (invoice.isRevenue() && isBlank(invoice.getCategory())) {
            invoice.setCategory("REVENUE");
        }

        if (oldRevenue != invoice.isRevenue()) {
            boolean fileIsRedacted = oldFileId != null && oldFileId.equals(oldRedactedFileId);
            if (oldFileId != null && !oldFileId.isBlank()) {
                InvoiceFilePathContext fileContext = buildFilePathContext(invoice, fileIsRedacted);
                String movedFileId = fileStorage.move(oldFileId, fileContext);
                invoice.setFileID(movedFileId);
                if (fileIsRedacted) {
                    invoice.setRedactedFileID(movedFileId);
                }
            }
            if (oldRedactedFileId != null && !oldRedactedFileId.isBlank()
                    && (oldFileId == null || !oldRedactedFileId.equals(oldFileId))) {
                InvoiceFilePathContext redactedContext = buildFilePathContext(invoice, true);
                String movedRedactedId = fileStorage.move(oldRedactedFileId, redactedContext);
                invoice.setRedactedFileID(movedRedactedId);
            }
        }

        if (request.accountId() != null) {
            Account account = accountService.getAccountById(request.accountId(), user);
            if (account == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found.");
            }
            invoice.setAccount(account);
        } else if (Boolean.TRUE.equals(request.clearAccount())) {
            invoice.setAccount(null);
        }

        Invoice saved = invoiceRepository.save(invoice);

        Account newAccount = saved.getAccount();
        Double newTotal = saved.getTotalAmount();
        boolean newRevenue = saved.isRevenue();

        boolean balanceChanged = !Objects.equals(oldTotal, newTotal) || oldRevenue != newRevenue
                || (oldAccount == null && newAccount != null)
                || (oldAccount != null && newAccount == null)
                || (oldAccount != null && newAccount != null
                        && !Objects.equals(oldAccount.getId(), newAccount.getId()));

        if (balanceChanged) {
            if (oldAccount != null) {
                accountService.updateBalance(oldAccount, oldTotal, !oldRevenue);
            }
            if (newAccount != null) {
                accountService.updateBalance(newAccount, newTotal, newRevenue);
            }
        }

        return saved;
    }

    @Transactional
    public void deleteInvoice(String publicId, User user) {
        Invoice invoice = invoiceRepository.findByPublicIdAndUserUsernameIgnoreCase(publicId, user.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found."));

        Account account = invoice.getAccount();
        if (account != null) {
            accountService.updateBalance(account, invoice.getTotalAmount(), !invoice.isRevenue());
        }

        String fileId = invoice.getFileID();
        String redactedFileId = invoice.getRedactedFileID();
        boolean shouldDeleteFile = fileId != null && !fileId.isBlank()
                && invoiceRepository.countByFileID(fileId) <= 1;
        boolean shouldDeleteRedacted = redactedFileId != null && !redactedFileId.isBlank()
            && invoiceRepository.countByRedactedFileID(redactedFileId) <= 1;

        cleanupShareTempFiles(publicId, user.getUsername());
        invoiceRepository.delete(invoice);

        if (shouldDeleteFile) {
            deleteFileSafely(fileId);
        }
        if (shouldDeleteRedacted && (fileId == null || !redactedFileId.equals(fileId))) {
            deleteFileSafely(redactedFileId);
        }
    }

    private void cleanupShareTempFiles(String publicId, String username) {
        try {
            List<pt.rodrigimix.invodata.model.InvoiceShare> shares =
                    invoiceShareRepository.findByInvoicePublicIdAndCreatedByUsernameIgnoreCase(publicId, username);
            if (shares.isEmpty()) {
                return;
            }
            Path tempDir = Paths.get(settingsService.resolveStorage().mediaPath(), TEMP_SHARE_DIR);
            for (pt.rodrigimix.invodata.model.InvoiceShare share : shares) {
                String tempFileId = share.getTempFileId();
                if (tempFileId == null || tempFileId.isBlank()) {
                    continue;
                }
                try {
                    Files.deleteIfExists(tempDir.resolve(tempFileId));
                } catch (Exception ignored) {
                    // Best-effort cleanup.
                }
            }
        } catch (Exception ignored) {
            // Best-effort cleanup.
        }
    }

    private void deleteFileSafely(String fileId) {
        fileStorage.delete(fileId);
    }

    public long countInvoicesByMonthAndUser(String username, int month, int year) {
        return invoiceRepository.countUploadedInvoicesByMonthAndUser(username, month, year);
    }

    public long countUploadedInvoicesByMonthAndUser(String username, int month, int year) {
        return invoiceRepository.countUploadedInvoicesByMonthAndUser(username, month, year);
    }

    private Issuer resolveIssuer(String taxId, String name) {
        if (isBlank(name)) {
            return null;
        }
        String trimmedName = name.trim();
        String trimmedTaxId = isBlank(taxId) ? null : taxId.trim();
        Issuer issuer = trimmedTaxId != null
                ? issuerRepository.findByNameOrTaxIdIgnoreCase(trimmedName, trimmedTaxId)
                        .orElseGet(() -> issuerRepository.save(Issuer.builder()
                                .taxId(trimmedTaxId)
                                .name(trimmedName)
                                .build()))
                : issuerRepository.findByName(trimmedName)
                        .orElseGet(() -> issuerRepository.save(Issuer.builder()
                                .taxId(null)
                                .name(trimmedName)
                                .build()));
        return issuer;
    }

    private String resolveInvoiceCategory(User user, String issuerTaxId, String fallbackCategory) {
        if (!isBlank(fallbackCategory)) {
            return fallbackCategory.trim();
        }
        if (user == null || isBlank(issuerTaxId)) {
            return null;
        }
        return invoiceRepository
                .findTopByUserUsernameIgnoreCaseAndIssuerTaxIdIgnoreCaseOrderByCreatedAtDesc(
                        user.getUsername(), issuerTaxId)
                .map(Invoice::getCategory)
                .orElse(null);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
