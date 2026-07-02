package pt.rodrigimix.invodata.service.invoice;

import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Tuple;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
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
import pt.rodrigimix.invodata.model.*;
import pt.rodrigimix.invodata.repository.BudgetRepository;
import pt.rodrigimix.invodata.repository.InvoiceRepository;
import pt.rodrigimix.invodata.repository.IssuerRepository;
import pt.rodrigimix.invodata.repository.NotificationRepository;
import pt.rodrigimix.invodata.service.account.AccountService;
import pt.rodrigimix.invodata.service.ai.AIService;
import pt.rodrigimix.invodata.service.extraction.ExtractService;
import pt.rodrigimix.invodata.service.invoice.storage.InvoiceFileStorage;

import java.io.IOException;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CancellationException;
import java.util.stream.Collectors;

@Service
public class InvoiceService {

    private static final DateTimeFormatter STORAGE_DATE_FORMAT = DateTimeFormatter.ofPattern("dd-MM-uuuu");

    private final Logger logger = LoggerFactory.getLogger(InvoiceService.class);

    private final InvoiceRepository invoiceRepository;

    private final IssuerRepository issuerRepository;

    private final ExtractService extractService;

    private final AccountService accountService;

    private final AIService aiService;

    private final InvoiceFileStorage fileStorage;

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
            NotificationRepository notificationRepository) {
        this.invoiceRepository = invoiceRepository;
        this.issuerRepository = issuerRepository;
        this.extractService = extractService;
        this.accountService = accountService;
        this.aiService = aiService;
        this.fileStorage = fileStorage;
        this.budgetRepository = budgetRepository;
        this.notificationRepository = notificationRepository;
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

        if (invoices.isEmpty()) {
            return new InvoiceSaveResult(List.of(), List.of(), 0, 0);
        }

        List<Invoice> newInvoices = new ArrayList<>();
        List<Invoice> duplicateInvoices = new ArrayList<>();
        int duplicateCount = 0;

        // 1. OTIMIZAÇÃO: Procura duplicados em lote
        String username = invoices.get(0).getUser().getUsername();
        List<String> docNumbers = invoices.stream()
                .map(Invoice::getDocumentNum)
                .filter(Objects::nonNull)
                .toList();

        List<Invoice> potentialDuplicates = invoiceRepository.findByDocumentNumInAndUserUsernameIgnoreCase(docNumbers, username);

        for (Invoice invoice : invoices) {
            if (invoice.getOriginalFileName() == null || invoice.getOriginalFileName().isBlank()) {
                invoice.setOriginalFileName(originalFileName);
            }

            // 2. OTIMIZAÇÃO: Verifica duplicados em memória
            Optional<Invoice> existing = potentialDuplicates.stream()
                    .filter(e -> e.getDocumentNum().equalsIgnoreCase(invoice.getDocumentNum()) &&
                            e.getIssuer().getTaxId().equalsIgnoreCase(invoice.getIssuer().getTaxId()))
                    .findFirst();

            if (existing.isEmpty()) {
                newInvoices.add(invoice);
            } else {
                duplicateCount++;
                existing.ifPresent(duplicateInvoices::add);
                logger.debug("Duplicate detected: {}. Skipping.", invoice.getDocumentNum());
            }
        }

        if (newInvoices.isEmpty()) {
            return new InvoiceSaveResult(List.of(), duplicateInvoices, duplicateCount, invoices.size());
        }

        // Armazenamento de ficheiros - apenas o ficheiro original
        String fileId = null;
        Invoice referenceInvoice = newInvoices.get(0);
        String storagePath = buildStoragePath(referenceInvoice, contentType, originalFileName, false);

        fileId = fileStorage.save(contentType, contents, storagePath);

        // 3. OTIMIZAÇÃO: Preparar e atualizar saldos
        for (Invoice invoice : newInvoices) {
            invoice.setFileID(fileId);

            if (invoice.getAccount() != null) {
                accountService.updateBalance(invoice.getAccount(), invoice.getTotalAmount(), invoice.isRevenue());
            }
        }

        // 4. OTIMIZAÇÃO: Verificação de orçamentos em lote ANTES de gravar
        processBulkBudgetThresholds(newInvoices.get(0).getUser(), newInvoices);

        invoiceRepository.saveAll(newInvoices);
        return new InvoiceSaveResult(newInvoices, duplicateInvoices, duplicateCount, invoices.size());
    }

    private void processBulkBudgetThresholds(User user, List<Invoice> newInvoices) {
        Map<String, Double> totalsByCategoryAndMonth = newInvoices.stream()
                .filter(inv -> !inv.isRevenue())
                .filter(inv -> inv.getIssuer() != null && inv.getIssuer().getCategory() != null)
                .collect(Collectors.groupingBy(
                        inv -> {
                            LocalDate d = inv.getDate() != null ? inv.getDate() : LocalDate.now();
                            return inv.getIssuer().getCategory() + "|" + d.getMonthValue() + "|" + d.getYear();
                        },
                        Collectors.summingDouble(Invoice::getTotalAmount)
                ));

        totalsByCategoryAndMonth.forEach((key, bulkAmount) -> {
            String[] parts = key.split("\\|");
            String category = parts[0];
            int month = Integer.parseInt(parts[1]);
            int year = Integer.parseInt(parts[2]);

            budgetRepository.findByCategoryIgnoreCaseAndMonthAndYear(category, month, year).ifPresent(budget -> {
                Double dbTotal = invoiceRepository.sumByCategoryAndMonthIgnoreCase(category, month, year, user.getUsername());
                double previousTotal = (dbTotal != null ? dbTotal : 0.0);
                double newTotal = previousTotal + bulkAmount;
                double limit = budget.getMonthlyLimit();

                if (newTotal >= limit && previousTotal < limit) {
                    createNotification(user, "Aviso: Este upload excedeu o orçamento de " + category + "!", Notification.NotificationType.BUDGET_ALERT);
                } else if (newTotal >= (limit * 0.8) && previousTotal < (limit * 0.8)) {
                    createNotification(user, "Alerta: Este upload atingiu 80% do orçamento de " + category + "!", Notification.NotificationType.BUDGET_ALERT);
                }
            });
        });
    }

    private void associateIssue(Invoice invoice) {
        Issuer issuer = issuerRepository
                .findByNameOrTaxIdIgnoreCase(invoice.getIssuer().getName(), invoice.getIssuer().getTaxId())
                .orElseGet(() -> {
                    logger.debug("Issuer not found. Creating new issuer.");
                    Issuer rawIssuer = invoice.getIssuer();

                    Optional<Issuer> existingByName = issuerRepository.findByName(rawIssuer.getName());

                    if (existingByName.isPresent() && existingByName.get().getCategory() != null) {
                        String cachedCategory = existingByName.get().getCategory();
                        rawIssuer.setCategory(cachedCategory);
                        logger.info("Category cache hit: {}", cachedCategory);
                    } else {
                        if (invoice.getUser() != null && Boolean.TRUE.equals(invoice.getUser().getAiConsent())) {
                            logger.trace("Attempting to enrich issuer via AI.");
                            enrichIssuer(rawIssuer, invoice.getItems(), aiService, logger);
                        } else {
                            rawIssuer.setCategory("Uncategorized");
                        }
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

        Optional<Invoice> existingInvoice = invoiceRepository
                .findByDocumentNumAndIssuerAndUserUsernameIgnoreCase(
                        invoice.getDocumentNum(),
                        issuer,
                        invoice.getUser().getUsername());

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

    public static void enrichIssuer(Issuer issuer, List<Item> items, AIService aiService, Logger logger) {
        try {
            String category = aiService.categorizeIssuer(issuer.getName(), "Unknown", items);
            issuer.setCategory(category != null ? category : "Uncategorized");
            logger.debug("Issuer enriched with category: {}", issuer.getCategory());
        } catch (Exception e) {
            logger.error("Failed to enrich issuer: {}", e.getMessage());
            issuer.setCategory("Uncategorized");
        }
    }

    public Page<Invoice> getFilteredInvoices(String username, String search, String issuerName, String category,
            String paymentMethod, String originalFileName, Long accountId, LocalDate createdOn, LocalDate startDate,
            LocalDate endDate, Double minAmount, Boolean revenue, Pageable pageable) {
        Specification<Invoice> spec = buildInvoiceSpecification(
                username,
                search,
                issuerName,
                category,
                paymentMethod,
                originalFileName,
                accountId,
                createdOn,
                startDate,
                endDate,
                minAmount,
                revenue);
        return invoiceRepository.findAll(spec, pageable);
    }

    public pt.rodrigimix.invodata.dto.InvoiceTotalsResponse getInvoiceTotals(String username, String search,
            String issuerName, String category, String paymentMethod, String originalFileName, Long accountId,
            LocalDate createdOn, LocalDate startDate, LocalDate endDate, Double minAmount, Boolean revenue) {
        Specification<Invoice> spec = buildInvoiceSpecification(
                username,
                search,
                issuerName,
                category,
                paymentMethod,
                originalFileName,
                accountId,
                createdOn,
                startDate,
                endDate,
                minAmount,
                revenue);

        var cb = entityManager.getCriteriaBuilder();
        var query = cb.createTupleQuery();
        var root = query.from(Invoice.class);
        var predicate = spec.toPredicate(root, query, cb);
        if (predicate != null) {
            query.where(predicate);
        }
        query.multiselect(
                cb.coalesce(cb.sum(root.get("netAmount")), 0d).alias("netTotal"),
                cb.coalesce(cb.sum(root.get("taxAmount")), 0d).alias("taxTotal"),
                cb.coalesce(cb.sum(root.get("totalAmount")), 0d).alias("totalAmount"));

        Tuple result = entityManager.createQuery(query).getSingleResult();
        double netTotal = result.get("netTotal", Number.class).doubleValue();
        double taxTotal = result.get("taxTotal", Number.class).doubleValue();
        double totalAmount = result.get("totalAmount", Number.class).doubleValue();
        return new pt.rodrigimix.invodata.dto.InvoiceTotalsResponse(netTotal, taxTotal, totalAmount);
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

    public Invoice getInvoiceById(Long invoiceId, User user) {
        return invoiceRepository.findById(invoiceId)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found."));
    }

    public InvoiceFileData getInvoiceFile(Long invoiceId, User user) {
        Invoice invoice = getInvoiceById(invoiceId, user);
        String fileId = invoice.getFileID();
        if (fileId == null || fileId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not available.");
        }
        return fileStorage.load(fileId);
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
                filename);
        if (saveResult.saved().isEmpty() && saveResult.duplicateCount() > 0) {
            throw new DuplicateInvoiceException("Fatura já existe no sistema.", saveResult.duplicates());
        }

        return saveResult.saved();
    }

    @Async
    public CompletableFuture<List<Invoice>> processBytesAsync(byte[] contents, String filename, String contentType,
            User user) {
        return processBytesAsync(contents, filename, contentType, user, null, null, null, false, null, null);
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
            String redactedContentType) {
        try {
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
        }
    }

    public CompletableFuture<List<Invoice>> processFileAsync(MultipartFile file, User user) {
        return processFileAsync(file, user, null, null, null, false, null, null);
    }

    public CompletableFuture<List<Invoice>> processFileAsync(MultipartFile file,
            User user,
            String userTaxId,
            String redactName,
            String redactTerms,
            boolean storeRedactedOnly,
            byte[] redactedContents,
            String redactedContentType) {
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
                    redactedContentType);
        } catch (IOException e) {
            return CompletableFuture.failedFuture(e);
        }
    }

    private void checkBudgetThresholds(User user, Invoice newInvoice) {
        // 1. Ignore if it is revenue (Invoice.java uses boolean isRevenue)
        if (newInvoice.isRevenue())
            return;

        // 2. Ensure the invoice has an issuer and category
        if (newInvoice.getIssuer() == null || newInvoice.getIssuer().getCategory() == null)
            return;

        String category = newInvoice.getIssuer().getCategory();
        LocalDate date = newInvoice.getDate();

        if (date == null) date = LocalDate.now();

        // 3. Fetch budget for invoice category and month/year
        // Note: BudgetRepository uses findByCategoryIgnoreCaseAndMonthAndYear
        Optional<Budget> budgetOpt = budgetRepository.findByCategoryIgnoreCaseAndMonthAndYear(
                category,
                date.getMonthValue(),
                date.getYear());

        if (budgetOpt.isPresent()) {
            Budget budget = budgetOpt.get();

            // 4. Compute total spent: (DB sum) + (current invoice being processed)
            // Uses sumByCategoryAndMonthIgnoreCase from InvoiceRepository
            Double dbTotal = invoiceRepository.sumByCategoryAndMonthIgnoreCase(
                    category,
                    date.getMonthValue(),
                    date.getYear(),
                    user.getUsername());

            // If dbTotal is null (no previous spend), assume 0.0
            double totalSpent = (dbTotal != null ? dbTotal : 0.0) + newInvoice.getTotalAmount();
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
            if (invoiceRepository.existsDuplicateInvoice(
                    invoice.getDocumentNum(),
                    taxId,
                    issuerName,
                    invoice.getUser().getUsername())) {
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
        if (hasIssuerTaxId != hasIssuerName) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Preencha NIF e nome ou deixe ambos vazios.");
        }

        Issuer issuer = null;
        if (hasIssuerTaxId && hasIssuerName) {
            issuer = resolveIssuer(issuerTaxId, issuerName, issuerCategory);
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
                .items(request.items())
                .revenue(request.revenue())
                .totalAmount(request.totalAmount())
                .taxAmount(request.taxAmount())
                .netAmount(request.netAmount())
                .licensePlate(request.licensePlate())
                .paymentMethod(request.paymentMethod())
                .notes(request.notes())
                .build();

        checkBudgetThresholds(user, invoice);

        return saveInvoice(invoice, request.accountId());
    }

    @Transactional
    public Invoice updateInvoice(Long invoiceId, InvoiceUpdateRequest request, User user) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found."));

        Account oldAccount = invoice.getAccount();
        Double oldTotal = invoice.getTotalAmount();
        boolean oldRevenue = invoice.isRevenue();

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

        if (request.issuerName() != null || request.issuerTaxId() != null || request.issuerCategory() != null) {
            String issuerName = request.issuerName() != null
                    ? request.issuerName()
                    : invoice.getIssuer() != null ? invoice.getIssuer().getName() : "Unknown";
            String issuerTaxId = request.issuerTaxId() != null
                    ? request.issuerTaxId()
                    : invoice.getIssuer() != null ? invoice.getIssuer().getTaxId() : null;
            String category = request.issuerCategory() != null
                    ? request.issuerCategory()
                    : invoice.getIssuer() != null ? invoice.getIssuer().getCategory() : null;
            Issuer issuer = resolveIssuer(issuerTaxId, issuerName, category);
            invoice.setIssuer(issuer);
        }

        if (invoice.isRevenue() && invoice.getIssuer() != null) {
            invoice.getIssuer().setCategory("REVENUE");
            issuerRepository.save(invoice.getIssuer());
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
    public void deleteInvoice(Long invoiceId, User user) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .filter(existing -> existing.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found."));

        Account account = invoice.getAccount();
        if (account != null) {
            accountService.updateBalance(account, invoice.getTotalAmount(), !invoice.isRevenue());
        }

        String fileId = invoice.getFileID();
        boolean shouldDeleteFile = fileId != null && !fileId.isBlank()
                && invoiceRepository.countByFileID(fileId) <= 1;

        invoiceRepository.delete(invoice);

        if (shouldDeleteFile) {
            deleteFileSafely(fileId);
        }
    }

    private void deleteFileSafely(String fileId) {
        fileStorage.delete(fileId);
    }

    public long countInvoicesByMonthAndUser(String username, int month, int year) {
        return invoiceRepository.countInvoicesByMonthAndUser(username, month, year);
    }

    private Issuer resolveIssuer(String taxId, String name, String category) {
         Issuer issuer = issuerRepository.findByNameOrTaxIdIgnoreCase(name, taxId)
                 .orElseGet(() -> issuerRepository.save(Issuer.builder()
                         .taxId(taxId)
                         .name(name)
                         .category(isBlank(category) ? null : category.trim())
                         .build()));
         // Update category if a new one is provided
         if (!isBlank(category)) {
             String newCategory = category.trim();
             // Only update if it's different from current category
             if (!newCategory.equals(issuer.getCategory())) {
                 issuer.setCategory(newCategory);
                 issuerRepository.save(issuer);
             }
         }
         return issuer;
     }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String buildStoragePath(Invoice invoice, String contentType, String originalFileName, boolean redacted) {
        LocalDate issueDate = invoice.getDate() != null ? invoice.getDate() : LocalDate.now();
        String year = String.valueOf(issueDate.getYear());
        String typeFolder = invoice.isRevenue() ? "Receita" : "Despesas";
        String entityName = sanitizeEntityName(invoice.getIssuer() != null ? invoice.getIssuer().getName() : null);
        String baseName = issueDate.format(STORAGE_DATE_FORMAT) + "_" + entityName;
        if (redacted) {
            baseName += "-mascarada";
        }
        String extension = resolveExtension(contentType, originalFileName);
        return year + "/" + typeFolder + "/" + baseName + extension;
    }

    private String sanitizeEntityName(String value) {
        if (isBlank(value)) {
            return "SemEntidade";
        }
        String normalized = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^A-Za-z0-9 _-]", "")
                .trim()
                .replaceAll("\\s+", "-");
        return normalized.isBlank() ? "SemEntidade" : normalized;
    }

    private String resolveExtension(String contentType, String originalFileName) {
        if (!isBlank(originalFileName)) {
            String trimmed = originalFileName.trim();
            int dotIndex = trimmed.lastIndexOf('.');
            if (dotIndex > -1 && dotIndex < trimmed.length() - 1) {
                String extension = trimmed.substring(dotIndex);
                if (extension.matches("\\.[A-Za-z0-9]{1,10}")) {
                    return extension.toLowerCase();
                }
            }
        }
        if ("application/pdf".equalsIgnoreCase(contentType)) {
            return ".pdf";
        }
        if ("image/jpeg".equalsIgnoreCase(contentType)) {
            return ".jpg";
        }
        if ("image/png".equalsIgnoreCase(contentType)) {
            return ".png";
        }
        return "";
    }
}
