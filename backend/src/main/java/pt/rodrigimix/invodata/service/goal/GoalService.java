package pt.rodrigimix.invodata.service.goal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.dto.GoalUpdateRequest;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.Goal;
import pt.rodrigimix.invodata.model.Notification;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.AccountRepository;
import pt.rodrigimix.invodata.repository.GoalRepository;
import pt.rodrigimix.invodata.repository.NotificationRepository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class GoalService {

    private final GoalRepository goalRepository;
    private final NotificationRepository notificationRepository;
    private final AccountRepository accountRepository;


    @Autowired
    public GoalService(GoalRepository goalRepository,
                       NotificationRepository notificationRepository,
                       AccountRepository accountRepository) {
        this.goalRepository = goalRepository;
        this.notificationRepository = notificationRepository;
        this.accountRepository = accountRepository;
    }
    public List<Goal> getGoals(User user) {
        return goalRepository.findByUser(user);
    }

    public Goal createGoal(Goal goal, User user) {
        goal.setUser(user);
        if (goal.getCurrentAmount() == null) goal.setCurrentAmount(BigDecimal.ZERO);

        // If the goal is linked to an account, initialize it with the current balance
        if (goal.getLinkedAccount() != null) {
            goal.setCurrentAmount(goal.getLinkedAccount().getBalance());
            updateCompletionStatus(goal);
        }

        return goalRepository.save(goal);
    }

    public void updateAutoGoalsProgress(Account account) {
        List<Goal> linkedGoals = goalRepository.findByLinkedAccount(account);
        for (Goal goal : linkedGoals) {
            goal.setCurrentAmount(account.getBalance());
            updateCompletionStatus(goal);
            goalRepository.save(goal);
        }
    }

    private void updateCompletionStatus(Goal goal) {
        boolean wasCompleted = goal.getCompleted();

        if (goal.getCurrentAmount().compareTo(goal.getTargetAmount()) >= 0) {
            goal.setCompleted(true);

            // If it just completed now, create the notification
            if (!wasCompleted) {
                Notification notif = Notification.builder()
                        .user(goal.getUser())
                        .message("Goal reached! You achieved: " + goal.getName())
                        .type(Notification.NotificationType.STREAK_UPDATE) // Adjust type if needed
                        .createdAt(LocalDateTime.now())
                        .isRead(false)
                        .build();
                notificationRepository.save(notif);
            }
        } else {
            goal.setCompleted(false);
        }
    }
    public void deleteGoal(Long id, User user) {
        Goal goal = goalRepository.findById(id)
                .filter(g -> g.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found."));
        goalRepository.delete(goal);
    }

    public Goal addFunds(Long id, BigDecimal amount, User user) {
        Goal goal = goalRepository.findById(id)
                .filter(g -> g.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found."));

        goal.setCurrentAmount(goal.getCurrentAmount().add(amount));

        if (goal.getCurrentAmount().compareTo(goal.getTargetAmount()) >= 0) {
            goal.setCompleted(true);
        }

        return goalRepository.save(goal);
    }

    public Goal updateGoal(Long id, GoalUpdateRequest request, User user) {
        Goal goal = goalRepository.findById(id)
                .filter(g -> g.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found."));

        if (request.name() != null) {
            goal.setName(request.name());
        }
        if (request.targetAmount() != null) {
            goal.setTargetAmount(request.targetAmount());
        }
        if (request.currentAmount() != null) {
            goal.setCurrentAmount(request.currentAmount());
        }
        if (request.deadline() != null) {
            goal.setDeadline(request.deadline());
        }

        if (Boolean.TRUE.equals(request.clearLinkedAccount())) {
            goal.setLinkedAccount(null);
        } else if (request.linkedAccountId() != null) {
            Account account = accountRepository.findById(request.linkedAccountId())
                    .filter(a -> a.getUser().getId().equals(user.getId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found."));
            goal.setLinkedAccount(account);
            if (request.currentAmount() == null) {
                goal.setCurrentAmount(account.getBalance());
            }
        }

        updateCompletionStatus(goal);
        return goalRepository.save(goal);
    }
}
