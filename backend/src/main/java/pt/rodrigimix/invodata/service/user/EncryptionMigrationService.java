package pt.rodrigimix.invodata.service.user;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pt.rodrigimix.invodata.model.*;
import pt.rodrigimix.invodata.repository.*;
import pt.rodrigimix.invodata.security.encryption.UserKeyContext;

import java.util.List;
import java.util.Map;

@Service
public class EncryptionMigrationService {
  private final AccountRepository accountRepository;
  private final GoalRepository goalRepository;
  private final InvoiceRepository invoiceRepository;
  private final BudgetRepository budgetRepository;
  private final BalanceHistoryRepository balanceHistoryRepository;
  private final ChatRepository chatRepository;
  private final ChatSessionRepository chatSessionRepository;
  private final ChatSummaryRepository chatSummaryRepository;

  public EncryptionMigrationService(AccountRepository accountRepository,
      GoalRepository goalRepository,
      InvoiceRepository invoiceRepository,
      BudgetRepository budgetRepository,
      BalanceHistoryRepository balanceHistoryRepository,
      ChatRepository chatRepository,
      ChatSessionRepository chatSessionRepository,
      ChatSummaryRepository chatSummaryRepository) {
    this.accountRepository = accountRepository;
    this.goalRepository = goalRepository;
    this.invoiceRepository = invoiceRepository;
    this.budgetRepository = budgetRepository;
    this.balanceHistoryRepository = balanceHistoryRepository;
    this.chatRepository = chatRepository;
    this.chatSessionRepository = chatSessionRepository;
    this.chatSummaryRepository = chatSummaryRepository;
  }

  @Transactional
  public Map<String, Object> migrateUserData(User user) {
    UserKeyContext.requireKey();

    List<Account> accounts = accountRepository.findByUser(user);
    accountRepository.saveAll(accounts);

    List<Goal> goals = goalRepository.findByUser(user);
    goalRepository.saveAll(goals);

    List<Invoice> invoices = invoiceRepository.findByUser(user);
    invoiceRepository.saveAll(invoices);

    List<Budget> budgets = budgetRepository.findByUser(user);
    budgetRepository.saveAll(budgets);

    List<BalanceHistory> histories = accounts.stream()
        .flatMap(account -> balanceHistoryRepository.findByAccount(account).stream())
        .toList();
    balanceHistoryRepository.saveAll(histories);

    List<ChatSession> sessions = chatSessionRepository.findByUsernameIgnoreCase(user.getUsername());
    sessions.forEach(session -> session.setTitle(session.getTitle()));
    chatSessionRepository.saveAll(sessions);

    List<ChatMessage> messages = chatRepository.findByUsernameOrderByTimestampAsc(user.getUsername());
    messages.forEach(message -> message.setContent(message.getContent()));
    chatRepository.saveAll(messages);

    List<String> sessionIds = sessions.stream().map(ChatSession::getId).toList();
    List<ChatSummary> summaries = sessionIds.isEmpty()
        ? List.of()
        : chatSummaryRepository.findBySessionIdIn(sessionIds);
    summaries.forEach(summary -> summary.setSummary(summary.getSummary()));
    chatSummaryRepository.saveAll(summaries);

    return Map.of(
        "accounts", accounts.size(),
        "goals", goals.size(),
        "invoices", invoices.size(),
        "budgets", budgets.size(),
        "balanceHistory", histories.size(),
        "chatSessions", sessions.size(),
        "chatMessages", messages.size(),
        "chatSummaries", summaries.size());
  }
}