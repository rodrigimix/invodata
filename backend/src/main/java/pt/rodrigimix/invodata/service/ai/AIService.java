package pt.rodrigimix.invodata.service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.AiExtractionResponse;
import pt.rodrigimix.invodata.dto.CategoryResponse;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.Item;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.account.AccountService;
import pt.rodrigimix.invodata.service.invoice.category.InvoiceCategoryService;
import pt.rodrigimix.invodata.service.system.SystemSettingsService;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

@Service
public class AIService {

    private static final Logger logger = LoggerFactory.getLogger(AIService.class);

    private final AppConfig appConfig;

    private final AccountService accountService;

    private final SystemSettingsService settingsService;

    private final InvoiceCategoryService categoryService;

    private final RestTemplate restTemplate = new RestTemplate();

    private static final Set<String> ALLOWED_CATEGORIES = Set.of(
            "UTILITIES",
            "SUPERMARKET",
            "RESTAURANT",
            "ENTERTAINMENT",
            "TRANSPORT",
            "FUEL",
            "HEALTH",
            "TELECOM",
            "SERVICES",
            "EDUCATION",
            "CLOTHING");

    @Autowired
    public AIService(AppConfig appConfig, AccountService accountService, SystemSettingsService settingsService,
            InvoiceCategoryService categoryService) {
        this.appConfig = appConfig;
        this.accountService = accountService;
        this.settingsService = settingsService;
        this.categoryService = categoryService;
    }

    public List<AiExtractionResponse> extractFullInvoiceData(MultipartFile file, User user)
            throws JsonProcessingException {
        return extractFullInvoiceData(file, user, null, null, null);
    }

    public List<AiExtractionResponse> extractFullInvoiceData(MultipartFile file, User user, String userTaxId,
            String redactName, String redactTerms) throws JsonProcessingException {

        ensureAiEnabled();

        logger.info("Starting invoice data extraction.");

        byte[] contents;
        try {
            contents = file.getBytes();
        } catch (Exception e) {
            throw new RuntimeException("Failed to read file contents.", e);
        }
        String resolvedUserTaxId = (userTaxId != null && !userTaxId.isBlank())
            ? userTaxId
            : (user != null && user.getTaxId() != null ? user.getTaxId() : null);
        return extractFullInvoiceData(contents, file.getOriginalFilename(), file.getContentType(), user,
            resolvedUserTaxId, redactName, redactTerms);
    }

    public List<AiExtractionResponse> extractFullInvoiceData(byte[] contents, String filename, String contentType,
            User user) throws JsonProcessingException {
        return extractFullInvoiceData(contents, filename, contentType, user, null, null, null);
    }

    public List<AiExtractionResponse> extractFullInvoiceData(byte[] contents, String filename, String contentType,
            User user, String userTaxId, String redactName, String redactTerms) throws JsonProcessingException {
        ensureAiEnabled();
        if (Thread.currentThread().isInterrupted()) {
            throw new RuntimeException("Extraction canceled.");
        }
        logger.info("Starting invoice data extraction.");

        List<String> accountNames = accountService.getAccountsByUser(user)
                .stream()
                .map(account -> {
                    String name = account.getName() != null ? account.getName() : "Conta";
                    if (account.getLast4() != null && !account.getLast4().isBlank()) {
                        return name + " (****" + account.getLast4() + ")";
                    }
                    return name;
                })
                .toList();

        String accountsJson = new ObjectMapper().writeValueAsString(accountNames);
        List<String> categories = categoryService.listCategoryNames();
        String categoriesJson = new ObjectMapper().writeValueAsString(categories);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        HttpHeaders fileHeaders = new HttpHeaders();
        if (contentType != null && !contentType.isBlank()) {
            fileHeaders.setContentType(MediaType.parseMediaType(contentType));
        } else {
            fileHeaders.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        }
        org.springframework.core.io.ByteArrayResource resource = new org.springframework.core.io.ByteArrayResource(
                contents) {
            @Override
            public String getFilename() {
                return filename != null ? filename : "upload";
            }
        };
        body.add("file", new HttpEntity<>(resource, fileHeaders));
        body.add("accounts", accountsJson);
        body.add("categories", categoriesJson);
        String resolvedUserName = (user != null && user.getName() != null) ? user.getName() : "";
        String resolvedUserTaxId = (userTaxId != null && !userTaxId.isBlank())
                ? userTaxId
                : (user != null && user.getTaxId() != null ? user.getTaxId() : "");
        body.add("user_name", resolvedUserName);
        body.add("user_tax_id", resolvedUserTaxId);
        if (redactName != null && !redactName.isBlank()) {
            body.add("redact_name", redactName);
        }
        if (redactTerms != null && !redactTerms.isBlank()) {
            body.add("redact_terms", redactTerms);
        }

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        try {
            if (Thread.currentThread().isInterrupted()) {
                throw new RuntimeException("Extraction canceled.");
            }
                logger.debug("Calling Python API at: {}/api/extract-invoice", appConfig.getPythonApi());
            AiExtractionResponse[] responses = restTemplate.postForObject(
                    appConfig.getPythonApi() + "/api/extract-invoice",
                    requestEntity,
                    AiExtractionResponse[].class);
            if (Thread.currentThread().isInterrupted()) {
                throw new RuntimeException("Extraction canceled.");
            }
            logger.info("Successfully extracted invoice data.");
            assert responses != null;
            return Arrays.asList(responses);

        } catch (Exception e) {
            logger.error("AI data extraction failed. Error: {}", e.getMessage(), e);
            throw new RuntimeException("AI data extraction failed: " + e.getMessage());
        }
    }

    public byte[] redactFile(byte[] contents,
            String filename,
            String contentType,
            User user,
            String userTaxId,
            String redactName,
            String redactTerms,
            String redactBoxes) {
        ensureAiEnabled();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        HttpHeaders fileHeaders = new HttpHeaders();
        if (contentType != null && !contentType.isBlank()) {
            fileHeaders.setContentType(MediaType.parseMediaType(contentType));
        } else {
            fileHeaders.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        }
        org.springframework.core.io.ByteArrayResource resource = new org.springframework.core.io.ByteArrayResource(
                contents) {
            @Override
            public String getFilename() {
                return filename != null ? filename : "upload";
            }
        };
        body.add("file", new HttpEntity<>(resource, fileHeaders));
        String resolvedUserName = (user != null && user.getName() != null) ? user.getName() : "";
        String resolvedUserTaxId = (userTaxId != null && !userTaxId.isBlank())
                ? userTaxId
                : (user != null && user.getTaxId() != null ? user.getTaxId() : "");
        body.add("user_name", resolvedUserName);
        body.add("user_tax_id", resolvedUserTaxId);
        if (redactName != null && !redactName.isBlank()) {
            body.add("redact_name", redactName);
        }
        if (redactTerms != null && !redactTerms.isBlank()) {
            body.add("redact_terms", redactTerms);
        }
        if (redactBoxes != null && !redactBoxes.isBlank()) {
            body.add("redact_boxes", redactBoxes);
        }

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        try {
                logger.debug("Calling Python API at: {}/api/redact-file", appConfig.getPythonApi());
            ResponseEntity<byte[]> response = restTemplate.postForEntity(
                    appConfig.getPythonApi() + "/api/redact-file",
                    requestEntity,
                    byte[].class);
            return response.getBody();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate redacted file: " + e.getMessage(), e);
        }
    }

    public String categorizeIssuer(String issuerName, String designation) {
        return categorizeIssuer(issuerName, designation, null);
    }

    public String categorizeIssuer(String issuerName, String designation, List<Item> items) {
        if (settingsService.isAiEnabled()) {
            logger.info("Categorizing issuer.");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("issuer_name", issuerName);
            if (designation != null && !designation.isBlank()) {
                body.add("designation", designation);
                logger.debug("Added designation to categorization request.");
            }
            if (items != null && !items.isEmpty()) {
                try {
                    List<String> descriptions = items.stream()
                            .map(Item::getDescription)
                            .filter(desc -> desc != null && !desc.isBlank())
                            .toList();
                    if (!descriptions.isEmpty()) {
                        body.add("items", new ObjectMapper().writeValueAsString(descriptions));
                    }
                } catch (Exception e) {
                    logger.debug("Failed to serialize items for categorization: {}", e.getMessage());
                }
            }
            try {
                List<String> categories = categoryService.listCategoryNames();
                if (!categories.isEmpty()) {
                    body.add("categories", new ObjectMapper().writeValueAsString(categories));
                }
            } catch (Exception e) {
                logger.debug("Failed to serialize categories for categorization: {}", e.getMessage());
            }

            HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(body, headers);

            try {
                logger.info("Calling Python API at: {}/api/categorize-issuer", appConfig.getPythonApi());
                CategoryResponse response = restTemplate.postForObject(
                    appConfig.getPythonApi() + "/api/categorize-issuer",
                        requestEntity,
                        CategoryResponse.class);
                String category = (response != null) ? response.category() : "SERVICES";
                String normalized = normalizeCategory(category);
                logger.info("Issuer categorized as: {}", normalized);
                return normalized;
            } catch (Exception e) {
                logger.warn("Failed to categorize issuer. Defaulting to Services. Error: {}", e.getMessage());
                return "SERVICES";
            }
        } else {
            logger.warn("AI categorization is disabled. Skipping categorization.");
            return null;
        }
    }

    private void ensureAiEnabled() {
        if (!settingsService.isAiEnabled()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "AI_DISABLED");
        }
    }

    private String normalizeCategory(String raw) {
        if (raw == null || raw.isBlank()) {
            return "SERVICES";
        }
        String upper = raw.trim().toUpperCase();
        if (ALLOWED_CATEGORIES.contains(upper)) {
            return upper;
        }
        if (upper.contains("ACCOUNT") || upper.contains("FINANCE") || upper.contains("FINANCIAL")) {
            return "SERVICES";
        }
        return "SERVICES";
    }

}
