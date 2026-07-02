package pt.rodrigimix.invodata.service.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import pt.rodrigimix.invodata.config.AppConfig;

@Service
public class EmailService {
  private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

  private final JavaMailSender mailSender;
  private final AppConfig appConfig;

  public EmailService(JavaMailSender mailSender, AppConfig appConfig) {
    this.mailSender = mailSender;
    this.appConfig = appConfig;
  }

  public void sendPasswordResetEmail(String to, String resetLink, String language) {
    if (!appConfig.isMailEnabled()) {
      logger.info("Mail disabled. Skipping password reset email to {}", to);
      return;
    }
    try {
      boolean isPt = language != null && language.trim().toLowerCase().startsWith("pt");
      String subject = isPt
          ? "Reposição de palavra-passe InvoData"
          : "InvoData password reset";
      String body = isPt
          ? "Recebemos um pedido para repor a sua palavra-passe.\n\n"
              + "Use o link abaixo para definir uma nova palavra-passe:\n"
              + resetLink + "\n\n"
              + "Se não solicitou este pedido, ignore este email."
          : "We received a request to reset your password.\n\n"
              + "Use the link below to set a new password:\n"
              + resetLink + "\n\n"
              + "If you did not request this, please ignore this email.";
      SimpleMailMessage message = new SimpleMailMessage();
      message.setTo(to);
      message.setFrom(appConfig.getMailFrom());
      message.setSubject(subject);
      message.setText(body);
      mailSender.send(message);
    } catch (Exception ex) {
      logger.error("Failed to send password reset email to {}", to, ex);
    }
  }
}
