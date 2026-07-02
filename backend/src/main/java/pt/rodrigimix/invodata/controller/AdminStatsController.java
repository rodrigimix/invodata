package pt.rodrigimix.invodata.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import pt.rodrigimix.invodata.dto.AdminMonthlyCount;
import pt.rodrigimix.invodata.dto.AdminStatsResponse;
import pt.rodrigimix.invodata.repository.AccountRepository;
import pt.rodrigimix.invodata.repository.InvoiceRepository;
import pt.rodrigimix.invodata.repository.IssuerRepository;
import pt.rodrigimix.invodata.repository.UserRepository;
import pt.rodrigimix.invodata.service.system.SystemSettingsService;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin("*")
public class AdminStatsController {

  private final UserRepository userRepository;
  private final InvoiceRepository invoiceRepository;
  private final AccountRepository accountRepository;
  private final IssuerRepository issuerRepository;

  private final SystemSettingsService settingsService;

  public AdminStatsController(UserRepository userRepository,
      InvoiceRepository invoiceRepository,
      AccountRepository accountRepository,
      IssuerRepository issuerRepository,
      SystemSettingsService settingsService) {
    this.userRepository = userRepository;
    this.invoiceRepository = invoiceRepository;
    this.accountRepository = accountRepository;
    this.issuerRepository = issuerRepository;
    this.settingsService = settingsService;
  }

  @GetMapping("/stats")
  public ResponseEntity<AdminStatsResponse> getStats(
      @RequestHeader(value = "X-Admin-Password", required = false) String headerPassword,
      @RequestParam(value = "password", required = false) String queryPassword,
      @RequestParam(value = "months", required = false, defaultValue = "6") Integer months) {
    String provided = (headerPassword != null && !headerPassword.isBlank()) ? headerPassword : queryPassword;
    if (!settingsService.validateAdminPassword(provided)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid admin password.");
    }

    int resolvedMonths = resolveMonths(months);
    YearMonth current = YearMonth.now();
    YearMonth startMonth = current.minusMonths(resolvedMonths - 1L);
    java.time.LocalDateTime startDate = startMonth.atDay(1).atStartOfDay();

    long totalUsers = userRepository.count();
    long totalInvoices = invoiceRepository.count();
    long uploadedInvoices = invoiceRepository.countByFileIDIsNotNull();
    long manualInvoices = invoiceRepository.countByFileIDIsNull();
    long totalAccounts = accountRepository.count();
    long totalIssuers = issuerRepository.count();

    List<AdminMonthlyCount> usersMonthly = buildMonthlySeries(userRepository.countUsersByMonthSince(startDate),
        resolvedMonths);
    List<AdminMonthlyCount> invoicesMonthly = buildMonthlySeries(
        invoiceRepository.countInvoicesByMonthSince(startDate),
        resolvedMonths);

    AdminStatsResponse response = new AdminStatsResponse(
        totalUsers,
        totalInvoices,
        uploadedInvoices,
        manualInvoices,
        totalAccounts,
        totalIssuers,
        usersMonthly,
        invoicesMonthly,
        LocalDateTime.now());
    return ResponseEntity.ok(response);
  }

  private List<AdminMonthlyCount> buildMonthlySeries(List<Object[]> raw, int months) {
    Map<String, Long> counts = new HashMap<>();
    if (raw != null) {
      for (Object[] row : raw) {
        if (row == null || row.length < 2) {
          continue;
        }
        String month = row[0] != null ? row[0].toString() : null;
        if (month == null || month.isBlank()) {
          continue;
        }
        Object total = row[1];
        if (total instanceof Number number) {
          counts.put(month, number.longValue());
        }
      }
    }

    YearMonth current = YearMonth.now();
    return java.util.stream.IntStream.rangeClosed(0, months - 1)
        .mapToObj(offset -> current.minusMonths(months - 1L - offset))
        .map(month -> new AdminMonthlyCount(month.toString(), counts.getOrDefault(month.toString(), 0L)))
        .collect(Collectors.toList());
  }

  private int resolveMonths(Integer months) {
    if (months == null) {
      return 6;
    }
    return switch (months) {
      case 3, 6, 12 -> months;
      default -> 6;
    };
  }
}
