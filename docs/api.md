# Contrato API — v0.1.0

Base directa local: http://localhost:4000/api/v1 . Por Compose, el origen único es http://localhost:8080/api/v1. JSON UTF-8 salvo carga (multipart) y descarga (binario). Swagger de desarrollo: /api/docs; documento generado: /api/docs-json (fuente de verdad de los esquemas). Fechas ISO 8601 UTC; identificadores UUID v4.

**Estado: implementado por Jacobo, integrado en developer y probado (ver docs/entrega-jacobo.md).** Yuly aún debe conectar el frontend demostrativo y Jerónimo validar el despliegue con contenedores/HTTPS. Las decisiones marcadas «A ACORDAR» son propuestas con valor por defecto ya implementado; cambiarlas es barato mientras no haya clientes conectados.

## Sesión, cookies y CSRF

- Sesión de servidor opaca. `POST /auth/login` (sin MFA) o `POST /auth/mfa/verify` emiten la cookie `sd_session` (`__Host-sd_session` cuando `COOKIE_SECURE=true`): HttpOnly, SameSite=Strict, Path=/, Secure con HTTPS. El navegador nunca ve el token desde JavaScript; no usar localStorage.
- Expiración: 30 min de inactividad (renovada con la actividad) y 8 h absolutas. Expirada → `401 SESSION_EXPIRED`.
- CSRF: toda solicitud POST/PUT/PATCH/DELETE con sesión debe enviar `X-CSRF-Token` con el `csrfToken` de la respuesta de login/verify o de `GET /auth/session` (útil tras recargar la página). Falta o no coincide → `403 CSRF_INVALID`. Además, un encabezado `Origin` distinto de `FRONTEND_ORIGIN` → `403 ORIGIN_NOT_ALLOWED`, también en login y registro. Fuera de producción también se admite el origen de la propia API (`http://localhost:PORT`) para usar Swagger UI.
- Cliente: `fetch(url, { credentials: 'include' })`. CORS permite solo `FRONTEND_ORIGIN` con credenciales; expone `X-Request-Id`, `Content-Disposition` y `X-Document-SHA256`.

## Errores

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Datos de entrada inválidos.",
  "requestId": "…",
  "details": [{ "field": "email", "message": "email must be an email" }]
}
```

`details` solo aparece en validación. Nunca hay trazas, SQL ni datos internos. `requestId` también llega en el encabezado `X-Request-Id`.

| HTTP | code                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------ |
| 400  | VALIDATION_FAILED, INVALID_FILE, BAD_REQUEST                                                     |
| 401  | AUTH_REQUIRED, SESSION_EXPIRED, INVALID_CREDENTIALS, MFA_INVALID                                 |
| 403  | FORBIDDEN, CSRF_INVALID, ORIGIN_NOT_ALLOWED, REGISTRATION_CLOSED                                 |
| 404  | NOT_FOUND (también para documentos ajenos no visibles: no revela su existencia)                  |
| 409  | EMAIL_ALREADY_REGISTERED, MFA_ALREADY_ENABLED, MFA_SETUP_REQUIRED, SELF_MODIFICATION, LAST_ADMIN |
| 413  | PAYLOAD_TOO_LARGE                                                                                |
| 415  | UNSUPPORTED_FILE_TYPE                                                                            |
| 429  | RATE_LIMITED                                                                                     |
| 500  | INTERNAL_ERROR, STORAGE_ERROR, DOCUMENT_INTEGRITY_FAILED                                         |

Campos desconocidos en cuerpo o query → 400 (whitelist estricta).

## Paginación

Query `page` (≥1, def. 1) y `pageSize` (1–100, def. 20). Respuesta `{ items, page, pageSize, total }`.

## Roles y permisos

| Rol (UI)              | Permisos                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------- |
| admin (Administrador) | Todo: documentos de cualquier clasificación, borrar cualquiera, usuarios, auditoría, reportes |
| editor (Colaborador)  | Leer internal y confidential ajenos + propios; subir; borrar solo propios; favoritos          |
| reader (Lector)       | Leer internal ajenos; favoritos                                                               |

`restricted` solo lo ven su propietario y admin. `GET /users/me` devuelve `permissions` efectivos y cada documento trae `permissions.canDelete`: usarlos para ocultar acciones, nunca como control (el servidor decide). **A ACORDAR:** la UI actual dice «Colaborador: sin eliminación»; se implementó «borra solo lo propio».

## Endpoints

| Método y ruta                        | Acceso                    | Entrada                                                                                                   | Salida                                                              |
| ------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET /health                          | público                   | —                                                                                                         | 200 `{status:'ok', service, version}` (liveness)                    |
| GET /health/ready                    | público                   | —                                                                                                         | 200/503 `{status:'ready'\|'not_ready', checks:{database, storage}}` |
| POST /auth/register                  | público, límite estricto  | `{email, password, displayName}`                                                                          | 201 User. Rol siempre reader                                        |
| POST /auth/login                     | público, límite estricto  | `{email, password}`                                                                                       | 200 Session **o** `{status:'mfa_required', challengeId, expiresAt}` |
| POST /auth/mfa/verify                | público, límite estricto  | `{challengeId, code}` o `{challengeId, recoveryCode}`                                                     | 200 Session + cookie                                                |
| GET /auth/session                    | sesión                    | —                                                                                                         | 200 Session (renueva csrfToken en memoria)                          |
| POST /auth/logout                    | sesión + CSRF             | —                                                                                                         | 204, cookie eliminada                                               |
| POST /auth/mfa/setup                 | sesión + CSRF             | —                                                                                                         | 200 `{secret, otpauthUri}` (mostrar una vez, QR en cliente)         |
| POST /auth/mfa/confirm               | sesión + CSRF             | `{code}`                                                                                                  | 200 `{recoveryCodes: string[10]}` (mostrar una vez)                 |
| POST /auth/mfa/disable               | sesión + CSRF             | `{password, code}`                                                                                        | 204                                                                 |
| POST /auth/mfa/recovery-codes        | sesión + CSRF             | `{code}`                                                                                                  | 200 `{recoveryCodes}` (invalida los anteriores)                     |
| GET /users/me                        | sesión                    | —                                                                                                         | 200 User                                                            |
| GET /users                           | users:read (admin)        | page, pageSize, search                                                                                    | 200 página de User                                                  |
| POST /users                          | users:manage + CSRF       | `{email, password, displayName, role}`                                                                    | 201 User (alta controlada)                                          |
| PATCH /users/:id                     | users:manage + CSRF       | `{role?, status?: 'active'\|'disabled'}`                                                                  | 200 User. Revoca sesiones del usuario                               |
| POST /documents                      | documents:create + CSRF   | multipart: `file`, `title` (1–120), `classification`                                                      | 201 Document                                                        |
| GET /documents                       | documents:read            | page, pageSize, search, classification, favorite, scope (all\|mine), sort (createdAt\|title\|size), order | 200 página de Document                                              |
| GET /documents/:id                   | documents:read            | —                                                                                                         | 200 Document                                                        |
| GET /documents/:id/download          | documents:read            | —                                                                                                         | 200 binario, `Content-Disposition: attachment`                      |
| DELETE /documents/:id                | documents:delete + CSRF   | —                                                                                                         | 204                                                                 |
| PUT / DELETE /documents/:id/favorite | documents:favorite + CSRF | —                                                                                                         | 204 (idempotentes)                                                  |
| GET /audit-events                    | audit:read (admin)        | page, pageSize, action, outcome, actorId, from, to                                                        | 200 página de AuditEvent                                            |
| GET /reports/summary                 | reports:read (admin)      | days (1–90, def. 7)                                                                                       | 200 estadísticas agregadas                                          |

### Tipos

```text
User     { id, email, displayName, role: 'admin'|'editor'|'reader', status: 'active'|'disabled',
           mfaEnabled, permissions: string[], createdAt }
Session  { status: 'authenticated', user: User, csrfToken, idleExpiresAt, absoluteExpiresAt }
Document { id, title, filename, mimeType, size, classification: 'internal'|'confidential'|'restricted',
           sha256, owner: {id, displayName}, favorite, permissions: {canDownload, canDelete},
           createdAt, updatedAt }
AuditEvent { id, occurredAt, action, outcome: 'success'|'denied'|'failure', actor: {id, email},
             resourceType, resourceId, ip, requestId, details }
```

Nunca se devuelven hashes de contraseña, nonces, tags, claves envueltas ni contenido en metadatos.

## Archivos

PDF (`%PDF-` … `%%EOF`) y TXT UTF-8 sin caracteres de control binarios. Máximo `UPLOAD_MAX_BYTES` (10 MB por defecto). La extensión, el MIME declarado y la firma real deben coincidir; el MIME guardado lo decide el servidor (`application/pdf` o `text/plain; charset=utf-8`). El nombre se sanea (sin rutas ni controles). **A ACORDAR:** tipos adicionales (DOCX, imágenes) requieren validación propia; categorías libres no existen: la «categoría» de la UI corresponde a `classification`.

## Mapa de nombres con el frontend actual

| Frontend (types.ts)                             | API                                  |
| ----------------------------------------------- | ------------------------------------ |
| Role Administrador/Colaborador/Lector           | admin / editor / reader              |
| Classification Interno/Confidencial/Restringido | internal / confidential / restricted |
| DocumentItem.category                           | Document.classification              |
| DocumentItem.owner (string)                     | Document.owner.displayName           |
| DocumentItem.updatedAt                          | Document.updatedAt                   |
| AuditEvent.result Permitido/Denegado            | outcome success / denied (+ failure) |
| DemoUser.name / mfa                             | User.displayName / mfaEnabled        |

## Cambios

PR con ejemplo de request/response, códigos HTTP, impacto, pruebas y actualización de esta versión. Yuly y Jacobo revisan cualquier cambio de contrato; Jerónimo revisa implicaciones de despliegue/seguridad.
