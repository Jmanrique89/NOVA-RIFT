package com.novarift.auth.infrastructure.adapters.out.email;

import com.novarift.auth.domain.port.out.EmailNotificationPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adaptador de salida (driven adapter) que implementa {@link EmailNotificationPort}
 * registrando el email de bienvenida en el LOG, sin contactar con ningun servidor SMTP.
 *
 * <p>Es la implementacion de DEMO/TFG: equivalente al {@code MockRiotAdapter} del modulo
 * Live. Demuestra el desacoplamiento hexagonal (el dominio depende del puerto, no del
 * proveedor) y permite ejecutar el flujo de registro completo sin red ni credenciales.
 * Por diseno no falla nunca.
 *
 * <p>Spring lo activa cuando {@code app.email.mode=LOG} y tambien por defecto si la
 * propiedad falta ({@code matchIfMissing=true}), de modo que un clon recien clonado
 * arranca en modo seguro.
 */
@Component
@ConditionalOnProperty(name = "app.email.mode", havingValue = "LOG", matchIfMissing = true)
public class LogEmailNotificationAdapter implements EmailNotificationPort {

    private static final Logger log = LoggerFactory.getLogger(LogEmailNotificationAdapter.class);

    @Override
    public void sendWelcome(String email, String username) {
        String subject = "Bienvenido a NOVA RIFT, " + username + "!";
        String body = "Hola " + username + ",\n\n"
                + "Tu cuenta de invocador en NOVA RIFT ha sido creada con exito.\n"
                + "Ya puedes iniciar sesion y completar tu onboarding (faccion, roles y campeones).\n\n"
                + "Buena suerte en la Grieta.\n"
                + "— El equipo de NOVA RIFT";

        log.info("[EMAIL:LOG] (modo demo, sin SMTP) To: {} | Asunto: {}\n{}", email, subject, body);
    }
}
