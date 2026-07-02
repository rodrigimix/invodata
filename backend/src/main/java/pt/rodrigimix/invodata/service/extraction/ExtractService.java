package pt.rodrigimix.invodata.service.extraction;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.AiExtractionResponse;
import pt.rodrigimix.invodata.dto.VIESResponse;
import pt.rodrigimix.invodata.dto.ExtractionDTO;
import pt.rodrigimix.invodata.model.*;
import pt.rodrigimix.invodata.repository.IssuerRepository;
import pt.rodrigimix.invodata.service.ai.AIService;
import pt.rodrigimix.invodata.service.extraction.qrProcessor.QRProcessor;

import java.io.File;
import java.io.IOException;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class ExtractService {

    private static final Logger logger = LoggerFactory.getLogger(ExtractService.class);

    private final List<QRProcessor> processors;

    private final AIService aiService;

    private final IssuerRepository issuerRepository;

    private final VIESService viesService;

    @Autowired
    public ExtractService(List<QRProcessor> processors,
            AIService aiService,
            IssuerRepository issuerRepository,
            VIESService viesService) {
        this.processors = processors;
        this.aiService = aiService;
        this.issuerRepository = issuerRepository;
        this.viesService = viesService;
        logger.info("ExtractService initialized with {} processors", processors.size());
    }

    public List<Invoice> extract(MultipartFile file, User user) throws IOException {
        if (Thread.currentThread().isInterrupted()) {
            throw new RuntimeException("Extraction canceled.");
        }
        byte[] contents = file.getBytes();
        return extract(contents, file.getOriginalFilename(), file.getContentType(), user, null, null, null);
    }

    public List<Invoice> extract(byte[] contents, String filename, String contentType, User user)
            throws JsonProcessingException {
        return extract(contents, filename, contentType, user, null, null, null);
    }

    public List<Invoice> extract(byte[] contents, String filename, String contentType, User user, String userTaxId,
            String redactName, String redactTerms) throws JsonProcessingException {
        if (Thread.currentThread().isInterrupted()) {
            throw new RuntimeException("Extraction canceled.");
        }
        logger.info("Starting extraction.");

        List<Invoice> invoices = new ArrayList<>();

        if (!Boolean.TRUE.equals(user.getAiConsent())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "AI consent required. Enable it at /api/user/consent.");
        }

        logger.info("AI extraction enabled.");
        List<AiExtractionResponse> aiData = aiService.extractFullInvoiceData(contents, filename, contentType, user,
                userTaxId, redactName, redactTerms);
        if (Thread.currentThread().isInterrupted()) {
            throw new RuntimeException("Extraction canceled.");
        }

        for (AiExtractionResponse dataExtracted : aiData) {
            if (Thread.currentThread().isInterrupted()) {
                throw new RuntimeException("Extraction canceled.");
            }
            if (dataExtracted == null || dataExtracted.header() == null) {
                logger.error("Failed to extract invoice data.");
                throw new RuntimeException("No invoice data found in file: " + filename);
            }

            logger.debug("AI extraction successful.");
            Invoice invoice = mapToInvoice(dataExtracted, user);
            invoices.add(invoice);
        }

        logger.info("Extraction completed successfully.");
        return invoices;
    }

    @Deprecated
    private void qrCodeExtraction(boolean isRevenue, List<String> rawQrCodes, List<Invoice> invoices) {
        logger.info("Processing {} QR codes", rawQrCodes.size());
        for (String rawQrCode : rawQrCodes) {
            processors.stream()
                    .filter(p -> p.supports(rawQrCode))
                    .findFirst()
                    .ifPresentOrElse(
                            processor -> {
                                logger.debug("Processing QR code with processor: {}",
                                        processor.getClass().getSimpleName());
                                invoices.addAll(processor.process(List.of(rawQrCode), isRevenue));
                            },
                            () -> {
                                logger.warn("No processor found for QR code.");
                            });
        }
        logger.info("Successfully processed {} invoices from QR codes", invoices.size());
    }

    private Invoice mapToInvoice(AiExtractionResponse dataExtracted, User user) {
        logger.debug("Mapping AI header data to Invoice entity.");

        AiExtractionResponse.AiHeader aiData = dataExtracted.header();
        List<AiExtractionResponse.AiItem> extractedItems = dataExtracted.items();
        List<Item> items = new ArrayList<>();

        String issuerTaxId = aiData.issuerTaxId();
        Issuer issuer = issuerTaxId != null
                ? issuerRepository.findByTaxIdIgnoreCase(issuerTaxId).orElse(null)
                : null;

        if (issuer == null) {
            String resolvedName = resolveIssuerName(issuerTaxId, aiData.country(), aiData.issuerName());
            issuer = Issuer.builder()
                    .taxId(issuerTaxId)
                    .name(resolvedName)
                    .country(CountryCode.fromValue(aiData.country()))
                    .build();
        }

        Account account = null;
        if (aiData.accountName() != null) {
            account = Account.builder().name(aiData.accountName()).build();
        } else if (aiData.accountLast4() != null) {
            account = Account.builder().last4(aiData.accountLast4()).build();
        }

        boolean isRevenue = aiData.isRevenue();
        if (isRevenue && user != null && user.getName() != null && aiData.issuerName() != null) {
            String issuerName = aiData.issuerName().toLowerCase();
            String userName = user.getName().toLowerCase();
            if (!issuerName.contains(userName)) {
                isRevenue = false;
            }
        }

        Invoice invoice = Invoice.builder()
                .issuer(issuer)
                .documentNum(aiData.documentNum())
                .date(LocalDate.parse(aiData.date()))
                .totalAmount(aiData.totalAmount())
                .taxAmount(aiData.taxAmount())
                .netAmount(aiData.netAmount())
                .account(account)
                .paymentMethod(aiData.paymentMethod())
                .licensePlate(aiData.licensePlate())
                .revenue(isRevenue)
                .build();

        if (aiData.category() != null && !aiData.category().isBlank()) {
            invoice.setCategory(aiData.category().trim());
        }

        for (AiExtractionResponse.AiItem item : extractedItems) {
            Item item1 = Item.builder()
                    .description(titleCase(item.description()))
                    .quantity(item.quantity())
                    .unitPrice(item.unitPrice())
                    .totalPrice(item.totalPrice())
                    .taxPrice(item.taxPrice())
                    .taxPercent(item.taxPercent())
                    .build();

            items.add(item1);
        }

        invoice.setItems(items);

        logger.debug("Invoice mapped successfully. totalAmount={}", invoice.getTotalAmount());
        return invoice;
    }

    private String resolveIssuerName(String taxId, String country, String fallbackName) {
        String normalizedFallback = titleCase(fallbackName);
        if (taxId == null || taxId.isBlank()) {
            return normalizedFallback;
        }

        ViesLookup lookup = parseViesLookup(taxId, country);
        if (lookup == null) {
            return normalizedFallback;
        }

        VIESResponse viesResponse = viesService.validateVat(lookup.countryCode(), lookup.vatNumber());
        if (viesResponse != null && Boolean.TRUE.equals(viesResponse.getIsValid())) {
            String name = viesResponse.getName();
            if (name != null && !name.isBlank()) {
                return titleCase(name);
            }
        }
        return normalizedFallback;
    }

    private ViesLookup parseViesLookup(String taxId, String country) {
        String normalized = taxId.trim().replaceAll("\\s+", "");
        if (normalized.length() < 2) {
            return null;
        }
        String prefix = null;
        String vatNumber = null;
        if (Character.isLetter(normalized.charAt(0)) && Character.isLetter(normalized.charAt(1))) {
            prefix = normalized.substring(0, 2).toUpperCase(Locale.ROOT);
            vatNumber = normalized.substring(2);
        } else if (country != null && !country.isBlank()) {
            prefix = country.trim().toUpperCase(Locale.ROOT);
            vatNumber = normalized;
        }
        if (prefix == null || vatNumber == null || vatNumber.isBlank()) {
            return null;
        }
        if ("GR".equals(prefix)) {
            prefix = "EL";
        }
        CountryCode countryCode = CountryCode.fromValue(prefix);
        if (countryCode == null || !countryCode.isBelongsToVies()) {
            return null;
        }
        return new ViesLookup(countryCode, vatNumber);
    }

    private String titleCase(String value) {
        if (value == null || value.isBlank()) {
            return "Emitente";
        }
        String[] parts = value.trim().toLowerCase(Locale.ROOT).split("\\s+");
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (part.isEmpty()) {
                continue;
            }
            String normalized = part.substring(0, 1).toUpperCase(Locale.ROOT) + part.substring(1);
            if (builder.length() > 0) {
                builder.append(' ');
            }
            builder.append(normalized);
        }
        return builder.toString();
    }

    private record ViesLookup(CountryCode countryCode, String vatNumber) {
    }

}
