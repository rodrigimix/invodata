package pt.rodrigimix.invodata.dto;

import jakarta.validation.constraints.NotBlank;

public record SetupRequest(
        @NotBlank String adminPassword,
        String storageTarget,
        String localPath,
        String nfsPath,
        Boolean aiEnabled,
        Boolean allowPublicShares) {
}
