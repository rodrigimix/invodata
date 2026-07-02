package pt.rodrigimix.invodata.service.chat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.ChatMessageResponse;
import pt.rodrigimix.invodata.dto.ChatResponse;
import pt.rodrigimix.invodata.dto.ChatSessionAiAction;
import pt.rodrigimix.invodata.dto.ChatSessionAiRequest;
import pt.rodrigimix.invodata.dto.ChatSessionAiResponse;
import pt.rodrigimix.invodata.dto.ChatSessionListItem;
import pt.rodrigimix.invodata.dto.ChatSessionResponse;
import pt.rodrigimix.invodata.dto.FinanceSnapshot;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.Budget;
import pt.rodrigimix.invodata.model.ChatMessage;
import pt.rodrigimix.invodata.model.ChatSession;
import pt.rodrigimix.invodata.model.ChatSummary;
import pt.rodrigimix.invodata.model.Goal;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.ChatRepository;
import pt.rodrigimix.invodata.repository.ChatSessionRepository;
import pt.rodrigimix.invodata.repository.ChatSummaryRepository;
import pt.rodrigimix.invodata.repository.UserRepository;
import pt.rodrigimix.invodata.service.account.AccountService;
import pt.rodrigimix.invodata.service.budget.BudgetService;
import pt.rodrigimix.invodata.service.finance.FinanceService;
import pt.rodrigimix.invodata.service.goal.GoalService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.ArrayList;

import org.springframework.data.domain.PageRequest;

@Service
public class ChatSessionService {

    private static final Logger logger = LoggerFactory.getLogger(ChatSessionService.class);

    private final ChatRepository chatRepository;
    private final ChatSessionRepository chatSessionRepository;
    private final ChatSummaryRepository chatSummaryRepository;
    private final FinanceService financeService;
    private final AppConfig appConfig;
    private final UserRepository userRepository;
    private final AccountService accountService;
    private final GoalService goalService;
    private final BudgetService budgetService;
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

    public ChatSessionService(ChatRepository chatRepository,
            ChatSessionRepository chatSessionRepository,
            ChatSummaryRepository chatSummaryRepository,
            FinanceService financeService,
            AppConfig appConfig,
            UserRepository userRepository,
            AccountService accountService,
            GoalService goalService,
            BudgetService budgetService) {
        this.chatRepository = chatRepository;
        this.chatSessionRepository = chatSessionRepository;
        this.chatSummaryRepository = chatSummaryRepository;
        this.financeService = financeService;
        this.appConfig = appConfig;
        this.userRepository = userRepository;
        this.accountService = accountService;
        this.goalService = goalService;
        this.budgetService = budgetService;
    }

    public ChatSessionResponse createSession(String username, String title) {
        ChatSession session = new ChatSession();
        session.setUsername(username);
        session.setTitle(title);
        session.setCreatedAt(LocalDateTime.now());
        session.setLastActivityAt(LocalDateTime.now());
        ChatSession saved = chatSessionRepository.save(session);
        return new ChatSessionResponse(saved.getId());
    }

    public ChatResponse postMessage(String sessionId, String username, String message) {
        ensureAiConsent(username);
        ChatSession session = getSessionOrThrow(sessionId, username);
        ChatMessage userMessage = buildMessage(sessionId, username, "user", message);
        chatRepository.save(userMessage);

        List<ChatMessage> recentMessages = chatRepository.findBySessionIdOrderByTimestampDesc(
                sessionId,
                PageRequest.of(0, 20));
        Collections.reverse(recentMessages);

        Optional<ChatSummary> summary = chatSummaryRepository.findFirstBySessionIdOrderByCreatedAtDesc(sessionId);
        FinanceSnapshot snapshot = financeService.getAllTimeSnapshot(username);

        String language = userRepository.findByUsernameIgnoreCase(username)
                .map(User::getLanguage)
                .orElse("pt");
        ChatSessionAiRequest request = new ChatSessionAiRequest(
                sessionId,
                new ChatSessionAiRequest.UserRef(username, username, language),
                recentMessages.stream()
                        .map(msg -> new ChatSessionAiRequest.Message(msg.getRole(), msg.getContent()))
                        .toList(),
                summary.map(ChatSummary::getSummary).orElse(null),
                snapshot,
                LocalDate.now().toString());

        String url = appConfig.getPythonApi() + "/api/chat-session";
        try {
            ResponseEntity<ChatSessionAiResponse> response = restTemplate.postForEntity(url, new HttpEntity<>(request),
                    ChatSessionAiResponse.class);
            if (response.getStatusCode() != HttpStatus.OK || response.getBody() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Chat service error");
            }
            ChatSessionAiResponse aiResponse = response.getBody();
            String answer = aiResponse.answer();
            List<ChatSessionAiAction> actions = aiResponse.actions() != null ? aiResponse.actions() : List.of();
            var invoiceFilter = aiResponse.invoiceFilter();
            String actionsNote = applyChatActions(actions, username);
            if (!actionsNote.isBlank()) {
                answer = answer + "\n\n" + actionsNote;
            }
            ChatMessage assistantMessage = buildMessage(sessionId, username, "assistant", answer);
            chatRepository.save(assistantMessage);

            session.setLastActivityAt(LocalDateTime.now());
            chatSessionRepository.save(session);

            return new ChatResponse(answer, actions, invoiceFilter);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Chat session request failed: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Chat service unavailable");
        }
    }

    public List<ChatMessageResponse> getMessages(String sessionId, String username, int limit) {
        getSessionOrThrow(sessionId, username);
        int boundedLimit = Math.min(Math.max(limit, 1), 200);
        List<ChatMessage> recentMessages = chatRepository.findBySessionIdOrderByTimestampDesc(
                sessionId,
                PageRequest.of(0, boundedLimit));
        Collections.reverse(recentMessages);
        return recentMessages.stream()
                .map(msg -> new ChatMessageResponse(msg.getRole(), msg.getContent(), msg.getTimestamp()))
                .toList();
    }

    public Optional<String> getLatestSummary(String sessionId, String username) {
        getSessionOrThrow(sessionId, username);
        return chatSummaryRepository.findFirstBySessionIdOrderByCreatedAtDesc(sessionId)
                .map(ChatSummary::getSummary);
    }

    public List<ChatSessionListItem> getSessions(String username, int limit) {
        int boundedLimit = Math.min(Math.max(limit, 1), 100);
        return chatSessionRepository.findByUsernameIgnoreCaseOrderByLastActivityAtDesc(username).stream()
                .limit(boundedLimit)
                .map(session -> new ChatSessionListItem(
                        session.getId(),
                        session.getTitle(),
                        session.getCreatedAt(),
                        session.getLastActivityAt()))
                .toList();
    }

    public ChatSessionListItem updateSessionTitle(String sessionId, String username, String title) {
        ChatSession session = getSessionOrThrow(sessionId, username);
        String trimmed = title == null ? "" : title.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title is required");
        }
        session.setTitle(trimmed);
        session.setLastActivityAt(LocalDateTime.now());
        ChatSession saved = chatSessionRepository.save(session);
        return new ChatSessionListItem(
                saved.getId(),
                saved.getTitle(),
                saved.getCreatedAt(),
                saved.getLastActivityAt());
    }

    public void deleteSession(String sessionId, String username) {
        ChatSession session = getSessionOrThrow(sessionId, username);
        chatRepository.deleteBySessionId(sessionId);
        chatSummaryRepository.deleteBySessionId(sessionId);
        chatSessionRepository.deleteById(session.getId());
    }

    private void ensureAiConsent(String username) {
        boolean consent = userRepository.findByUsernameIgnoreCase(username)
                .map(User::getAiConsent)
                .orElse(false);
        if (!consent) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "AI consent required. Enable it at /api/user/consent.");
        }
    }

    private ChatMessage buildMessage(String sessionId, String username, String role, String content) {
        ChatMessage message = new ChatMessage();
        message.setSessionId(sessionId);
        message.setUsername(username);
        message.setRole(role);
        message.setContent(content);
        message.setTimestamp(LocalDateTime.now());
        return message;
    }

    private ChatSession getSessionOrThrow(String sessionId, String username) {
        ChatSession session = chatSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        if (!username.equalsIgnoreCase(session.getUsername())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Session access denied");
        }
        return session;
    }

    private String applyChatActions(List<ChatSessionAiAction> actions, String username) {
        if (actions == null || actions.isEmpty()) {
            return "";
        }
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        List<String> notes = new ArrayList<>();
        for (ChatSessionAiAction action : actions) {
            if (action == null || action.type() == null) {
                continue;
            }
            switch (action.type()) {
                case "create_account" -> {
                    String name = safeTrim(action.name());
                    if (name.isEmpty()) {
                        continue;
                    }
                    if (accountService.getAccountByName(name, user) != null) {
                        continue;
                    }
                    Account account = Account.builder()
                            .name(name)
                            .type(safeTrim(action.accountType()))
                            .currency(normalizeCurrency(action.currency()))
                            .balance(toBigDecimal(action.balance()))
                            .last4(normalizeLast4(action.last4()))
                            .isEmergencyFund(Boolean.TRUE.equals(action.isEmergencyFund()))
                            .active(true)
                            .user(user)
                            .build();
                    accountService.createAccount(account);
                    notes.add("✅ Conta criada: " + name);
                }
                case "create_goal" -> {
                    String name = safeTrim(action.name());
                    if (name.isEmpty() || action.targetAmount() == null) {
                        continue;
                    }
                    Goal goal = Goal.builder()
                            .name(name)
                            .targetAmount(toBigDecimal(action.targetAmount()))
                            .currentAmount(toBigDecimal(action.currentAmount()))
                            .deadline(parseDate(action.deadline()))
                            .user(user)
                            .build();
                    String linkedAccountName = safeTrim(action.linkedAccountName());
                    if (!linkedAccountName.isEmpty()) {
                        Account account = accountService.getAccountByName(linkedAccountName, user);
                        if (account != null) {
                            goal.setLinkedAccount(account);
                        }
                    }
                    goalService.createGoal(goal, user);
                    notes.add("✅ Objetivo criado: " + name);
                }
                case "create_budget" -> {
                    if (action.monthlyLimit() == null) {
                        continue;
                    }
                    String category = normalizeBudgetCategory(action.category());
                    if (category.isBlank()) {
                        continue;
                    }
                    int month = action.month() != null ? action.month() : LocalDate.now().getMonthValue();
                    int year = action.year() != null ? action.year() : LocalDate.now().getYear();
                    Budget budget = Budget.builder()
                            .category(category)
                            .monthlyLimit(action.monthlyLimit())
                            .month(month)
                            .year(year)
                            .build();
                    budgetService.saveBudget(budget, user);
                    notes.add("✅ Orçamento criado: " + category);
                }
                default -> {
                    // Ignore unknown actions
                }
            }
        }
        return String.join("\n", notes);
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private BigDecimal toBigDecimal(Double value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(value);
    }

    private String normalizeCurrency(String currency) {
        String normalized = safeTrim(currency).toUpperCase();
        return normalized.isEmpty() ? "EUR" : normalized;
    }

    private String normalizeLast4(String last4) {
        if (last4 == null) {
            return null;
        }
        String digits = last4.replaceAll("\\D", "");
        return digits.isBlank() ? null : digits;
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (Exception ignored) {
            return null;
        }
    }

    private String normalizeBudgetCategory(String raw) {
        String normalized = safeTrim(raw).toUpperCase();
        if (ALLOWED_CATEGORIES.contains(normalized)) {
            return normalized;
        }
        if (normalized.contains("ACCOUNT") || normalized.contains("FINANCE") || normalized.contains("FINANCIAL")) {
            return "SERVICES";
        }
        return "SERVICES";
    }
}
