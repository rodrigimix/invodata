package pt.rodrigimix.invodata.dto;

import java.util.List;

public record ChatResponse(String response,
    List<ChatSessionAiAction> actions,
    ChatInvoiceFilter invoiceFilter) {
}
