package pt.rodrigimix.invodata.dto;

public record UploadInvoiceReference(
                String publicId,
                String originalFileName,
                String documentNum) {
}
