package pt.rodrigimix.invodata.service.invoice.upload;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.InvoiceRepository;
import pt.rodrigimix.invodata.dto.UploadInvoiceReference;
import pt.rodrigimix.invodata.service.invoice.DuplicateInvoiceException;
import pt.rodrigimix.invodata.service.invoice.InvoiceService;
import pt.rodrigimix.invodata.service.invoice.storage.InvoiceFileId;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;

@Service
public class UploadJobService {
    private final Logger logger = LoggerFactory.getLogger(UploadJobService.class);
    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final AsyncTaskExecutor taskExecutor;
    private final Semaphore uploadSemaphore;
    private final Map<String, UploadJob> jobs = new ConcurrentHashMap<>();

    public UploadJobService(InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            @Qualifier("applicationTaskExecutor") AsyncTaskExecutor taskExecutor,
            AppConfig appConfig) {
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.taskExecutor = taskExecutor;
        int maxConcurrent = Math.max(1, appConfig.getUploadMaxConcurrent());
        this.uploadSemaphore = new Semaphore(maxConcurrent, true);
    }

    public String createJob(MultipartFile file,
            MultipartFile redactedFile,
            User user,
            String userTaxId,
            String redactName,
            String redactTerms,
            boolean storeRedactedOnly) {
        String jobId = UUID.randomUUID().toString();
        UploadJob job = new UploadJob(jobId, user.getUsername());
        jobs.put(jobId, job);

        byte[] contents;
        try {
            contents = file.getBytes();
        } catch (Exception e) {
            job.setStatus(UploadJobStatus.ERROR);
            job.setError("Failed to read upload contents.");
            throw new RuntimeException("Failed to read upload contents.", e);
        }
        String fileId = InvoiceFileId.build(file.getContentType(), contents);
        if (invoiceRepository.existsByFileIDAndUserUsername(fileId, user.getUsername())) {
            job.setStatus(UploadJobStatus.ERROR);
            job.setError("Fatura já existe no sistema.");
            job.setExistingInvoices(invoiceRepository.findByFileIDAndUserUsername(fileId, user.getUsername())
                    .stream()
                    .map(this::toReference)
                    .toList());
            return jobId;
        }
        byte[] redactedContents = null;
        String redactedContentType = null;
        if (redactedFile != null && !redactedFile.isEmpty()) {
            try {
                redactedContents = redactedFile.getBytes();
                redactedContentType = redactedFile.getContentType();
            } catch (Exception e) {
                logger.warn("Failed to read redacted contents.");
            }
        }
        final byte[] finalRedactedContents = redactedContents;
        final String finalRedactedContentType = redactedContentType;

        CompletableFuture<List<Invoice>> future = new CompletableFuture<>();
        Future<?> taskFuture = taskExecutor.submit(() -> {
            boolean acquired = false;
            try {
                uploadSemaphore.acquire();
                acquired = true;
                if (job.isCanceled()) {
                    future.completeExceptionally(new CancellationException("Upload canceled."));
                    return;
                }
                job.setStatus(UploadJobStatus.RUNNING);
                List<Invoice> result = invoiceService.processBytes(
                        contents,
                        file.getOriginalFilename(),
                        file.getContentType(),
                        user,
                        userTaxId,
                        redactName,
                        redactTerms,
                        storeRedactedOnly,
                        finalRedactedContents,
                        finalRedactedContentType);
                future.complete(result);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(new CancellationException("Upload canceled."));
            } catch (Exception ex) {
                future.completeExceptionally(ex);
            } finally {
                if (acquired) {
                    uploadSemaphore.release();
                }
            }
        });
        job.setFuture(future);
        job.setTaskFuture(taskFuture);
        job.setStatus(UploadJobStatus.PENDING);

        future.whenComplete((result, ex) -> {
            if (job.isCanceled()) {
                return;
            }
            if (ex != null) {
                Throwable cause = ex instanceof CompletionException ? ex.getCause() : ex;
                if (cause instanceof CancellationException) {
                    job.setStatus(UploadJobStatus.CANCELED);
                    return;
                }
                if (cause instanceof DuplicateInvoiceException duplicate) {
                    job.setStatus(UploadJobStatus.ERROR);
                    job.setError(duplicate.getMessage());
                    job.setExistingInvoices(duplicate.getInvoices().stream().map(this::toReference).toList());
                    return;
                }
                logger.error("Upload job {} failed", jobId, cause);
                job.setStatus(UploadJobStatus.ERROR);
                job.setError(cause.getMessage());
                return;
            }
            job.setInvoices(result);
            job.setStatus(UploadJobStatus.SUCCESS);
        });

        return jobId;
    }

    private UploadInvoiceReference toReference(Invoice invoice) {
        return new UploadInvoiceReference(
                invoice.getId(),
                invoice.getOriginalFileName(),
                invoice.getDocumentNum());
    }

    public UploadJob getJob(String jobId) {
        return jobs.get(jobId);
    }

    public boolean cancelJob(String jobId) {
        UploadJob job = jobs.get(jobId);
        if (job == null) {
            return false;
        }
        job.setStatus(UploadJobStatus.CANCELED);
        CompletableFuture<List<Invoice>> future = job.getFuture();
        if (future != null) {
            future.completeExceptionally(new CancellationException("Upload canceled."));
        }
        Future<?> taskFuture = job.getTaskFuture();
        if (taskFuture != null) {
            taskFuture.cancel(true);
        }
        return true;
    }
}
