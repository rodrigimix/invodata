package pt.rodrigimix.invodata.service.invoice.upload;

import pt.rodrigimix.invodata.dto.UploadInvoiceReference;
import pt.rodrigimix.invodata.model.Invoice;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;

public class UploadJob {
    private final String id;
    private final String username;
    private final Instant createdAt;
    private final AtomicReference<UploadJobStatus> status;
    private volatile CompletableFuture<List<Invoice>> future;
    private volatile Future<?> taskFuture;
    private volatile List<Invoice> invoices;
    private volatile List<UploadInvoiceReference> existingInvoices;
    private volatile String error;

    public UploadJob(String id, String username) {
        this.id = id;
        this.username = username;
        this.createdAt = Instant.now();
        this.status = new AtomicReference<>(UploadJobStatus.PENDING);
    }

    public String getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public UploadJobStatus getStatus() {
        return status.get();
    }

    public void setStatus(UploadJobStatus newStatus) {
        status.set(newStatus);
    }

    public void setFuture(CompletableFuture<List<Invoice>> future) {
        this.future = future;
    }

    public CompletableFuture<List<Invoice>> getFuture() {
        return future;
    }

    public void setTaskFuture(Future<?> taskFuture) {
        this.taskFuture = taskFuture;
    }

    public Future<?> getTaskFuture() {
        return taskFuture;
    }

    public List<Invoice> getInvoices() {
        return invoices;
    }

    public void setInvoices(List<Invoice> invoices) {
        this.invoices = invoices;
    }

    public List<UploadInvoiceReference> getExistingInvoices() {
        return existingInvoices;
    }

    public void setExistingInvoices(List<UploadInvoiceReference> existingInvoices) {
        this.existingInvoices = existingInvoices;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public boolean isCanceled() {
        return status.get() == UploadJobStatus.CANCELED;
    }
}
