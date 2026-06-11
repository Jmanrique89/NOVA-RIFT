package com.novarift.auth.infrastructure.adapters.out.email;

import com.novarift.auth.domain.port.out.EmailNotificationPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Adaptador de salida (driven adapter) que implementa {@link EmailNotificationPort}
 * enviando emails reales a traves de SMTP con {@link JavaMailSender}.
 *
 * <p>Es la implementacion REAL del mismo puerto que {@link LogEmailNotificationAdapter},
 * equivalente al {@code RealRiotAdapter} del modulo Live: el dominio no se entera de cual
 * esta activo. Spring solo lo activa cuando {@code app.email.mode=SMTP}; en ese caso debe
 * existir un servidor de correo configurado (host/port/user/password) via {@code spring.mail.*}.
 *
 * <p>La conexion SMTP (host, credenciales) la autoconfigura Spring Boot a partir de
 * {@code spring.mail.*}; este adaptador solo compone y manda el mensaje. El remitente se
 * toma de {@code app.email.from} (por defecto el propio usuario SMTP).
 */
@Component
@ConditionalOnProperty(name = "app.email.mode", havingValue = "SMTP")
public class SmtpEmailNotificationAdapter implements EmailNotificationPort {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailNotificationAdapter.class);

    private final JavaMailSender mailSender;
    private final String from;

    public SmtpEmailNotificationAdapter(
            JavaMailSender mailSender,
            @Value("${app.email.from:no-reply@novarift.local}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public void sendWelcome(String email, String username) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("Bienvenido a NOVA RIFT, " + username + "!");
        message.setText(
                "Hola " + username + ",\n\n"
                + "Tu cuenta de invocador en NOVA RIFT ha sido creada con exito.\n"
                + "Ya puedes iniciar sesion y completar tu onboarding (faccion, roles y campeones).\n\n"
                + "Buena suerte en la Grieta.\n"
                + "— El equipo de NOVA RIFT");

        mailSender.send(message);
        log.info("[EMAIL:SMTP] Email de bienvenida enviado a {}", email);
    }
}
