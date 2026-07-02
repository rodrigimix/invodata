package pt.rodrigimix.invodata.dto;

import java.time.LocalDateTime;
import java.util.List;

public record InvoiceShareSnapshotResponse(
        Long shareId,
        String token,
        String type,
        LocalDateTime createdAt,
        LocalDateTime expiresAt,
        Boolean allowImport,
        Boolean allowPdf,
        Boolean allowPdfDownload,
        InvoiceShareSnapshot invoice) {

    public record InvoiceShareSnapshot(
            String publicId,
            String documentNum,
            String date,
            String issuerName,
            String issuerTaxId,
            String category,
            Boolean revenue,
            Double totalAmount,
            Double taxAmount,
            Double netAmount,
            String paymentMethod,
            String notes,
            String originalFileName,
            String createdAt,
            List<InvoiceShareItem> items) {
    }

    public record InvoiceShareItem(
            String description,
            Double quantity,
            Double unitPrice,
            Double totalPrice,
            Double taxPrice,
            Double taxPercent) {
    }
}
