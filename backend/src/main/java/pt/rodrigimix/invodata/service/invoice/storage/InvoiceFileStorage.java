package pt.rodrigimix.invodata.service.invoice.storage;

import pt.rodrigimix.invodata.dto.InvoiceFileData;

public interface InvoiceFileStorage {
    String save(String contentType, byte[] contents, String preferredPath);

    default String save(String contentType, byte[] contents) {
        return save(contentType, contents, null);
    }

    InvoiceFileData load(String fileId);

    void delete(String fileId);
}
