package pt.rodrigimix.invodata.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.dto.InvoiceShareCreateRequest;
import pt.rodrigimix.invodata.dto.InvoiceShareResponse;
import pt.rodrigimix.invodata.dto.InvoiceShareSnapshotResponse;
import pt.rodrigimix.invodata.model.Invoice;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.invoice.share.InvoiceShareService;
import pt.rodrigimix.invodata.service.user.UserService;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/shares")
@CrossOrigin("*")
public class InvoiceShareController {
    private final InvoiceShareService shareService;
    private final UserService userService;

    public InvoiceShareController(InvoiceShareService shareService, UserService userService) {
        this.shareService = shareService;
        this.userService = userService;
    }

    @PostMapping("/invoices/{publicId}")
    public ResponseEntity<InvoiceShareResponse> createShare(@PathVariable String publicId,
            @Valid @RequestBody InvoiceShareCreateRequest request,
            Principal principal) {
        User owner = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(shareService.createShare(publicId, owner, request));
    }

    @GetMapping("/invoices/{publicId}")
    public ResponseEntity<List<InvoiceShareResponse>> listShares(@PathVariable String publicId, Principal principal) {
        User owner = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(shareService.listShares(publicId, owner));
    }

    @DeleteMapping("/invoices/{publicId}/{shareId}")
    public ResponseEntity<Void> revokeShare(@PathVariable String publicId, @PathVariable Long shareId,
            Principal principal) {
        User owner = userService.getUserFromUsername(principal.getName());
        shareService.revokeShare(publicId, shareId, owner);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/token/{token}")
    public ResponseEntity<InvoiceShareSnapshotResponse> getShareByToken(@PathVariable String token) {
        return ResponseEntity.ok(shareService.getShareByToken(token));
    }

    @GetMapping("/token/{token}/file")
    public ResponseEntity<byte[]> getShareFileByToken(@PathVariable String token) {
        var result = shareService.getShareFileByToken(token);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(result.data().contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + result.filename() + "\"")
                .body(result.data().content());
    }

    @PostMapping("/import/token/{token}")
    public ResponseEntity<Invoice> importShareByToken(@PathVariable String token, Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(shareService.importShareByToken(token, user));
    }

    @GetMapping("/user/{shareId}")
    public ResponseEntity<InvoiceShareSnapshotResponse> getShareForUser(@PathVariable Long shareId,
            Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(shareService.getShareForUser(shareId, user));
    }

    @GetMapping("/user/{shareId}/file")
    public ResponseEntity<byte[]> getShareFileForUser(@PathVariable Long shareId, Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        var result = shareService.getShareFileForUser(shareId, user);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(result.data().contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + result.filename() + "\"")
                .body(result.data().content());
    }

    @PostMapping("/import/user/{shareId}")
    public ResponseEntity<Invoice> importShareForUser(@PathVariable Long shareId, Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(shareService.importShareForUser(shareId, user));
    }

    @GetMapping("/user")
    public ResponseEntity<List<InvoiceShareSnapshotResponse>> listSharesForUser(Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(shareService.listSharesForUser(user));
    }

    @PostMapping("/user/{shareId}/accept")
    public ResponseEntity<InvoiceShareSnapshotResponse> acceptShareForUser(@PathVariable Long shareId,
            Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(shareService.acceptShareForUser(shareId, user));
    }

    @DeleteMapping("/user/{shareId}")
    public ResponseEntity<Void> declineShareForUser(@PathVariable Long shareId, Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        shareService.declineShareForUser(shareId, user);
        return ResponseEntity.noContent().build();
    }
}
