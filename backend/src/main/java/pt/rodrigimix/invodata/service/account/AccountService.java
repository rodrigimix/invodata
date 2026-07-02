package pt.rodrigimix.invodata.service.account;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.dto.AccountUpdateRequest;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.BalanceHistory;
import pt.rodrigimix.invodata.model.Goal;
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.AccountRepository;
import pt.rodrigimix.invodata.repository.BalanceHistoryRepository;
import pt.rodrigimix.invodata.repository.GoalRepository;
import pt.rodrigimix.invodata.repository.InvoiceRepository;
import pt.rodrigimix.invodata.service.goal.GoalService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AccountService {

    private static final Logger logger = LoggerFactory.getLogger(AccountService.class);

    private final AccountRepository accountRepository;
    private final BalanceHistoryRepository balanceHistoryRepository;
    private final GoalService goalService;
    private final InvoiceRepository invoiceRepository;
    private final GoalRepository goalRepository;

    @Autowired
    public AccountService(AccountRepository accountRepository,
            BalanceHistoryRepository balanceHistoryRepository,
            GoalService goalService,
            InvoiceRepository invoiceRepository,
            GoalRepository goalRepository) {
        this.accountRepository = accountRepository;
        this.balanceHistoryRepository = balanceHistoryRepository;
        this.goalService = goalService;
        this.invoiceRepository = invoiceRepository;
        this.goalRepository = goalRepository;
    }

    public List<Account> getAccountsByUser(User user) {
        return accountRepository.findByUser(user);
    }

    public Account getAccountByName(String name, User user) {
        return accountRepository.findByUserAndNameIgnoreCase(user, name)
                .orElse(null);
    }

    public Account getAccountByLast4(String last4, User user) {
        if (last4 == null || last4.isBlank()) {
            return null;
        }
        List<Account> matches = accountRepository.findByUserAndLast4(user, last4);
        if (matches.size() == 1) {
            return matches.get(0);
        }
        return null;
    }

    public Account getAccountById(Long id, User user) {
        return accountRepository.findById(id)
                .filter(account -> account.getUser().getId().equals(user.getId()))
                .orElse(null);
    }

    public Account createAccount(Account account) {
        if (account.getLast4() != null) {
            String normalized = account.getLast4().replaceAll("\\s+", "");
            account.setLast4(normalized.isBlank() ? null : normalized);
        }
        return accountRepository.save(account);
    }

    public Account updateAccount(Long accountId, AccountUpdateRequest request, User user) {
        Account account = accountRepository.findById(accountId)
                .filter(a -> a.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found."));

        if (request.name() != null) {
            account.setName(request.name());
        }
        if (request.type() != null) {
            account.setType(request.type());
        }
        if (request.currency() != null) {
            account.setCurrency(request.currency());
        }
        if (request.isEmergencyFund() != null) {
            account.setIsEmergencyFund(request.isEmergencyFund());
        }
        if (request.active() != null) {
            account.setActive(request.active());
        }
        if (request.balance() != null) {
            account.setBalance(request.balance());
            saveBalanceSnapshot(account);
            goalService.updateAutoGoalsProgress(account);
        }
        if (request.last4() != null) {
            String normalized = request.last4().replaceAll("\\s+", "");
            account.setLast4(normalized.isBlank() ? null : normalized);
        }

        return accountRepository.save(account);
    }

    @Transactional
    public void deleteAccount(Long accountId, User user) {
        long start = System.currentTimeMillis();
        Account account = accountRepository.findById(accountId)
                .filter(a -> a.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found."));

        int goalsUpdated = goalRepository.clearLinkedAccount(account, user);
        int invoicesUpdated = invoiceRepository.clearAccount(account, user);
        balanceHistoryRepository.deleteByAccountIn(List.of(account));
        accountRepository.delete(account);
        long elapsed = System.currentTimeMillis() - start;
        logger.info("Deleted account {} for user {}. Cleared {} goals, {} invoices in {} ms.",
                accountId, user.getId(), goalsUpdated, invoicesUpdated, elapsed);
    }

    public void updateBalance(Account account, Double amount, boolean isRevenue) {
        BigDecimal amountBD = BigDecimal.valueOf(amount);
        BigDecimal currentBalance = account.getBalance() != null ? account.getBalance() : BigDecimal.ZERO;

        if (isRevenue) {
            account.setBalance(currentBalance.add(amountBD));
        } else {
            account.setBalance(currentBalance.subtract(amountBD));
        }

        accountRepository.save(account);

        saveBalanceSnapshot(account);
    }

    public void saveBalanceSnapshot(Account account) {
        LocalDate today = LocalDate.now();
        BalanceHistory history = balanceHistoryRepository
                .findByAccountAndDate(account, today)
                .orElse(BalanceHistory.builder()
                        .account(account)
                        .date(today)
                        .build());

        history.setBalance(account.getBalance());
        balanceHistoryRepository.save(history);
    }

    @Transactional
    public void updateBalance(Long accountId, BigDecimal amount, boolean isRevenue) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        if (isRevenue) {
            account.setBalance(account.getBalance().add(amount));
        } else {
            account.setBalance(account.getBalance().subtract(amount));
        }

        accountRepository.save(account);

        // Automation: update goals linked to this account
        goalService.updateAutoGoalsProgress(account);
    }

    public void adjustManualBalance(Long accountId, Double newBalance, User user) {
        Account account = accountRepository.findById(accountId)
                .filter(a -> a.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new RuntimeException("Account not found or access denied"));

        account.setBalance(BigDecimal.valueOf(newBalance));
        accountRepository.save(account);
    }

    public BigDecimal getTotalBalance(User user) {
        return accountRepository.findByUser(user).stream()
                .map(Account::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
