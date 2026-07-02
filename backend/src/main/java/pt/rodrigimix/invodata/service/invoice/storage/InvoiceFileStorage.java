package pt.rodrigimix.invodata.service.invoice.storage;

import pt.rodrigimix.invodata.dto.InvoiceFileData;

public interface InvoiceFileStorage {
    String save(String contentType, byte[] contents, InvoiceFilePathContext context);

    String move(String fileId, InvoiceFilePathContext context);

    InvoiceFileData load(String fileId);

    void delete(String fileId);
}
