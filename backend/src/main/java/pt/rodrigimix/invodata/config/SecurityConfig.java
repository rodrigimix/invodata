package pt.rodrigimix.invodata.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import pt.rodrigimix.invodata.security.encryption.UserKeyFilter;
import pt.rodrigimix.invodata.config.AppConfig;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

        private final JwtAuthenticationFilter jwtAuthenticationFilter;
        private final UserKeyFilter userKeyFilter;
        private final AppConfig appConfig;

        public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, UserKeyFilter userKeyFilter,
                        AppConfig appConfig) {
                this.jwtAuthenticationFilter = jwtAuthenticationFilter;
                this.userKeyFilter = userKeyFilter;
                this.appConfig = appConfig;
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        @Bean
        public WebSecurityCustomizer webSecurityCustomizer() {
                return web -> web.ignoring().requestMatchers("/api/shares/token/**");
        }

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                .cors(Customizer.withDefaults())
                                .csrf(AbstractHttpConfigurer::disable)
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                                                .requestMatchers("/api/auth/**").permitAll()
                                                .requestMatchers("/api/admin/**").permitAll()
                                                .requestMatchers("/api/setup/**").permitAll()
                                                .requestMatchers("/api/shares/token/**").permitAll()
                                                .requestMatchers("/actuator/health/**").permitAll()
                                                .requestMatchers(
                                                                "/v3/api-docs/**",
                                                                "/swagger-ui/**",
                                                                "/swagger-ui.html")
                                                .permitAll()
                                                .anyRequest().authenticated())
                                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                                .addFilterAfter(userKeyFilter, JwtAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration configuration = new CorsConfiguration();
                List<String> origins = new java.util.ArrayList<>(List.of(
                                "http://localhost:3000",
                                "http://localhost:4200",
                                "http://localhost:8081",
                                "https://invodata-frontend-629310241065.europe-west1.run.app",
                                "https://invodata.pt",
                                "https://www.invodata.pt"));
                if (appConfig.getFrontendUrl() != null && !appConfig.getFrontendUrl().isBlank()) {
                        origins.add(appConfig.getFrontendUrl().trim());
                }
                if (appConfig.getCorsAllowedOrigins() != null && !appConfig.getCorsAllowedOrigins().isBlank()) {
                        String[] extra = appConfig.getCorsAllowedOrigins().split(",");
                        for (String origin : extra) {
                                if (origin != null && !origin.isBlank()) {
                                        origins.add(origin.trim());
                                }
                        }
                }
                configuration.setAllowedOrigins(origins);
                configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
                configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Cache-Control",
                                "X-Admin-Password", "X-User-Key"));
                configuration.setAllowCredentials(true);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", configuration);
                return source;
        }
}
