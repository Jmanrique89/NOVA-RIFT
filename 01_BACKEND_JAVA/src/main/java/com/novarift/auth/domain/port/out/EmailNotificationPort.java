package com.novarift.auth.domain.port.out;

/**
 * Puerto de salida (driven port) para notificaciones por email del modulo auth.
 *
 * <p>En arquitectura hexagonal este es el "lado derecho": un contrato del dominio
 * que abstrae COMO se envia un correo. La capa de aplicacion ({@code AuthService})
 * depende de esta interfaz y nunca de un proveedor concreto (SMTP, SendGrid, un log...).
 *
 * <p>Igual que el puerto de Riot tiene un adaptador MOCK y otro REAL, este puerto
 * tiene dos implementaciones intercambiables sin tocar el dominio:
 * <ul>
 * <li>{@code LogEmailNotificationAdapter} — registra el email en el log (DEMO, sin SMTP).</li>
 * <li>{@code SmtpEmailNotificationAdapter} — envio real con {@code JavaMailSender}.</li>
 * </ul>
 * Spring activa una u otra segun la propiedad {@code app.email.mode} (LOG | SMTP).
 */
public interface EmailNotificationPort {

    /**
     * Envia el email de bienvenida a un usuario recien registrado.
     *
     * <p>Es una operacion failsafe desde el punto de vista del registro: un fallo
     * aqui NO debe abortar la creacion de la cuenta (la capa de aplicacion lo
     * envuelve en try/catch). Las implementaciones no deben asumir transaccionalidad.
     *
     * @param email direccion de correo del destinatario (ya normalizada).
     * @param username nombre de invocador, usado para personalizar el saludo.
     */
    void sendWelcome(String email, String username);
}
