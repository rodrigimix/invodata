package pt.rodrigimix.invodata.service.invoice;

import pt.rodrigimix.invodata.model.Invoice;

import java.util.List;

public class DuplicateInvoiceException extends RuntimeException {
    private final List<Invoice> invoices;

    public DuplicateInvoiceException(String message, List<Invoice> invoices) {
        super(message);
        this.invoices = invoices;
    }

    public List<Invoice> getInvoices() {
        return invoices;
    }
}
