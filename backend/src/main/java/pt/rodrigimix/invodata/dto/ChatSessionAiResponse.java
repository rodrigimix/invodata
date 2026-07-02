package pt.rodrigimix.invodata.dto;

import java.util.List;

public record ChatSessionAiResponse(String answer,
    List<ChatSessionAiAction> actions,
    ChatInvoiceFilter invoiceFilter) {
}
