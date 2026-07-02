package pt.rodrigimix.invodata.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import pt.rodrigimix.invodata.model.Account;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.account.AccountService;
import pt.rodrigimix.invodata.service.user.UserService;

import java.security.Principal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService userService;

    @Mock
    private AccountService accountService;

    @InjectMocks
    private UserController userController;

    @Captor
    private ArgumentCaptor<Account> accountCaptor;

    @Test
    void createAccountReturnsBadRequestWhenAccountExists() {
        Principal principal = () -> "alice";
        User user = User.builder().username("alice").build();
        Account request = Account.builder().name("Main").build();
        Account existing = Account.builder().name("Main").build();

        when(userService.getUserFromUsername("alice")).thenReturn(user);
        when(accountService.getAccountByName("Main", user)).thenReturn(existing);

        ResponseEntity<Account> response = userController.createAccount(request, principal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNull();
    }

    @Test
    void createAccountSetsUserAndReturnsSavedAccount() {
        Principal principal = () -> "alice";
        User user = User.builder().username("alice").build();
        Account request = Account.builder().name("Main").build();
        Account saved = Account.builder().id(10L).name("Main").build();

        when(userService.getUserFromUsername("alice")).thenReturn(user);
        when(accountService.getAccountByName("Main", user)).thenReturn(null);
        when(accountService.createAccount(request)).thenReturn(saved);

        ResponseEntity<Account> response = userController.createAccount(request, principal);

        verify(accountService).createAccount(accountCaptor.capture());
        assertThat(accountCaptor.getValue().getUser()).isEqualTo(user);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(saved);
    }
}
