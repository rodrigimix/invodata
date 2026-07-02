package pt.rodrigimix.invodata.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import pt.rodrigimix.invodata.model.Budget;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.budget.BudgetService;
import pt.rodrigimix.invodata.service.user.UserService;

import java.security.Principal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BudgetControllerTest {

    @Mock
    private BudgetService budgetService;

    @Mock
    private UserService userService;

    @InjectMocks
    private BudgetController budgetController;

    @Test
    void createBudgetReturnsSavedBudget() {
        Principal principal = () -> "alice";
        User user = User.builder().id(1L).username("alice").build();
        Budget request = Budget.builder().category("Food").month(8).year(2024).monthlyLimit(200.0).build();
        Budget saved = Budget.builder().id(UUID.randomUUID()).category("Food").month(8).year(2024).monthlyLimit(200.0)
                .build();

        when(userService.getUserFromUsername("alice")).thenReturn(user);
        when(budgetService.saveBudget(request, user)).thenReturn(saved);

        ResponseEntity<Budget> response = budgetController.createBudget(request, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(saved);
    }
}
