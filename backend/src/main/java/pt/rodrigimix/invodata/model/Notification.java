package pt.rodrigimix.invodata.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private NotificationType type; // WARNING, SUCCESS, INFO

    private boolean isRead = false;

    private LocalDateTime createdAt;

    private String actionUrl;

    @Column(name = "share_id")
    private Long shareId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    public enum NotificationType {
        BUDGET_ALERT,
        STREAK_UPDATE,
        SHARE,
        SYSTEM
    }
}