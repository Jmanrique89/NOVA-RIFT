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

## Ejecución

### Backend

```bash
cd 01_BACKEND_JAVA
mvn spring-boot:run
```

Arranca por defecto con base de datos **H2 en fichero** (sin dependencias
externas) en `http://localhost:8080`. Swagger UI en `/swagger-ui.html`.

Para usar datos reales de Riot, define la API key como variable de entorno
antes de arrancar (nunca se sube al repositorio):

```bash
# Windows PowerShell
$env:RIOT_API_KEY = "RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Sin clave válida, el backend opera en modo de respaldo / MOCK.

Perfil Oracle (opcional):

```bash
docker compose -f 03_INFRASTRUCTURE/docker-compose.yml up -d
SPRING_PROFILES_ACTIVE=oracle mvn spring-boot:run
```

### Frontend

```bash
cd 02_FRONTEND_MOBILE
npm install
npx expo start
```
