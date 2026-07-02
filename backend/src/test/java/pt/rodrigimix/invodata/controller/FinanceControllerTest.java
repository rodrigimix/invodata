package pt.rodrigimix.invodata.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import pt.rodrigimix.invodata.dto.CategorySpendingDTO;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.finance.FinanceService;
import pt.rodrigimix.invodata.service.user.UserService;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceControllerTest {

    @Mock
    private FinanceService financeService;

    @Mock
    private UserService userService;

    @InjectMocks
    private FinanceController financeController;

    @Test
    void getEmergencyFundReturnsServiceResult() {
        Principal principal = () -> "alice";
        User user = User.builder().username("alice").build();
        Map<String, Object> result = Map.of("target", 1000, "current", 250);

        when(userService.getUserFromUsername("alice")).thenReturn(user);
        when(financeService.getEmergencyFund(6, user)).thenReturn(result);

        ResponseEntity<Map<String, Object>> response = financeController.getEmergencyFund(6, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(result);
    }

    @Test
    void getCategoriesMapsServiceDataToDtos() {
        Principal principal = () -> "alice";
        List<Map<String, Object>> serviceResult = List.of(
                Map.of("name", "Food", "value", 120.5),
                Map.of("name", "Rent", "value", 800));

        when(financeService.getCategoryChartDataForYear(
                org.mockito.ArgumentMatchers.anyInt(),
                org.mockito.ArgumentMatchers.eq("alice"))).thenReturn(serviceResult);

        ResponseEntity<List<CategorySpendingDTO>> response = financeController.getCategories(null, null, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(2);
        assertThat(response.getBody().get(0).name()).isEqualTo("Food");
        assertThat(response.getBody().get(0).value()).isEqualTo(120.5);
        assertThat(response.getBody().get(1).name()).isEqualTo("Rent");
        assertThat(response.getBody().get(1).value()).isEqualTo(800.0);
    }

    @Test
    void getSavingsRateUsesProvidedMonthYear() {
        Principal principal = () -> "alice";
        Map<String, Object> result = Map.of("rate", 0.2);
        when(financeService.getSavingsRate(2, 2024, "alice")).thenReturn(result);

        ResponseEntity<Map<String, Object>> response = financeController.getSavingsRate(2, 2024, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(result);
        verify(financeService).getSavingsRate(2, 2024, "alice");
    }
}
