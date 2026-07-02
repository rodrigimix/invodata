package pt.rodrigimix.invodata.service.user;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import pt.rodrigimix.invodata.config.AppConfig;
import pt.rodrigimix.invodata.dto.LoginRequest;
import pt.rodrigimix.invodata.dto.RegisterRequest;
import pt.rodrigimix.invodata.model.User;
import pt.rodrigimix.invodata.repository.UserRepository;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AppConfig appConfig;

    @InjectMocks
    private UserService userService;

    @Captor
    private ArgumentCaptor<User> userCaptor;

    @Test
    void registerRejectsInvalidAdminKey() {
        RegisterRequest request = new RegisterRequest(
                "alice",
                "pass",
                "alice@example.com",
                "Alice",
                "123456789",
                "wrong",
                false);
        when(appConfig.getRegistrationKey()).thenReturn("correct");

        assertThatThrownBy(() -> userService.register(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Invalid Admin Key! Access denied.");
    }

    @Test
    void registerRejectsDuplicateUsername() {
        RegisterRequest request = new RegisterRequest(
                "alice",
                "pass",
                "alice@example.com",
                "Alice",
                "123456789",
                "correct",
                false);
        when(appConfig.getRegistrationKey()).thenReturn("correct");
        when(userRepository.existsByUsernameIgnoreCase("alice")).thenReturn(true);

        assertThatThrownBy(() -> userService.register(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("User already exists.");
    }

    @Test
    void registerStoresEncodedPassword() {
        RegisterRequest request = new RegisterRequest(
                "alice",
                "pass",
                "alice@example.com",
                "Alice",
                "123456789",
                "correct",
                false);
        when(appConfig.getRegistrationKey()).thenReturn("correct");
        when(userRepository.existsByUsernameIgnoreCase("alice")).thenReturn(false);
        when(passwordEncoder.encode("pass")).thenReturn("encoded-pass");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(99L);
            return user;
        });

        User created = userService.register(request);

        verify(userRepository).save(userCaptor.capture());
        User saved = userCaptor.getValue();
        assertThat(saved.getPassword()).isEqualTo("encoded-pass");
        assertThat(saved.getUsername()).isEqualTo("alice");
        assertThat(created.getId()).isEqualTo(99L);
    }

    @Test
    void loginRejectsUnknownUser() {
        LoginRequest request = new LoginRequest("missing", "pass");
        when(userRepository.findByUsernameIgnoreCase("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.login(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("User not found.");
    }

    @Test
    void loginRejectsInvalidPassword() {
        User user = User.builder().username("alice").password("encoded").build();
        LoginRequest request = new LoginRequest("alice", "bad-pass");
        when(userRepository.findByUsernameIgnoreCase("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("bad-pass", "encoded")).thenReturn(false);

        assertThatThrownBy(() -> userService.login(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("Invalid credentials.");
    }

    @Test
    void loginReturnsJwtTokenForValidCredentials() {
        User user = User.builder().id(5L).username("alice").password("encoded").build();
        LoginRequest request = new LoginRequest("alice", "pass");
        when(userRepository.findByUsernameIgnoreCase("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("pass", "encoded")).thenReturn(true);
        when(appConfig.getJwtSecret()).thenReturn("01234567890123456789012345678901");
        when(appConfig.getJwtExpiration()).thenReturn(1000L);

        String token = userService.login(request);

        assertThat(token).isNotBlank();
    }
}
