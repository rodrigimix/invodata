package pt.rodrigimix.invodata.dto;

import pt.rodrigimix.invodata.model.Invoice;

import java.util.List;

public record UploadJobStatusResponse(
        String jobId,
        String status,
        List<Invoice> invoices,
        List<UploadInvoiceReference> existingInvoices,
        String error
) {}
