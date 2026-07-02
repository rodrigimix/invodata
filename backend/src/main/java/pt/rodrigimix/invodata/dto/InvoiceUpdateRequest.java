package pt.rodrigimix.invodata.dto;

import pt.rodrigimix.invodata.model.Item;

import java.time.LocalDate;
import java.util.List;

public record InvoiceUpdateRequest(
        String documentNum,
        LocalDate date,
        Boolean revenue,
        Double totalAmount,
        Double taxAmount,
        Double netAmount,
        String licensePlate,
        String paymentMethod,
        String notes,
        Long accountId,
        Boolean clearAccount,
        String issuerTaxId,
        String issuerName,
        String issuerCategory,
        List<Item> items
) {}
