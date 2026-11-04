# Contrato API inicial — v0.0.0

Base local: http://localhost:4000/api/v1 . JSON UTF-8. Swagger de desarrollo: /api/docs; documento generado: /api/docs-json. El contrato ejecutable actual incluye únicamente salud.

## Implementado en Fase 0

GET /health — público, sin body ni parámetros. HTTP 200, application/json:

```json
{ "status": "ok", "service": "securedocs-api", "version": "0.0.0" }
```

No verifica conectividad de base de datos. Rutas inexistentes devuelven el error estándar de NestJS 404. No depender de un sobre de error propio hasta aprobarlo.

## Propuesta para fases futuras — no implementada

Esta propuesta debe ser revisada por los tres antes de integrar clientes dependientes. No construir mocks que hagan pasar estas rutas por operativas.

| Fase | Método y ruta               | Entrada prevista               | Salida prevista                              |
| ---- | --------------------------- | ------------------------------ | -------------------------------------------- |
| 1    | POST /auth/register         | email, password, displayName   | 201: id, email, displayName                  |
| 1    | POST /auth/login            | email, password                | 200: estado de sesión o desafío MFA          |
| 1    | POST /auth/mfa/verify       | challengeId, code              | 200: sesión validada                         |
| 1    | POST /auth/logout           | sesión                         | 204                                          |
| 1    | GET /users/me               | sesión                         | 200: id, email, displayName, roles           |
| 2    | POST /documents             | multipart file, title          | 201: metadatos sin claves ni contenido       |
| 2    | GET /documents              | page, pageSize                 | 200: items, page, pageSize, total            |
| 2    | GET /documents/:id/download | UUID y sesión autorizada       | 200: binario; Content-Disposition attachment |
| 2    | DELETE /documents/:id       | UUID y sesión autorizada       | 204                                          |
| 6    | GET /audit-events           | filtros aprobados y paginación | 200: eventos autorizados                     |

Antes de Fase 1: acordar sesión/cookies HttpOnly, SameSite, CSRF, expiración, recuperación, alta controlada y desafío MFA; no almacenar tokens en localStorage por defecto. El registro no permitirá autoasignarse roles. Antes de Fase 2: acordar tamaños/tipos permitidos, metadatos, permisos por objeto, conservación y errores.

Propuesta de errores futuros: {code, message, requestId}, sin trazas; 400 validación, 401 sin sesión, 403 sin permiso, 404 recurso ausente, 409 conflicto, 413 tamaño, 415 formato, 429 límite. Fechas UTC ISO 8601, IDs UUID; nunca retornar hashes de contraseñas o material criptográfico.

Cambios: PR con ejemplo de request/response, códigos HTTP, impacto, pruebas y actualización de esta versión. Yuly y Jacobo revisan cualquier cambio de contrato; Jerónimo revisa implicaciones de despliegue/seguridad. No modificar unilateralmente.
