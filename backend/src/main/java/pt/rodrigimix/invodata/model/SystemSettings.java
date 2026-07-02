package pt.rodrigimix.invodata.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "system_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemSettings {
    @Id
    private Long id;

    @Column(name = "setup_completed", nullable = false)
    private Boolean setupCompleted;

    @Column(name = "admin_password_hash", columnDefinition = "TEXT")
    private String adminPasswordHash;

    @Column(name = "storage_target", nullable = false)
    private String storageTarget;

    @Column(name = "local_path", columnDefinition = "TEXT")
    private String localPath;

    @Column(name = "nfs_path", columnDefinition = "TEXT")
    private String nfsPath;

    @Column(name = "ai_enabled", nullable = false)
    private Boolean aiEnabled;

    @Column(name = "allow_public_shares", nullable = false)
    private Boolean allowPublicShares;

    @Column(name = "env_config", columnDefinition = "TEXT")
    private String envConfig;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.setupCompleted == null) {
            this.setupCompleted = false;
        }
        if (this.aiEnabled == null) {
            this.aiEnabled = false;
        }
        if (this.allowPublicShares == null) {
            this.allowPublicShares = false;
        }
        if (this.storageTarget == null) {
            this.storageTarget = "local";
        }
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
        if (this.setupCompleted == null) {
            this.setupCompleted = false;
        }
        if (this.aiEnabled == null) {
            this.aiEnabled = false;
        }
        if (this.allowPublicShares == null) {
            this.allowPublicShares = false;
        }
        if (this.storageTarget == null) {
            this.storageTarget = "local";
        }
    }
}
