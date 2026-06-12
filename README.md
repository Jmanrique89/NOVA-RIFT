# NOVA RIFT

Aplicación companion para *League of Legends*: análisis de partida en vivo,
coaching y progresión. Proyecto Fin de Ciclo (TFG) — 2026.

## Stack

- **Backend:** Java 21 · Spring Boot · Maven · arquitectura hexagonal
- **Frontend:** Expo · React Native
- **Infraestructura:** Docker Compose (Oracle XE opcional) · Riot Data Dragon · OpenAPI

## Estructura

```
01_BACKEND_JAVA/      API REST (Spring Boot)
02_FRONTEND_MOBILE/   App móvil (Expo / React Native)
03_INFRASTRUCTURE/    docker-compose, data dragon, especificación OpenAPI
```

## Requisitos previos

| Herramienta | Versión | Verificar con |
|---|---|---|
| JDK | 21 | `java -version` |
| Maven | 3.9+ | `mvn -version` |
| Node.js + npm | 18+ | `node -v` |
| Docker | opcional (solo perfil Oracle) | `docker -v` |

No se necesita base de datos externa: el backend arranca con H2 embebida.

## Ejecución

### 1. Backend

```bash
cd 01_BACKEND_JAVA
mvn spring-boot:run
```

Arranca por defecto con base de datos **H2 en fichero** (sin dependencias
externas) en `http://localhost:8080`. Swagger UI en `/swagger-ui.html`.
La base de datos se crea y se siembra sola en el primer arranque (`data.sql`).

Para usar datos reales de Riot, define la API key como variable de entorno
antes de arrancar (nunca se sube al repositorio):

```bash
# Windows PowerShell
$env:RIOT_API_KEY = "RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# Linux / macOS
export RIOT_API_KEY="RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Sin clave válida la aplicación funciona igualmente**: el backend cae a modo
de respaldo/MOCK con datos de demostración (también puede forzarse con
`APP_RIOT_MODE=MOCK`).

Perfil Oracle (opcional, no necesario para evaluar):

```bash
docker compose -f 03_INFRASTRUCTURE/docker-compose.yml up -d
SPRING_PROFILES_ACTIVE=oracle mvn spring-boot:run
```

### 2. Frontend

```bash
cd 02_FRONTEND_MOBILE
npm install
npx expo start
```

Con el backend levantado: pulsa `w` para abrirla en el navegador (web), o
escanea el QR con **Expo Go** para móvil, o pulsa `a` para emulador Android.
La app detecta sola el host del backend; solo para móvil físico por WiFi
puede hacer falta fijar la IP del PC — ver `.env.example`.

## Variables de entorno (resumen)

| Variable | Dónde | Por defecto | Para qué |
|---|---|---|---|
| `RIOT_API_KEY` | backend | placeholder (→ fallback) | Datos reales de Riot API |
| `APP_RIOT_MODE` | backend | `REAL` | `MOCK` = demo sin clave |
| `APP_EMAIL_MODE` | backend | `LOG` | `SMTP` = email real de bienvenida |
| `JWT_SECRET` | backend | valor de desarrollo | Firma de tokens (cambiar en prod) |
| `EXPO_PUBLIC_API_HOST` | frontend | autodetección | Forzar IP del backend (móvil físico) |

## Solución de problemas

- **Puerto 8080 ocupado** → libera el puerto o cambia `server.port` en
  `01_BACKEND_JAVA/src/main/resources/application.properties`.
- **El frontend no conecta desde emulador Android** → usa `10.0.2.2:8080`
  (lo hace automáticamente si no hay override en `.env`).
- **401/403 de Riot** → clave caducada; la app sigue funcionando en fallback.
- **Consola H2** → `http://localhost:8080/h2-console` · JDBC
  `jdbc:h2:file:./data/novarift` · usuario `sa` · sin contraseña.
