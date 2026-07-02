package pt.rodrigimix.invodata.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pt.rodrigimix.invodata.dto.CategorySpendingDTO;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.finance.FinanceService;
import pt.rodrigimix.invodata.service.user.UserService;

import java.security.Principal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/finance")
@CrossOrigin("*")
public class FinanceController {

    private final FinanceService financeService;

    private final UserService userService;

    @Autowired
    public FinanceController(FinanceService financeService,
            UserService userService) {
        this.financeService = financeService;
        this.userService = userService;
    }

    @GetMapping("/emergency-fund/status")
    public ResponseEntity<Map<String, Object>> getEmergencyFund(@RequestParam(defaultValue = "6") int months,
            Principal principal) {
        User user = userService.getUserFromUsername(principal.getName());
        return ResponseEntity.ok(financeService.getEmergencyFund(months, user));
    }

    @GetMapping("/chart/categories")
    public ResponseEntity<List<CategorySpendingDTO>> getCategories(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            Principal principal) {
        int y = year != null ? year : LocalDate.now().getYear();
        List<Map<String, Object>> data = (month != null)
                ? financeService.getCategoryChartData(month, y, principal.getName())
                : financeService.getCategoryChartDataForYear(y, principal.getName());

        List<CategorySpendingDTO> dtos = data.stream()
                .map(m2 -> new CategorySpendingDTO(
                        (String) m2.get("name"),
                        ((Number) m2.get("value")).doubleValue()))
                .toList();

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/chart/evolution")
    public ResponseEntity<List<Map<String, Object>>> getEvolution(Principal principal) {
        return ResponseEntity.ok(financeService.getEvolutionChartData(principal.getName()));
    }

    @GetMapping("/chart/evolution-detailed")
    public ResponseEntity<List<Map<String, Object>>> getEvolutionDetailed(Principal principal) {
        return ResponseEntity.ok(financeService.getEvolutionChartDetailedData(principal.getName()));
    }

    // No FinanceController.java

    @GetMapping("/stats/savings-rate")
    public ResponseEntity<Map<String, Object>> getSavingsRate(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            Principal principal) {

        int y = (year != null) ? year : LocalDate.now().getYear();

        if (month != null) {
            return ResponseEntity.ok(financeService.getSavingsRate(month, y, principal.getName()));
        }

        return ResponseEntity.ok(financeService.getSavingsRateForYear(y, principal.getName()));
    }

    @GetMapping("/stats/comparison")
    public ResponseEntity<Map<String, Object>> getComparison(Principal principal) {
        return ResponseEntity.ok(financeService.getMonthlyComparison(principal.getName()));
    }
}
