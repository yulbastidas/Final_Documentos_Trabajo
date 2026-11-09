# Guía de integración frontend–backend

El portal conectado está en `/portal`. Su cliente HTTP consume API v0.1.0 con cookie de sesión y CSRF en memoria. El panel `/dashboard` conserva los ejemplos de demostración. El portal usa los permisos y datos devueltos por el servidor.

## Ejecutar el entorno para integración

### Opción recomendada: Compose con origen único

Desde la raíz, prepara `.env` y secretos locales como indica el [README](../README.md) y ejecuta:

```powershell
docker compose --env-file .env -f infra/compose.yaml up --build -d
```

Abre `http://localhost:8080`. Frontend y API comparten origen; Next.js se construye con `NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1` y Nginx enruta `/api/` a NestJS. API, frontend y MySQL no se publican directamente al host. Swagger de esta configuración de desarrollo: `http://localhost:8080/api/docs`.

Para el perfil HTTPS local, coloca el certificado en `infra/tls/`, cambia `PUBLIC_ORIGIN` a `https://localhost` **sin ruta ni slash final**, y usa ambos archivos Compose:

```powershell
docker compose --env-file .env -f infra/compose.yaml -f infra/compose.https.yaml up --build -d
```

La URL de API se inyecta en build time; reconstruye frontend cuando cambie `PUBLIC_ORIGIN`. No publiques credenciales ni documentos de prueba.

### Desarrollo directo (sin proxy)

Usa `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` en `frontend/.env.local`, `FRONTEND_ORIGIN=http://localhost:3000` y `TRUST_PROXY=0` en `backend/.env`; sigue las guías de ejecución de frontend/backend. No mezcles esta URL directa con el build de Compose.

## Contrato que debe consumir la UI

La fuente de verdad es [API v0.1.0](api.md) y `/api/docs-json`. Usa un cliente HTTP común con `credentials: 'include'`, `cache: 'no-store'`, errores normalizados (`code`, `message`, `requestId`, `details`) y cancelación con `AbortSignal`. No enviar secretos de sesión a JavaScript ni guardar CSRF, cookies, claves, códigos MFA o challenge IDs en `localStorage`.

1. **Restaurar sesión:** al abrir o recargar el dashboard, `GET /auth/session`; `401` lleva a login. Mantén `csrfToken` en memoria y `user` como estado de sesión. El endpoint renueva el token CSRF para la sesión existente.
2. **Login y MFA:** `POST /auth/login` con `{email,password}`. Si responde `mfa_required`, guarda temporalmente el `challengeId` en estado de React y envía `{challengeId,code}` a `POST /auth/mfa/verify`. La respuesta de sesión contiene el token CSRF. Login y registro requieren un `Origin` permitido; las escrituras autenticadas además requieren `X-CSRF-Token`.
3. **Escrituras y salida:** añade `X-CSRF-Token` a POST/PUT/PATCH/DELETE que usen sesión. `POST /auth/logout` requiere CSRF. Si una escritura responde `CSRF_INVALID`, vuelve a consultar la sesión y reintenta como máximo una vez.
4. **Errores de sesión:** distingue `AUTH_REQUIRED`, `SESSION_EXPIRED`, `FORBIDDEN`, `ORIGIN_NOT_ALLOWED`, `RATE_LIMITED` y `VALIDATION_FAILED`. Muestra `requestId` en errores del servidor; no muestres trazas ni respuestas internas.
5. **Mapear modelos con un adaptador:** los tipos en `frontend/src/lib/types.ts` son de presentación, no DTO. `admin/editor/reader` se muestran como Administrador/Colaborador/Lector; `internal/confidential/restricted` como Interno/Confidencial/Restringido; `Document.classification` alimenta `DocumentItem.category`; `owner.displayName` alimenta `owner`; `AuditEvent.outcome` mapea `success/denied/failure` a Permitido/Denegado/Fallido.
6. **Documentos:** carga multipart a `POST /documents` con `file`, `title`, `classification`; deja que el navegador genere el boundary de `FormData`. Acepta únicamente PDF/TXT UTF-8 de hasta 10 MiB. Para borrado, usa `permissions.canDelete`; un editor puede borrar documentos propios. Favoritos usan PUT/DELETE idempotentes. Descarga el binario desde `/documents/:id/download`, respeta `Content-Disposition` y no expongas el contenido en logs.
7. **Administración:** datos reales de usuarios, auditoría y reportes son endpoints solo admin (`/users`, `/audit-events`, `/reports/summary`). Los permisos del cliente solo ocultan acciones; el servidor mantiene la autorización efectiva.

## Integración verificada

- Se actualizaron las referencias de GitHub y se usó `origin/main` como base de `dev/yuly`, porque allí están integrados Jacobo y Jerónimo. `origin/developer` contiene el backend de Jacobo y todavía no incorpora los commits de infraestructura.
- El portal en `/portal` restaura sesiones y usa los permisos por usuario y documento de la API. El editor puede eliminar documentos propios si `canDelete` lo permite. Los datos de demostración viven aparte, en `/dashboard`.
- Docker reutiliza una sola imagen para la API, las migraciones y la preparación del volumen. La migración usa el CLI de TypeORM mediante Node en la imagen final. El script de entrada normaliza los finales de línea para funcionar desde Windows.
- Nginx tiene una red de entrada para publicar el puerto en loopback. MySQL, la API y el frontend quedan en la red interna. El endpoint de disponibilidad devolvió `database: up` y `storage: up` desde el host.
- La prueba real en Chrome pasó con cuentas y un TXT sintéticos. Confirmó registro, sesión HttpOnly, restauración tras recargar, carga, favoritos, descarga con los mismos bytes, auditoría, reportes, permiso denegado al lector, eliminación y cierre de sesión. El navegador mantuvo vacíos localStorage y sessionStorage.
- Una segunda prueba en Chrome confirmó el alta TOTP, el desafío al volver a iniciar sesión y el acceso con un código de recuperación.
- Pasaron las comprobaciones de tipos, la compilación y las pruebas unitarias (40 del backend y 3 del frontend). Los 24 escenarios de la demostración pasaron contando la repetición de la prueba de rutas en escritorio, que había agotado el tiempo durante el arranque de Docker.
- Los 37 escenarios de integración del backend quedaron aprobados entre la primera corrida y la repetición de la suite documental. La primera corrida aprobó 24 y agotó el tiempo al preparar la suite documental. Los 13 casos de esa suite pasaron al ejecutarla aisladamente.

El perfil HTTPS se verificó localmente con un certificado temporal. Quedan el certificado del entorno de entrega y los laboratorios físicos. La auditoría npm de producción reportó 0 vulnerabilidades conocidas. La instalación completa con herramientas de desarrollo reportó 19 alertas (18 moderadas y 1 baja).

## Crear el primer administrador local

Con el entorno levantado, crea el usuario desde PowerShell. El registro en el portal crea cuentas lectoras.

```powershell
$env:ADMIN_EMAIL = 'admin@example.test'
$env:ADMIN_PASSWORD = Read-Host 'Contraseña del administrador (mínimo 12 caracteres)' -MaskInput
try {
  docker compose --env-file .env -f infra/compose.yaml exec -T -e ADMIN_EMAIL -e ADMIN_PASSWORD backend /usr/local/bin/securedocs-entrypoint node dist/scripts/create-admin.js
} finally {
  Remove-Item Env:ADMIN_PASSWORD
}
```

Entra por http://localhost:8080/portal. La configuración MFA permite añadir la clave manualmente a un autenticador TOTP. Conserva los códigos de recuperación en un lugar privado.

## Prueba del portal contra la API real

Con Chrome y las dependencias de desarrollo instaladas, crea un administrador sintético nuevo con el procedimiento anterior y ejecuta `node frontend/tests/integration/portal.mjs` dentro del bloque `try` antes de limpiar la contraseña. La prueba crea además una cuenta lectora sintética. Comprueba sesión y recarga, carga y descarga íntegra, favoritos, auditoría, reportes, acceso denegado y cierre de sesión.
