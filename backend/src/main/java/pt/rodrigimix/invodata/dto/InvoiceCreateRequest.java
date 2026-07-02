package pt.rodrigimix.invodata.dto;

import pt.rodrigimix.invodata.model.Item;

import java.time.LocalDate;
import java.util.List;

public record InvoiceCreateRequest(
        String documentNum,
        LocalDate date,
        Boolean revenue,
        Double totalAmount,
        Double taxAmount,
        Double netAmount,
        String licensePlate,
        String paymentMethod,
        String notes,
        String issuerTaxId,
        String issuerName,
        String issuerCategory,
        List<Item> items,
        Long accountId
) {}
