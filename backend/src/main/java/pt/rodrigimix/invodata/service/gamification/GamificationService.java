package pt.rodrigimix.invodata.service.gamification;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pt.rodrigimix.invodata.model.Notification;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.InvoiceRepository;
import pt.rodrigimix.invodata.repository.NotificationRepository;
import pt.rodrigimix.invodata.repository.UserRepository;
import pt.rodrigimix.invodata.security.encryption.UserKeyContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GamificationService {

    private final Logger logger = LoggerFactory.getLogger(GamificationService.class);
    private final UserRepository userRepository;
    private final InvoiceRepository invoiceRepository;
    private final NotificationRepository notificationRepository;

    // Runs at 00:00 on the first day of each month
    @Scheduled(cron = "0 0 0 1 * ?")
    @Transactional
    public void checkMonthlyStreaks() {
        logger.info("Starting monthly streak check...");

        // Check the previous month
        LocalDate lastMonthDate = LocalDate.now().minusMonths(1);
        int month = lastMonthDate.getMonthValue();
        int year = lastMonthDate.getYear();

        List<User> users = userRepository.findAll();

        for (User user : users) {
            try {
                processUserStreak(user, month, year);
            } catch (Exception e) {
                logger.error("Failed to process streak for user: {}", e.getMessage());
            }
        }
    }

    private void processUserStreak(User user, int month, int year) {
        if (UserKeyContext.getKey() == null) {
            return;
        }

        double income = invoiceRepository.findByUser(user).stream()
                .filter(invoice -> invoice.getDate() != null
                        && invoice.getDate().getMonthValue() == month
                        && invoice.getDate().getYear() == year)
                .filter(invoice -> invoice.isRevenue())
                .map(inv -> inv.getTotalAmount() == null ? 0.0 : inv.getTotalAmount())
                .mapToDouble(Double::doubleValue)
                .sum();

        double expense = invoiceRepository.findByUser(user).stream()
                .filter(invoice -> invoice.getDate() != null
                        && invoice.getDate().getMonthValue() == month
                        && invoice.getDate().getYear() == year)
                .filter(invoice -> !invoice.isRevenue())
                .map(inv -> inv.getTotalAmount() == null ? 0.0 : inv.getTotalAmount())
                .mapToDouble(Double::doubleValue)
                .sum();

        // Logic: if income >= expense, increase the streak
        boolean inGreen = income >= expense;

        if (inGreen) {
            int newStreak = (user.getCurrentSavingsStreak() != null ? user.getCurrentSavingsStreak() : 0) + 1;
            user.setCurrentSavingsStreak(newStreak);

            // Update personal best
            int currentBest = (user.getBestSavingsStreak() != null ? user.getBestSavingsStreak() : 0);
            if (newStreak > currentBest) {
                user.setBestSavingsStreak(newStreak);
            }

            createNotification(user,
                    "Streak maintained! Positive balance in " + month + "/" + year + ". Current streak: " + newStreak
                            + " months!",
                    Notification.NotificationType.STREAK_UPDATE);
        } else {
            // If net negative, reset the streak
            if (user.getCurrentSavingsStreak() != null && user.getCurrentSavingsStreak() > 0) {
                createNotification(user,
                        "Streak broken. You spent more than you earned last month. Let's reset and try again!",
                        Notification.NotificationType.STREAK_UPDATE);
            }
            user.setCurrentSavingsStreak(0);
        }

        user.setLastStreakCheck(LocalDateTime.now());
        userRepository.save(user);
    }

    private void createNotification(User user, String message, Notification.NotificationType type) {
        Notification notification = Notification.builder()
                .user(user)
                .message(message)
                .type(type)
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build();
        notificationRepository.save(notification);
    }

    // No DB parsing needed after in-memory aggregation.
}
