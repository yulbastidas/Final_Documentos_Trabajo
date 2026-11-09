# Entrega de infraestructura y seguridad — Jerónimo

La base de infraestructura de `dev/jeronimo` se integró en `main` mediante el PR #3. Las correcciones y verificaciones posteriores del entorno integrado se realizaron en `dev/yuly`.

## Cambios

- Compose coordina MySQL, una tarea idempotente de migración TypeORM, preparación del volumen privado, API, frontend y Nginx. Solo Nginx publica un puerto loopback; los datos persisten en volúmenes Docker sobre una red interna.
- MySQL, claves de documentos, MFA y CSRF se montan desde secretos locales. `infra/scripts/init-local-secrets.ps1` genera secretos aleatorios en `.secrets/` sin sobrescribir los que ya existen. `.env`, `.secrets/` y certificados están excluidos de Git y `.dockerignore`.
- La imagen backend resuelve `DB_PASSWORD_FILE`, instala dependencias de producción después de compilar y ejecuta como usuario `node`. Frontend/backend usan filesystem de solo lectura y healthchecks; el directorio de documentos es un volumen privado con permisos del usuario de API.
- `infra/nginx/default.conf` configura proxy de mismo origen, límites HTTP, cabeceras reenviadas y límites de solicitudes. `https.conf` proporciona TLS 1.2/1.3, HTTP/2, redirección HTTPS, HSTS y cabeceras de seguridad. `compose.https.yaml` activa cookie Secure y origen público; el operador proporciona certificados válidos.
- `.github/workflows/ci-security.yml` construye, comprueba tipos, ejecuta pruebas unitarias existentes, `npm audit`, escaneo Trivy del repositorio y de las dos imágenes. `.github/dependabot.yml` propone actualizaciones semanales. Permisos mínimos y sin secretos de despliegue.
- `infra/labs/README.md` documenta prácticas locales con datos sintéticos, límites de aislamiento, captura saneada, evidencia y limpieza.

## Validación realizada

| Comprobación                                                          | Resultado                                                                                                                               |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `docker compose --env-file .env -f infra/compose.yaml config --quiet` | Aprobada con `.env` y cinco secretos locales                                                                                            |
| `docker compose ... up --build -d`                                    | Intentada con acceso al motor; bloqueada antes de descargar imágenes por fallo DNS de Docker Desktop al resolver `registry-1.docker.io` |
| Contenedores/migraciones/readiness                                    | Pendiente: Docker Desktop no tenía las imágenes locales y no pudo acceder a Docker Hub                                                  |

La tabla registra el intento original. Posteriormente se construyeron las imágenes y se levantó el entorno completo. Las migraciones finalizaron correctamente y el endpoint de disponibilidad, consultado por Nginx, confirmó MySQL y almacenamiento operativos. El portal real pasó sus pruebas de integración y MFA con cuentas sintéticas. Ver [validación de la integración](integracion-frontend-backend.md).

La ejecución de [GitHub Actions para el commit 4ff1f0a](https://github.com/yulbastidas/Final_Documentos_Trabajo/actions/runs/41981516440) terminó correctamente. Incluyó compilación, pruebas unitarias, escaneo Trivy del repositorio y de ambas imágenes e informes JSON. Los cambios locales de integración tendrán su propia ejecución al publicarse.

El perfil HTTPS pasó con un certificado temporal para `localhost` confiado únicamente por el proceso de prueba. Se verificaron la redirección 308, HSTS, una sola cabecera `X-Content-Type-Options: nosniff`, el rechazo de un nombre de host distinto, el login con cookie `__Host-sd_session` con `Secure`, `HttpOnly` y `SameSite=Strict`, y el rechazo de una escritura sin CSRF. Windows bloqueó el puerto 80 y la redirección se probó en el 8081. Los puertos son configurables.

En el perfil de desarrollo, se detuvo MySQL de forma controlada y `/api/v1/health/ready` respondió 503. Después de reiniciar MySQL, volvió a responder 200 con base y almacenamiento disponibles. El portal quedó operativo en `http://localhost:8080/portal`.

Se verificó un respaldo lógico de MySQL en un esquema temporal. En una segunda prueba se recuperaron desde el esquema restaurado los metadatos de un TXT sintético, se copió su archivo cifrado a un directorio temporal y se descifró con la KEK original usando el servicio de la aplicación. Coincidieron los bytes del original. Una alteración de la copia fue rechazada. Se eliminaron el esquema y el directorio temporales.

El portal local tiene cuentas sintéticas de administrador y lector, y dos archivos TXT de muestra. Se comprobó que el lector descarga la muestra interna y recibe 404 al pedir la restringida. Las credenciales se entregaron a la responsable por separado.

## Límites y siguientes pasos

- Para entregar en otro equipo, configurar un certificado confiable para el hostname de entrega y reproducir las verificaciones de HTTPS.
- Activar protección y checks requeridos en `developer` y `main`. La consulta a GitHub devolvió `protected: false` para ambas ramas.
- Conservar en un respaldo consistente el dump de MySQL y el volumen cifrado. Pausar escrituras durante el respaldo conjunto. Guardar por separado la KEK y su identificador, y la llave de cifrado MFA, con acceso restringido. Restaurar en un entorno aislado y comprobar que un documento sintético puede descargarse y que los permisos siguen vigentes.
- La prueba VLAN 802.1Q pasó en contenedores temporales. La práctica WPA2 requiere completar la asociación y el rechazo con un AP aislado o su simulación, siguiendo [la guía de laboratorios](../infra/labs/README.md).
