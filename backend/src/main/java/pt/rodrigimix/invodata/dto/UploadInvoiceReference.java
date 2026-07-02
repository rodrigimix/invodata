package pt.rodrigimix.invodata.dto;

public record UploadInvoiceReference(
        Long id,
        String originalFileName,
        String documentNum
) {}
