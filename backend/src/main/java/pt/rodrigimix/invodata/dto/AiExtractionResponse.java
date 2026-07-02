package pt.rodrigimix.invodata.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AiExtractionResponse(
        AiHeader header,
        List<AiItem> items
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AiHeader(
            String documentNum,
            String date,
            boolean isRevenue,
            Double totalAmount,
            Double taxAmount,
            Double netAmount,
            String issuerTaxId,
            String issuerName,
            String country,
            String accountName,
            String accountLast4,
            String licensePlate,
            String paymentMethod
    ) {}

    public record AiItem(
            String description,
            Double quantity,
            Double unitPrice,
            Double totalPrice,
            Double taxPrice,
            Double taxPercent
    ) {}

}
