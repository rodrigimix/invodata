package pt.rodrigimix.invodata.dto;

public record InvoiceShareCreateRequest(
        String username,
        Boolean publicLink,
        Integer expiresInDays,
        Boolean allowImport,
        Boolean allowPdf,
        Boolean allowPdfDownload) {
}
