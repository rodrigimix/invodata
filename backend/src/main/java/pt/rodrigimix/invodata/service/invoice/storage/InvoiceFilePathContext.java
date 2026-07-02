package pt.rodrigimix.invodata.service.invoice.storage;

import java.time.LocalDate;

public record InvoiceFilePathContext(LocalDate date, boolean revenue, String issuerName, String username,
	boolean redacted) {
}
