# Guía de integración frontend–backend

Esta guía acompaña la infraestructura de `dev/jeronimo` y deja los puntos de conexión listos para que Yuly integre el frontend sin alterar el contrato API. El frontend sigue en modo demostración: solo `Comprobar API` hace una llamada real. Mantén el modo demo explícito hasta reemplazar las fuentes de datos y validar cada flujo contra el servidor.

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

## Secuencia de integración y aceptación

- [ ] Yuly confirma los puntos de UX que discrepan del contrato: editor borra lo propio, etiquetas de MFA, archivos permitidos y errores 401/403/429.
- [ ] Mantener DemoProvider como modo de demostración explícito; crear adaptadores y servicios API aparte y no mezclar fixtures con datos reales en una misma vista.
- [ ] Integrar sesión/login/MFA primero; después documentos; luego usuarios, auditoría y reportes. Agregar estados de carga, vacío, error, cancelación y expiración en cada módulo.
- [ ] Probar el flujo con cuentas `example.test`, PDF/TXT sintéticos y Compose: registro, login, restauración de sesión, MFA opcional, CSRF, acceso denegado por rol/propiedad, límites de carga, descarga, logout y readiness.
- [ ] Revisar que no haya credenciales en almacenamiento del navegador, console logs, capturas ni CSV. No presentar roles de UI como control de seguridad.
- [ ] Actualizar [entrega de Yuly](entrega-yuly.md) con rutas reales integradas y resultados medidos antes del PR a `developer`.

El contenedor Docker completo todavía requiere una corrida en un equipo con acceso al registry; el intento actual falló por DNS hacia `registry-1.docker.io`. La configuración de Compose sí pasó `config --quiet`; eso no sustituye la aceptación anterior.
