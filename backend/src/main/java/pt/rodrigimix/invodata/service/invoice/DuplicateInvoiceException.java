package pt.rodrigimix.invodata.service.invoice;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;
import pt.rodrigimix.invodata.model.Invoice;

import java.util.List;

@ResponseStatus(HttpStatus.CONFLICT)
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
