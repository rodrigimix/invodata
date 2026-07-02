package pt.rodrigimix.invodata.dto;

import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.Item;

import java.util.List;

public record ExtractionDTO(
        List<Invoice> invoices,                             // Header data (MariaDB style)
        List<Item> items     // Invoice line items (for the form)
) {}
