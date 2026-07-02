package pt.rodrigimix.invodata.service.account;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import pt.rodrigimix.invodata.repository.AccountRepository;

@Component
public class HistoryScheduler {
    
    private final AccountRepository accountRepository;
    private final AccountService accountService;

    public HistoryScheduler(AccountRepository accountRepository, AccountService accountService) {
        this.accountRepository = accountRepository;
        this.accountService = accountService;
    }

    // Runs daily at 23:59 to record the day's closing balance
    @Scheduled(cron = "0 59 23 * * *")
    public void recordDailyBalances() {
        accountRepository.findAll().forEach(accountService::saveBalanceSnapshot);
    }
}
