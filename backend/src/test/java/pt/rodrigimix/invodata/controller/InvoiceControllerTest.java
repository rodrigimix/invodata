package pt.rodrigimix.invodata.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.invoice.InvoiceService;
import pt.rodrigimix.invodata.service.user.UserService;

import java.security.Principal;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvoiceControllerTest {

    @Mock
    private InvoiceService invoiceService;

    @Mock
    private UserService userService;

    @InjectMocks
    private InvoiceController invoiceController;

    @Test
    void uploadInvoiceReturnsInvoicesFromService() {
        Principal principal = () -> "alice";
        User user = User.builder().username("alice").build();
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        Invoice invoice = new Invoice();

        when(userService.getUserFromUsername("alice")).thenReturn(user);
        when(invoiceService.processFileAsync(
                eq(file),
                eq(user),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(),
                eq(false),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull()))
                .thenReturn(CompletableFuture.completedFuture(List.of(invoice)));

        ResponseEntity<List<Invoice>> response = invoiceController.uploadInvoice(
                List.of(file),
                null,
                null,
                null,
                null,
                null,
                principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsExactly(invoice);
    }
}
