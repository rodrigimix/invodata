package pt.rodrigimix.invodata.service.extraction.qrProcessor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.Issuer;
import pt.rodrigimix.invodata.model.CountryCode;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Deprecated
@Component
public class QRPortugalProcessor implements QRProcessor {

    private static final Logger logger = LoggerFactory.getLogger(QRPortugalProcessor.class);
    private static final DateTimeFormatter AT_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd");

    @Override
    public boolean supports(String qrContent) {
        return qrContent.startsWith("A:");
    }

    @Override
    public List<Invoice> process(List<String> qrContents, boolean isRevenue) {
        List<Invoice> invoices = new ArrayList<>();
        for (String qrContent : qrContents) {
            if (supports(qrContent)) {
                invoices.add(mapToInvoice(qrContent, isRevenue));
            }
        }
        return invoices;
    }

    private Invoice mapToInvoice(String qrContent, boolean isRevenue) {
        Invoice invoice = new Invoice();
        invoice.setRevenue(isRevenue);

        for (String qrContentLine : qrContent.split("\\*")) {
            String[] lineParts = qrContentLine.split(":", 2);

            if (lineParts.length < 2) {
                continue;
            }

            String key = lineParts[0];
            String value = lineParts[1];

            try {
                switch (key) {
                    case "A" -> { if (!isRevenue) invoice.setIssuer(Issuer.builder()
                            .taxId(value)
                            .country(CountryCode.PORTUGAL)
                            .build()); }
                    case "B" -> { if (isRevenue) invoice.setIssuer(Issuer.builder()
                            .taxId(value)
                            .country(CountryCode.PORTUGAL)
                            .build()); }
                    case "F" -> invoice.setDate(LocalDate.parse(value, AT_DATE_FORMATTER));
                    case "G" -> invoice.setDocumentNum(value);
                    case "N" -> invoice.setTaxAmount(Double.parseDouble(value));
                    case "O" -> invoice.setTotalAmount(Double.parseDouble(value));
                    case "S" -> invoice.setPaymentMethod(value.split(";")[0]);
                }
            } catch (Exception e) {
                logger.warn("Error processing field {} with value {}: {}", key, value, e.getMessage());
            }
        }

        if (invoice.getTaxAmount() != null && invoice.getTotalAmount() != null) {
            invoice.setNetAmount(round(invoice.getTotalAmount() - invoice.getTaxAmount()));
        }

        return invoice;
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
