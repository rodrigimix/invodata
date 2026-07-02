package pt.rodrigimix.invodata.service.user;

import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.model.*;
import pt.rodrigimix.invodata.repository.*;

import javax.xml.stream.XMLOutputFactory;
import javax.xml.stream.XMLStreamWriter;
import java.io.ByteArrayOutputStream;
import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class DataPrivacyService {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final InvoiceRepository invoiceRepository;
    private final GoalRepository goalRepository;
    private final NotificationRepository notificationRepository;
    private final BalanceHistoryRepository balanceHistoryRepository;
    private final ChatRepository chatRepository;
    private final ChatSessionRepository chatSessionRepository;
    private final ChatSummaryRepository chatSummaryRepository;
    private final AppConfig appConfig;

    public DataPrivacyService(UserRepository userRepository,
            AccountRepository accountRepository,
            InvoiceRepository invoiceRepository,
            GoalRepository goalRepository,
            NotificationRepository notificationRepository,
            BalanceHistoryRepository balanceHistoryRepository,
            ChatRepository chatRepository,
            ChatSessionRepository chatSessionRepository,
            ChatSummaryRepository chatSummaryRepository,
            AppConfig appConfig) {
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.invoiceRepository = invoiceRepository;
        this.goalRepository = goalRepository;
        this.notificationRepository = notificationRepository;
        this.balanceHistoryRepository = balanceHistoryRepository;
        this.chatRepository = chatRepository;
        this.chatSessionRepository = chatSessionRepository;
        this.chatSummaryRepository = chatSummaryRepository;
        this.appConfig = appConfig;
    }

    @Transactional
    public Map<String, Object> exportUserData(String username) {
        return buildExport(username);
    }

    @Transactional
    public String exportUserDataXml(String username) {
        Map<String, Object> export = buildExport(username);
        return toXml(export);
    }

    @Transactional
    public byte[] exportUserDataZip(String username) {
        String xml = exportUserDataXml(username);
        Set<String> fileIds = collectUserFileIds(username);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
                ZipOutputStream zip = new ZipOutputStream(out)) {
            ZipEntry xmlEntry = new ZipEntry("user-data.xml");
            zip.putNextEntry(xmlEntry);
            zip.write(xml.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            zip.closeEntry();

            for (String fileId : fileIds) {
                Path path = Path.of(appConfig.getMedia_path(), fileId);
                if (!Files.exists(path) || Files.isDirectory(path)) {
                    continue;
                }
                ZipEntry fileEntry = new ZipEntry("files/" + fileId);
                zip.putNextEntry(fileEntry);
                zip.write(Files.readAllBytes(path));
                zip.closeEntry();
            }

            zip.finish();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate ZIP export.", e);
        }
    }

    private Set<String> collectUserFileIds(String username) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new RuntimeException("User not found."));
        List<Invoice> invoices = invoiceRepository.findByUser(user);
        Set<String> fileIds = new LinkedHashSet<>();
        for (Invoice invoice : invoices) {
            if (invoice.getFileID() != null && !invoice.getFileID().isBlank()) {
                fileIds.add(invoice.getFileID());
            }
        }
        return fileIds;
    }

    private Map<String, Object> buildExport(String username) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new RuntimeException("User not found."));

        Map<String, Object> export = new LinkedHashMap<>();
        export.put("user", mapUser(user));

        List<Account> accounts = accountRepository.findByUser(user);
        export.put("accounts", accounts.stream().map(this::mapAccount).toList());

        List<Invoice> invoices = invoiceRepository.findByUser(user);
        export.put("invoices", invoices.stream().map(this::mapInvoice).toList());

        List<Goal> goals = goalRepository.findByUser(user);
        export.put("goals", goals.stream().map(this::mapGoal).toList());

        List<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        export.put("notifications", notifications.stream().map(this::mapNotification).toList());

        List<Map<String, Object>> balances = new ArrayList<>();
        for (Account account : accounts) {
            for (BalanceHistory history : balanceHistoryRepository.findByAccountOrderByDateAsc(account)) {
                balances.add(mapBalanceHistory(account, history));
            }
        }
        export.put("balance_history", balances);

        List<ChatSession> sessions = chatSessionRepository.findByUsernameIgnoreCase(username);
        export.put("chat_sessions", sessions.stream().map(this::mapChatSession).toList());

        export.put("chat_messages", chatRepository.findByUsernameOrderByTimestampAsc(username)
                .stream()
                .map(this::mapChatMessage)
                .toList());

        List<String> sessionIds = sessions.stream().map(ChatSession::getId).toList();
        export.put("chat_summaries", sessionIds.isEmpty()
                ? List.of()
                : chatSummaryRepository.findBySessionIdIn(sessionIds).stream().map(this::mapChatSummary).toList());

        return export;
    }

    private String toXml(Map<String, Object> export) {
        try {
            StringWriter out = new StringWriter();
            XMLStreamWriter writer = XMLOutputFactory.newFactory().createXMLStreamWriter(out);
            writer.writeStartDocument("UTF-8", "1.0");
            writer.writeStartElement("export");
            writeMap(writer, export);
            writer.writeEndElement();
            writer.writeEndDocument();
            writer.flush();
            writer.close();
            return out.toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate XML export.", e);
        }
    }

    private void writeMap(XMLStreamWriter writer, Map<String, Object> map) throws Exception {
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            writeValue(writer, entry.getKey(), entry.getValue());
        }
    }

    private void writeValue(XMLStreamWriter writer, String elementName, Object value) throws Exception {
        if (value == null) {
            writer.writeEmptyElement(elementName);
            return;
        }
        if (value instanceof Map<?, ?> nestedMap) {
            writer.writeStartElement(elementName);
            for (Map.Entry<?, ?> entry : nestedMap.entrySet()) {
                writeValue(writer, String.valueOf(entry.getKey()), entry.getValue());
            }
            writer.writeEndElement();
            return;
        }
        if (value instanceof List<?> list) {
            writer.writeStartElement(elementName);
            for (Object item : list) {
                writeValue(writer, "item", item);
            }
            writer.writeEndElement();
            return;
        }
        writer.writeStartElement(elementName);
        writer.writeCharacters(String.valueOf(value));
        writer.writeEndElement();
    }

    @Transactional
    public void deleteUserData(String username) {
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new RuntimeException("User not found."));

        List<Invoice> invoices = invoiceRepository.findByUser(user);
        Set<String> fileIds = new HashSet<>();
        for (Invoice invoice : invoices) {
            if (invoice.getFileID() != null && !invoice.getFileID().isBlank()) {
                fileIds.add(invoice.getFileID());
            }
        }

        invoiceRepository.deleteAll(invoices);

        List<Account> accounts = accountRepository.findByUser(user);
        if (!accounts.isEmpty()) {
            balanceHistoryRepository.deleteByAccountIn(accounts);
        }
        goalRepository.deleteByUser(user);
        notificationRepository.deleteByUserId(user.getId());
        accountRepository.deleteByUser(user);

        List<ChatSession> sessions = chatSessionRepository.findByUsernameIgnoreCase(username);
        List<String> sessionIds = sessions.stream().map(ChatSession::getId).toList();
        if (!sessionIds.isEmpty()) {
            chatSummaryRepository.deleteBySessionIdIn(sessionIds);
        }
        chatRepository.deleteByUsername(username);
        chatSessionRepository.deleteByUsernameIgnoreCase(username);

        userRepository.delete(user);

        for (String fileId : fileIds) {
            deleteFileSafely(fileId);
        }
    }

    private void deleteFileSafely(String fileId) {
        try {
            Path path = Path.of(appConfig.getMedia_path(), fileId);
            Files.deleteIfExists(path);
        } catch (Exception ignored) {
            // Best-effort delete to avoid breaking account removal.
        }
    }

    private Map<String, Object> mapUser(User user) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", user.getId());
        data.put("username", user.getUsername());
        data.put("name", user.getName());
        data.put("email", user.getEmail());
        data.put("created_at", user.getCreatedAt());
        data.put("ai_consent", user.getAiConsent());
        return data;
    }

    private Map<String, Object> mapAccount(Account account) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", account.getId());
        data.put("name", account.getName());
        data.put("type", account.getType());
        data.put("balance", account.getBalance());
        data.put("currency", account.getCurrency());
        data.put("is_emergency_fund", account.getIsEmergencyFund());
        data.put("active", account.getActive());
        data.put("created_at", account.getCreatedAt());
        return data;
    }

    private Map<String, Object> mapInvoice(Invoice invoice) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", invoice.getId());
        data.put("document_num", invoice.getDocumentNum());
        data.put("issue_date", invoice.getDate());
        data.put("revenue", invoice.isRevenue());
        data.put("total_amount", invoice.getTotalAmount());
        data.put("tax_amount", invoice.getTaxAmount());
        data.put("net_amount", invoice.getNetAmount());
        data.put("license_plate", invoice.getLicensePlate());
        data.put("payment_method", invoice.getPaymentMethod());
        data.put("notes", invoice.getNotes());
        data.put("file_id", invoice.getFileID());
        data.put("created_at", invoice.getCreatedAt());

        Issuer issuer = invoice.getIssuer();
        if (issuer != null) {
            Map<String, Object> issuerData = new LinkedHashMap<>();
            issuerData.put("tax_id", issuer.getTaxId());
            issuerData.put("name", issuer.getName());
            issuerData.put("country", issuer.getCountry());
            issuerData.put("category", issuer.getCategory());
            data.put("issuer", issuerData);
        }

        Account account = invoice.getAccount();
        if (account != null) {
            Map<String, Object> accountData = new LinkedHashMap<>();
            accountData.put("id", account.getId());
            accountData.put("name", account.getName());
            data.put("account", accountData);
        }

        if (invoice.getItems() != null) {
            data.put("items", invoice.getItems().stream().map(item -> {
                Map<String, Object> itemData = new LinkedHashMap<>();
                itemData.put("description", item.getDescription());
                itemData.put("quantity", item.getQuantity());
                itemData.put("unit_price", item.getUnitPrice());
                itemData.put("total_price", item.getTotalPrice());
                return itemData;
            }).toList());
        } else {
            data.put("items", List.of());
        }

        return data;
    }

    private Map<String, Object> mapGoal(Goal goal) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", goal.getId());
        data.put("name", goal.getName());
        data.put("target_amount", goal.getTargetAmount());
        data.put("current_amount", goal.getCurrentAmount());
        data.put("deadline", goal.getDeadline());
        data.put("completed", goal.getCompleted());
        if (goal.getLinkedAccount() != null) {
            data.put("linked_account_id", goal.getLinkedAccount().getId());
        }
        return data;
    }

    private Map<String, Object> mapNotification(Notification notification) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", notification.getId());
        data.put("message", notification.getMessage());
        data.put("type", notification.getType());
        data.put("is_read", notification.isRead());
        data.put("created_at", notification.getCreatedAt());
        return data;
    }

    private Map<String, Object> mapBalanceHistory(Account account, BalanceHistory history) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("account_id", account.getId());
        data.put("date", history.getDate());
        data.put("balance", history.getBalance());
        return data;
    }

    private Map<String, Object> mapChatSession(ChatSession session) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", session.getId());
        data.put("title", session.getTitle());
        data.put("created_at", session.getCreatedAt());
        data.put("last_activity_at", session.getLastActivityAt());
        return data;
    }

    private Map<String, Object> mapChatMessage(ChatMessage message) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", message.getId());
        data.put("session_id", message.getSessionId());
        data.put("role", message.getRole());
        data.put("content", message.getContent());
        data.put("timestamp", message.getTimestamp());
        return data;
    }

    private Map<String, Object> mapChatSummary(ChatSummary summary) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", summary.getId());
        data.put("session_id", summary.getSessionId());
        data.put("period", summary.getPeriod());
        data.put("summary", summary.getSummary());
        data.put("created_at", summary.getCreatedAt());
        return data;
    }
}
