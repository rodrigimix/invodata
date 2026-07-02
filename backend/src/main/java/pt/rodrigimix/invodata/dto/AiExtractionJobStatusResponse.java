package pt.rodrigimix.invodata.dto;

import java.util.List;

public record AiExtractionJobStatusResponse(
        String jobId,
        String status,
        List<AiExtractionResponse> invoices,
        String error
) {}
