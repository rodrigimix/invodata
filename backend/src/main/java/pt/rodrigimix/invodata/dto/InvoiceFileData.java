package pt.rodrigimix.invodata.dto;

public record InvoiceFileData(
        byte[] content,
        String filename,
        String contentType
) {}
