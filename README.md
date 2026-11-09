# SecureDocs

Sistema de Gestión Documental Segura — Sistemas de Comunicación y Seguridad Informática.

**Estado: portal conectado al backend y entorno local con Compose.** En `/portal` se usan sesiones, MFA, documentos, usuarios, auditoría y reportes de la API v0.1.0. En `/dashboard` se conserva la demostración con datos ficticios. Compose coordina MySQL, migraciones, almacenamiento privado, API, frontend y Nginx. HTTPS local usa certificados externos. Ver [integración del portal](docs/integracion-frontend-backend.md), [entrega de Jacobo](docs/entrega-jacobo.md) y [entrega de Jerónimo](docs/entrega-jeronimo.md).

## Inicio local

Node.js 24.14+ (línea 24), npm 11. Desde la raíz:

```powershell
npm ci
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.env.example backend/.env
npm run build
npm run check
npm run format:check
npm run dev:frontend
# En otra terminal:
npm run dev:backend
```

Desarrollo directo: frontend http://localhost:3000; API http://localhost:4000/api/v1/health; Swagger http://localhost:4000/api/docs. Compose: abre http://localhost:8080 y Swagger http://localhost:8080/api/docs. La API directa inicia sin MySQL por defecto; Compose activa MySQL, migraciones y almacenamiento.

## Docker de desarrollo

Copiar `.env.example` a `.env`, crear claves locales y ejecutar desde la raíz:

```powershell
Copy-Item .env.example .env
./infra/scripts/init-local-secrets.ps1
docker compose --env-file .env -f infra/compose.yaml config --quiet
docker compose --env-file .env -f infra/compose.yaml up --build -d
Invoke-RestMethod http://localhost:8080/api/v1/health/ready
docker compose --env-file .env -f infra/compose.yaml down
```

El navegador entra por http://localhost:8080. Las migraciones se aplican como tarea de una sola ejecución antes de la API. Para probar TLS local con certificados propios en `infra/tls/`, fija `PUBLIC_ORIGIN=https://localhost` y añade `-f infra/compose.https.yaml` a cada comando Compose. No subir `.env`, `.secrets/` ni certificados privados. `down` conserva los volúmenes; `down -v` borra la base y los documentos.

## Documentación

- [Frontend: rutas, pruebas y ejecución](frontend/README.md)
- [Entrega de Yuly y dependencias de integración](docs/entrega-yuly.md)
- [Backend: ejecución, migraciones y pruebas](backend/README.md)
- [Entrega de Jacobo: decisiones, pruebas y guía de integración](docs/entrega-jacobo.md)
- [Entrega de Jerónimo: contenedores, Nginx, CI y laboratorios](docs/entrega-jeronimo.md)

- [Arquitectura y responsables](docs/arquitectura.md)
- [Contrato API](docs/api.md)
- [Guía de integración frontend–backend](docs/integracion-frontend-backend.md)
- [GitHub e incorporación](docs/colaboracion.md)
- [Fases y aceptación](docs/fases.md)
- [Validación y pendientes](docs/validacion.md)
- [Inventario actual completo](docs/inventario-actual.md)
- [Inventario histórico de Fase 0](docs/inventario.md)
- [Proxy inverso y HTTPS](infra/nginx/README.md)
- [Laboratorios locales](infra/labs/README.md)

Cada área tiene un responsable: frontend Yuly; backend Jacobo; infraestructura y seguridad Jerónimo. Los archivos compartidos requieren revisión coordinada. No crear ramas, commits ni push sin autorización.
