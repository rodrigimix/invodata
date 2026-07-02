package pt.rodrigimix.invodata.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import pt.rodrigimix.invodata.dto.LoginRequest;
import pt.rodrigimix.invodata.dto.RegisterRequest;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.service.user.UserService;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private AuthController authController;

    @Test
    void registerReturnsOkWithUserId() {
        RegisterRequest request = new RegisterRequest(
                "alice",
                "pass",
                "alice@example.com",
                "Alice",
                "123456789",
                "key",
                false);
        User created = User.builder().id(10L).build();
        when(userService.register(request)).thenReturn(created);
        when(userService.issueToken(created)).thenReturn("jwt-token");

        ResponseEntity<?> response = authController.register(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body)
                .containsEntry("message", "User created successfully!")
                .containsEntry("token", "jwt-token")
                .containsEntry("user", created);
    }

    @Test
    void registerReturnsForbiddenOnFailure() {
        RegisterRequest request = new RegisterRequest(
                "alice",
                "pass",
                "alice@example.com",
                "Alice",
                "123456789",
                "key",
                false);
        when(userService.register(request)).thenThrow(new RuntimeException("Invalid Admin Key! Access denied."));

        ResponseEntity<?> response = authController.register(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsKey("error");
        @SuppressWarnings("unchecked")
        Map<String, Object> error = (Map<String, Object>) body.get("error");
        assertThat(error)
                .containsEntry("code", "AUTH_REGISTER_FAILED")
                .containsEntry("message", "Invalid Admin Key! Access denied.");
    }

    @Test
    void loginReturnsToken() {
        LoginRequest request = new LoginRequest("alice", "pass");
        User user = User.builder().username("alice").build();
        when(userService.login(request)).thenReturn("jwt-token");
        when(userService.getUserFromUsername("alice")).thenReturn(user);

        ResponseEntity<?> response = authController.login(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body)
                .containsEntry("token", "jwt-token")
                .containsEntry("user", user);
    }

    @Test
    void loginReturnsUnauthorizedOnFailure() {
        LoginRequest request = new LoginRequest("alice", "bad-pass");
        when(userService.login(request)).thenThrow(new RuntimeException("Invalid credentials."));

        ResponseEntity<?> response = authController.login(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertThat(body).containsKey("error");
        @SuppressWarnings("unchecked")
        Map<String, Object> error = (Map<String, Object>) body.get("error");
        assertThat(error)
                .containsEntry("code", "AUTH_INVALID_CREDENTIALS")
                .containsEntry("message", "Invalid credentials.");
    }
}
