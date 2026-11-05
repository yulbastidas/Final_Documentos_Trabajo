# Entrega de backend — Jacobo

Rama `dev/jacobo`, creada sobre `origin/developer` (commit `395196e`, igual a `main`). Implementa las fases 1 y 2 del backend y la parte servidor de las fases 3 y 6. Publicada en GitHub para revisión; **el PR hacia `developer` se abrirá tras acordar el contrato** con el equipo. Contrato: [api.md](api.md) v0.1.0. Guía técnica: [backend/README.md](../backend/README.md).

## Alcance

| Área                 | Implementado                                                                                                                                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contratos            | DTO validados (class-validator, whitelist estricta), sobre de error `{code,message,requestId,details?}`, paginación, Swagger completo con cookie y CSRF                                                                                                                                                           |
| Persistencia         | 7 tablas InnoDB/utf8mb4 por migración SQL explícita (`1762300000000-initial-schema`), revert reproducible, CLI y script del primer admin. synchronize/dropSchema/migrationsRun desactivados                                                                                                                       |
| Identidad            | Registro público solo como `reader` (o cerrado con `REGISTRATION_MODE=closed`); argon2id (node-argon2); login con bloqueo temporal; sesión opaca en servidor con token hasheado; expiración por inactividad y absoluta; logout con revocación                                                                     |
| CSRF                 | Cookie SameSite=Strict + token `X-CSRF-Token` (HMAC del token de sesión) + verificación de `Origin`                                                                                                                                                                                                               |
| MFA TOTP             | RFC 6238 (verificado con vectores del RFC); enrolamiento con confirmación; desafío de 5 min y 5 intentos; anti-reutilización por paso; 10 códigos de recuperación de un uso (HMAC); desactivar exige contraseña y TOTP; secreto cifrado AES-256-GCM                                                               |
| Autorización         | Guard global con denegación predeterminada; roles admin/editor/reader; política por objeto (propiedad + clasificación) aplicada en SQL; 404 para recursos ajenos; sin autoescalamiento; nadie se modifica a sí mismo; siempre un admin activo; cambios de rol revocan sesiones                                    |
| Documentos           | PDF/TXT validados por extensión, MIME declarado y firma real; 10 MB; almacenamiento privado con nombres UUID y escritura atómica; cifrado de sobre (DEK por documento, KEK externa con id para rotación); AAD ligada al id; SHA-256; descarga solo tras verificar tag y hash; compensación ante fallos; favoritos |
| Auditoría y reportes | 21 tipos de evento con resultado success/denied/failure, IP y requestId; saneamiento que redacta claves sensibles; consulta y resumen solo admin, también auditados                                                                                                                                               |
| Desarrollo seguro    | Consultas parametrizadas (QueryBuilder, LIKE con comodines escapados); límites por IP (global y estricto en auth); helmet (CSP `default-src 'none'`, sin x-powered-by); errores sin trazas; logs sin datos sensibles; liveness `/health` y readiness `/health/ready`                                              |

## Decisiones que necesitan acuerdo del equipo

Todas tienen un valor por defecto implementado y probado. Si cambian, se ajustan antes del PR.

1. **Sesión por cookie de servidor + token CSRF** (en vez de JWT). Motivo: revocación inmediata, nada en localStorage, cookie HttpOnly. Yuly debe guardar el `csrfToken` solo en memoria. — Yuly, Jerónimo.
2. **Registro público abierto con rol reader** (`REGISTRATION_MODE=open`). Alternativa: `closed` y altas solo por admin. — Equipo.
3. **Colaborador (editor) puede borrar sus propios documentos.** La matriz visual dice «sin eliminación». — Yuly.
4. **Visibilidad por clasificación**: Lector ve `internal`; Colaborador ve `internal` y `confidential`; `restricted` solo propietario y admin. — Equipo.
5. **Registro duplicado responde 409** (revela si un correo existe; mitigado con límite de solicitudes). La alternativa (202 genérico) complica la UX. — Equipo.
6. **Login bloqueado y usuario deshabilitado responden 401 INVALID_CREDENTIALS** (no revelan el estado de la cuenta). — Yuly (mensaje de UI).
7. **Tipos de archivo**: solo PDF y TXT UTF-8, 10 MB, igual que la validación visual actual. — Yuly.
8. **Integridad fallida → 500 DOCUMENT_INTEGRITY_FAILED** y evento auditado, sin entregar bytes. — Yuly (mensaje).
9. **Versión de salud 0.1.0** (antes 0.0.0). Se actualizó `docs/check-runtime.mjs`; el cliente de salud del frontend no depende de la versión.

## Resultados de pruebas ejecutadas

4 de noviembre de 2026, Windows 11, Node 24.21.0, npm 11.19.0. MySQL 8.4.9 real (mysql-memory-server); no hay Docker en este equipo.

| Comprobación                               | Resultado                                                                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build` (raíz)                     | Aprobado: frontend y backend                                                                                                                                                                 |
| `npm run check` (raíz)                     | Aprobado: tipos de ambos workspaces, incluidas las pruebas del backend                                                                                                                       |
| `npm run test -w backend`                  | **77/77 aprobadas, 8 suites**: 40 unitarias, 37 e2e contra MySQL 8.4.9                                                                                                                       |
| Migraciones (e2e)                          | Aplicadas sobre base vacía, sin pendientes, revert → solo tabla `migrations`, re-run correcto, **cero diferencias entidades/esquema**, InnoDB/utf8mb4, 6 FK                                  |
| CLI real                                   | `migration:show` (pendiente) → `migration:run` → `migration:show` (aplicada); `admin:create` crea admin y rechaza duplicado y contraseña débil                                               |
| Recorrido manual con `dist/` + MySQL       | readiness 200 → login → MFA setup/confirm → logout → login `mfa_required` → verify → carga → lista → descarga del original → auditoría → reporte → logout → 401                              |
| `node docs/check-runtime.mjs`              | Aprobado: salud, readiness 503 sin MySQL, OpenAPI, rutas protegidas no montadas sin BD, Swagger desactivado en producción, frontend HTTP 200                                                 |
| `npm audit --omit=dev`                     | **0 vulnerabilidades** en dependencias de ejecución                                                                                                                                          |
| `npm audit` (con desarrollo)               | 19 (18 moderadas, 1 baja), todas en Jest (glob, minimatch, deepmerge). Sin corrección compatible; Jest 29 no las elimina (probado). Solo herramientas de prueba con patrones propios         |
| Prettier sobre backend/ y docs modificados | Aplicado. `npm run format:check` en raíz falla en este clon porque Git (`core.autocrlf=true`) convierte todo a CRLF, incluso archivos no tocados; no es un problema del contenido versionado |

Cobertura funcional de las pruebas e2e:

- **Registro**: rol reader forzado, rechazo de `role` en el cuerpo (400), contraseña débil o común, nombre con `<`, correo inválido, duplicado (409), origen ajeno (403).
- **Sesión**: atributos de cookie, token guardado solo como hash, CSRF ausente o incorrecto (403), logout con revocación y reutilización del token rechazada, 401 sin sesión o con token inventado, misma respuesta para contraseña errónea y usuario inexistente, bloqueo tras 5 fallos y desbloqueo, expiración por inactividad y absoluta (auditadas), renovación limitada por la absoluta.
- **MFA**: confirmación con código erróneo, sin cookie hasta completar el desafío, anti-replay del código de confirmación, desafío consumido no reutilizable, 5 intentos agotan el desafío, desafío expirado, recuperación de un solo uso (también en minúsculas), sesiones previas revocadas al activar, secreto y códigos ilegibles en la BD, desactivación con validación.
- **Autorización**: visibilidad exacta por rol en lista y detalle; 404 en detalle, descarga, borrado y favorito ajenos; lector sin carga ni borrado (403); editor no borra lo ajeno (403); admin descarga restringidos; usuarios: 403 a no admin, autoescalamiento bloqueado, `SELF_MODIFICATION`, promoción que revoca sesiones, usuario deshabilitado sin acceso, alta por admin, rol inexistente (400).
- **Documentos**: archivo en disco sin texto plano, nonces únicos, descarga idéntica al original con cabeceras seguras; 9 archivos o campos inválidos (exe, PDF falso, binario como txt, MIME html, vacío, >límite, clasificación desconocida, título con HTML, `ownerId` inyectado) **sin dejar archivos ni filas**; fallo simulado de BD que elimina el archivo ya escrito; manipulación del archivo, del tag, intercambio de archivos, hash alterado y archivo ausente → 500 sin entregar bytes (5 eventos auditados); borrado completo; favoritos por usuario e idempotentes; orden, filtros, búsqueda con `' OR 1=1 --`, `%`, `_`, `\` sin efectos; query inválida (400).
- **Auditoría**: eventos esperados presentes; volcado completo de `audit_events` sin contraseñas, tokens de sesión, CSRF, secretos TOTP, códigos de recuperación, challengeId, contenido documental, claves KEK/MFA/CSRF, claves envueltas ni nonces; solo admin consulta (los denegados quedan registrados); reporte agregado coherente.
- **Plataforma**: 429 tras el límite de auth sin afectar otras rutas; cabeceras helmet y CORS con credenciales; requestId validado; 404, JSON malformado y cuerpo de 200 KB con sobre de error; Swagger con todas las rutas y esquema CSRF; API sin BD con readiness 503 y rutas protegidas en 404.

No se ejecutó: Docker/Compose (no instalado aquí), HTTPS real con `COOKIE_SECURE=true`, integración con el frontend, pruebas de carga, pentesting, análisis estático (no hay ESLint) ni pruebas en Linux.

## Archivos fuera de backend/

| Archivo                         | Cambio                                        | Revisar con    |
| ------------------------------- | --------------------------------------------- | -------------- |
| package-lock.json               | Dependencias nuevas del backend               | Equipo         |
| docs/api.md                     | Contrato v0.1.0                               | Yuly, Jerónimo |
| docs/check-runtime.mjs          | Versión 0.1.0 y comprobación de readiness 503 | Equipo         |
| docs/entrega-jacobo.md          | Este documento                                | Equipo         |
| docs/arquitectura.md, README.md | Estado actualizado (persistencia y módulos)   | Equipo         |

No se modificaron frontend/, infra/, security/ ni workflows.

## Pendientes

**Para Jerónimo (infra/, sin tocar en esta entrega):**

1. `infra/compose.yaml`: el servicio backend con `DB_ENABLED=true` **no arranca** sin `DOCUMENT_KEK`, `MFA_ENCRYPTION_KEY` y `CSRF_SECRET` (preferible como secretos de Docker con `*_FILE`). Añadir también un volumen para `STORAGE_DIR` (p. ej. `/var/lib/securedocs/documents`) y un paso `npm run migration:run:prod -w backend` antes de iniciar.
2. Con Nginx/HTTPS: `COOKIE_SECURE=true` (cookie `__Host-sd_session`), `TRUST_PROXY=1`, `FRONTEND_ORIGIN` con el origen público y, idealmente, frontend y API bajo el mismo origen.
3. La imagen backend instala dependencias de desarrollo (`npm ci`); conviene `npm prune --omit=dev` tras compilar. argon2 usa binarios precompilados: validar en la imagen Linux.
4. Límites de solicitudes en memoria por instancia: con varias réplicas usar almacenamiento compartido o limitar también en Nginx.
5. Respaldo y rotación: las KEK deben respaldarse fuera de la BD (sin ellas los documentos son irrecuperables). Rotación: nueva `DOCUMENT_KEK` + `DOCUMENT_KEK_ID`, la anterior en `DOCUMENT_KEK_PREVIOUS`. No hay todavía un script para re-envolver las DEK existentes.

**Backend (siguientes iteraciones):**

- Cambio y recuperación de contraseña (requiere correo); hoy un admin puede deshabilitar o crear cuentas.
- Exigir MFA a administradores (política), y endpoint para que el admin restablezca el MFA de un usuario con verificación.
- Auditoría a prueba de manipulación (encadenado de hashes o almacenamiento append-only) y política de retención.
- Limpieza periódica de sesiones y desafíos expirados, y de archivos `.enc` huérfanos si falla un borrado.
- Versiones de documentos y antivirus no implementados.
- Reemplazar el override de glob de TypeORM cuando el proveedor lo corrija (se validó la carga de entidades y migraciones con el override actual).

## Guía para Yuly: conectar las interfaces

Sin cambios de diseño: sustituir la fuente de datos de `DemoProvider` por un cliente HTTP, manteniendo la demo como modo explícito separado.

### 1. Cliente base (`src/lib/api/client.ts`)

```ts
const BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'
).replace(/\/$/, '');
let csrfToken = ''; // solo en memoria; nunca localStorage
export const setCsrf = (t: string) => {
  csrfToken = t;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (method !== 'GET' && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(
      res.status,
      body.code ?? 'UNKNOWN',
      body.message ?? 'Error',
      body.requestId,
      body.details,
    );
  return body as T;
}
```

Manejo global: `401 SESSION_EXPIRED` → `/sesion-expirada`; `401 AUTH_REQUIRED` → `/login`; `403 FORBIDDEN` → `/acceso-denegado`; `403 CSRF_INVALID` → llamar `GET /auth/session`, actualizar el token y reintentar una vez; `429` → mensaje de espera; `VALIDATION_FAILED` → mostrar `details[].message` por `field`. Mostrar `requestId` en errores 5xx.

### 2. Arranque del panel

Al cargar `/dashboard`: `GET /auth/session`. Si responde 200, `setCsrf(data.csrfToken)` y usar `data.user` (rol y `permissions`); si responde 401, redirigir a `/login`. Mapear roles con la tabla de api.md (admin → Administrador, etc.).

### 3. Login y MFA (`auth-form.tsx`)

```ts
const r = await api<
  Session | { status: 'mfa_required'; challengeId: string; expiresAt: string }
>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
if (r.status === 'mfa_required') {
  /* guardar challengeId en estado de React y navegar a /mfa */
} else {
  setCsrf(r.csrfToken);
  router.push('/dashboard');
}
// En /mfa:
const s = await api<Session>('/auth/mfa/verify', {
  method: 'POST',
  body: JSON.stringify({ challengeId, code }),
});
// o { challengeId, recoveryCode } con un enlace «usar código de recuperación».
setCsrf(s.csrfToken);
```

`401 MFA_INVALID` puede significar código erróneo o desafío agotado o expirado: ofrecer «volver a iniciar sesión». Registro: `POST /auth/register` → 201, luego ir a login; `409 EMAIL_ALREADY_REGISTERED`. La política es de 12 a 128 caracteres; el servidor también rechaza contraseñas comunes o que contienen el correo (mostrar `details`).

### 4. Centro de seguridad (MFA)

`POST /auth/mfa/setup` → mostrar QR de `otpauthUri` (generado en cliente, p. ej. con una biblioteca de QR) y el `secret` como texto alternativo; pedir código → `POST /auth/mfa/confirm` → mostrar los 10 `recoveryCodes` **una sola vez**, con opción de descarga TXT. Tras confirmar, las otras sesiones del usuario se cierran.

### 5. Documentos (`documents.tsx`)

```ts
const page = await api<Page<Document>>(
  `/documents?${new URLSearchParams({ page, pageSize, search, classification, favorite, sort, order })}`,
);
const fd = new FormData();
fd.append('title', title);
fd.append('classification', 'internal');
fd.append('file', file);
await api<Document>('/documents', { method: 'POST', body: fd }); // sin Content-Type manual
await api(`/documents/${id}/favorite`, { method: favorite ? 'PUT' : 'DELETE' });
await api(`/documents/${id}`, { method: 'DELETE' });
```

Descarga: `fetch(`${BASE}/documents/${id}/download`, { credentials: 'include' })`, `res.blob()`, nombre desde `Content-Disposition` (o `document.filename`) y `saveDownload` existente con `URL.createObjectURL`. Ocultar «Eliminar» si `!doc.permissions.canDelete` y «Subir» si `!user.permissions.includes('documents:create')`. Errores: `415`/`413`/`INVALID_FILE` con su `message`; `DOCUMENT_INTEGRITY_FAILED` como alerta de integridad. Quitar el texto de «límite visual»: ahora es el límite real del servidor.

### 6. Usuarios, auditoría y reportes (solo admin)

`GET /users?search=&page=`, `PATCH /users/:id {role}` o `{status}` (manejar `SELF_MODIFICATION` y `LAST_ADMIN`), `POST /users` para altas. `GET /audit-events?action=&outcome=&from=&to=` → mapear `outcome` a Permitido/Denegado/Fallido. `GET /reports/summary?days=7` para las estadísticas. El CSV puede seguir generándose en cliente con `csvCell` a partir de estos datos, quitando el aviso de demostración solo para datos reales.

### 7. Probar la integración

Backend con `DB_ENABLED=true` (backend/README.md), `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` y frontend en http://localhost:3000 (el mismo `FRONTEND_ORIGIN`). Las cookies con SameSite=Strict funcionan entre los puertos 3000 y 4000 de localhost porque son el mismo sitio. Usar solo cuentas con dominio `.test`.
