package pt.rodrigimix.invodata.service.extraction.qrProcessor;

import pt.rodrigimix.invodata.model.Invoice;

import java.util.List;

@Deprecated
public interface QRProcessor {
    boolean supports(String qrContent);
    List<Invoice> process(List<String> qrContents, boolean isRevenue);
}
