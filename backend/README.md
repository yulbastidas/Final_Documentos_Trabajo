# Backend de SecureDocs — Jacobo

API NestJS 11 + TypeORM + MySQL 8.4. Implementa identidad (registro, sesión, MFA TOTP), autorización por rol y por documento, documentos cifrados con AES-256-GCM, auditoría y reportes. Contrato: [docs/api.md](../docs/api.md) y Swagger en `/api/docs` (fuera de producción). Decisiones, pruebas y pendientes: [docs/entrega-jacobo.md](../docs/entrega-jacobo.md).

## Ejecutar en local

Desde la raíz del repositorio, con un MySQL 8.4 accesible (Compose de `infra/` o una instalación local):

```powershell
npm ci
Copy-Item backend/.env.example backend/.env
npm run keys:generate -w backend   # copiar la salida a backend/.env
# Editar backend/.env: DB_ENABLED=true y DB_PASSWORD del usuario de la base.
npm run migration:run -w backend
$env:ADMIN_EMAIL='admin@example.test'; $env:ADMIN_NAME='Admin Prueba'
$env:ADMIN_PASSWORD='<contraseña sintética de 12+ caracteres>'
npm run admin:create -w backend
Remove-Item Env:ADMIN_PASSWORD
npm run dev:backend
```

- Liveness: http://localhost:4000/api/v1/health (solo el proceso).
- Readiness: http://localhost:4000/api/v1/health/ready (MySQL y almacenamiento; 503 si fallan).
- Swagger: http://localhost:4000/api/docs y JSON en /api/docs-json.

Con `DB_ENABLED=false` la API arranca solo con salud: las rutas de identidad y documentos no se montan (404) y readiness responde 503.

## Scripts (`-w backend` desde la raíz)

| Script                                            | Uso                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| build / check                                     | Compilar a dist/ / comprobar tipos (incluye pruebas)             |
| test, test:unit, test:e2e                         | Jest. e2e levanta un MySQL 8.4 temporal (ver abajo)              |
| migration:run / migration:revert / migration:show | Migraciones con el CLI de TypeORM, leyendo backend/.env          |
| migration:run:prod                                | Igual, desde dist/ (imagen Docker)                               |
| keys:generate                                     | Imprime claves nuevas; no escribe archivos                       |
| admin:create                                      | Crea el primer admin desde ADMIN_EMAIL/ADMIN_NAME/ADMIN_PASSWORD |

`synchronize`, `dropSchema` y `migrationsRun` están desactivados: el esquema solo cambia con migraciones. Una prueba e2e verifica que las entidades coinciden exactamente con el esquema migrado.

## Pruebas

```powershell
npm run test -w backend
```

Las pruebas e2e usan `mysql-memory-server`, que descarga y arranca un MySQL 8.4 temporal (la primera vez tarda ~30 s y requiere Internet; luego usa caché). Crea una base y un usuario con permisos limitados, aplica las migraciones y lo elimina al terminar. No necesita Docker ni toca otras bases. Solo datos sintéticos.

## Estructura

```text
src/
  app.module.ts / app.setup.ts / main.ts   arranque, cabeceras, CORS, validación, Swagger
  securedocs.module.ts                     módulos que requieren MySQL y claves
  config/env.validation.ts                 esquema Joi de variables de entorno
  common/                                  errores {code,message,requestId}, requestId, DTO comunes
  authz/                                   roles, permisos, políticas por documento, decoradores
  auth/                                    registro, login, sesión, CSRF, MFA, guard global
  users/                                   perfil, gestión de usuarios y roles
  documents/                               validación de archivos, almacenamiento, cifrado, endpoints
  audit/  reports/                         eventos de auditoría y estadísticas
  crypto/                                  AES-256-GCM, TOTP RFC 6238, carga de claves
  database/                                entidades, migraciones, DataSource del CLI
  health/                                  liveness y readiness
  scripts/                                 generación de claves y alta del primer admin
test/unit, test/e2e
```
