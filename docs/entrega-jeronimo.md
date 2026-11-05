# Entrega de infraestructura y seguridad — Jerónimo

Rama de trabajo: `dev/jeronimo`, creada desde `origin/developer`. La rama contiene la base de contenedores y controles de desarrollo local descritos aquí; no se hizo commit ni push.

## Cambios

- Compose coordina MySQL, una tarea idempotente de migración TypeORM, preparación del volumen privado, API, frontend y Nginx. Solo Nginx publica un puerto loopback; los datos persisten en volúmenes Docker sobre una red interna.
- MySQL, claves de documentos, MFA y CSRF se montan desde secretos locales. `infra/scripts/init-local-secrets.ps1` genera secretos aleatorios en `.secrets/` sin sobrescribir los que ya existen. `.env`, `.secrets/` y certificados están excluidos de Git y `.dockerignore`.
- La imagen backend resuelve `DB_PASSWORD_FILE`, instala dependencias de producción después de compilar y ejecuta como usuario `node`. Frontend/backend usan filesystem de solo lectura y healthchecks; el directorio de documentos es un volumen privado con permisos del usuario de API.
- `infra/nginx/default.conf` configura proxy de mismo origen, límites HTTP, cabeceras reenviadas y límites de solicitudes. `https.conf` proporciona TLS 1.2/1.3, HTTP/2, redirección HTTPS, HSTS y cabeceras de seguridad. `compose.https.yaml` activa cookie Secure y origen público; el operador proporciona certificados válidos.
- `.github/workflows/ci-security.yml` construye, comprueba tipos, ejecuta pruebas unitarias existentes, `npm audit`, escaneo Trivy del repositorio y de las dos imágenes. `.github/dependabot.yml` propone actualizaciones semanales. Permisos mínimos y sin secretos de despliegue.
- `infra/labs/README.md` documenta prácticas locales con datos sintéticos, límites de aislamiento, captura saneada, evidencia y limpieza.

## Validación realizada

| Comprobación | Resultado |
| --- | --- |
| `docker compose --env-file .env -f infra/compose.yaml config --quiet` | Aprobada con `.env` y cinco secretos locales |
| `docker compose ... up --build -d` | Intentada con acceso al motor; bloqueada antes de descargar imágenes por fallo DNS de Docker Desktop al resolver `registry-1.docker.io` |
| Contenedores/migraciones/readiness | Pendiente: Docker Desktop no tenía las imágenes locales y no pudo acceder a Docker Hub |

La validación de configuración no acredita construcción de imágenes, compatibilidad de Nginx, migración MySQL ni ejecución de la aplicación en Docker. Repetir `up --build -d` en un equipo con acceso al registry; después revisar `docker compose ps`, `docker compose logs --no-color migrate backend nginx` y `/api/v1/health/ready`.

## Límites y siguientes pasos

- El HTTP base es solo para desarrollo local. El override HTTPS necesita certificado del host exacto y una revisión de cabeceras/cookies en navegador. No es un perfil de producción completo.
- La UI todavía presenta datos de demostración; la aceptación integral de login, MFA y documentos requiere integración de Yuly con la API y cuentas/archivos sintéticos.
- Confirmar el workflow en GitHub y después configurar en el repositorio checks requeridos y protección de `developer`/`main`. El YAML no puede activar por sí solo las reglas del repositorio.
- Acordar política de respaldo y restauración de MySQL y de la KEK. Perder la KEK hace irrecuperables documentos; mantener una copia protegida fuera de la base.
- La captura, pruebas de disponibilidad, Wi-Fi y pentesting deben seguir el alcance autorizado descrito en `infra/labs/README.md`.
