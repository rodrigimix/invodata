package pt.rodrigimix.invodata.dto;

public record SetupStatusResponse(
        boolean setupCompleted,
        String storageTarget,
        String localPath,
        String nfsPath,
        boolean aiEnabled,
        boolean allowPublicShares) {
}
