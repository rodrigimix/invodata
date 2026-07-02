package pt.rodrigimix.invodata.security.encryption;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class UserKeyFilter extends OncePerRequestFilter {
  public static final String HEADER = "X-User-Key";

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    try {
      String key = request.getHeader(HEADER);
      if (key != null && !key.isBlank()) {
        UserKeyContext.setKeyFromBase64(key);
      }
      filterChain.doFilter(request, response);
    } finally {
      UserKeyContext.clear();
    }
  }
}
