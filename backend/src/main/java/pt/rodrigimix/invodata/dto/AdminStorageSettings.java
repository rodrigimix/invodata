package pt.rodrigimix.invodata.dto;

public record AdminStorageSettings(
        String storageTarget,
        String localPath,
        String nfsPath
) {
}
