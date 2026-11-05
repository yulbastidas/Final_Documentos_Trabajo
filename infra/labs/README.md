# Laboratorios de SecureDocs

Los ejercicios son locales y usan únicamente cuentas, archivos y tráfico sintéticos. La red de Compose de SecureDocs está marcada `internal`; no conectes los laboratorios a una red corporativa, una WLAN de producción ni un bridge con servicios sensibles. La interfaz web actual sigue siendo una demostración: las funciones de sesión y documentos deben comprobarse contra la API con clientes controlados, no asumir que los botones de la UI son controles de seguridad.

## Preparar y limpiar

Desde la raíz del repositorio, copia `.env.example` a `.env`, genera secretos con `./infra/scripts/init-local-secrets.ps1` y levanta el entorno como indica `README.md`. No uses documentos ni contraseñas reales. Para detener contenedores sin borrar datos:

```powershell
docker compose --env-file .env -f infra/compose.yaml down
```

`down -v` elimina la base y los documentos cifrados. Úsalo solo si decidiste borrar el entorno local y conservar copia de cualquier evidencia necesaria.

## Ejercicios

### 1. Proxy y cabeceras

Abre `http://localhost:8080` y `http://localhost:8080/api/v1/health/ready`. Revisa `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP de Next.js y la ausencia de `X-Powered-By`. La configuración HTTP es solo para desarrollo; repite la revisión TLS con `infra/compose.https.yaml` y un certificado local confiable.

### 2. Migración y disponibilidad

Verifica que `migrate` finalice antes de `backend` y que `/api/v1/health/ready` informe `database` y `storage` como `up`. En una sesión local controlada, detén MySQL y observa el resultado de readiness; vuelve a iniciarlo y registra la recuperación. No uses `docker compose down -v` para simular una caída.

### 3. Almacenamiento documental

Usa una cuenta sintética y un PDF/TXT desechable. Confirma que la carga funciona, que se conserva tras reiniciar el backend y que un rol sin permiso no puede descargar el documento. La UI aún usa datos de demostración: realiza esta comprobación contra la API documentada en `docs/api.md` (Swagger está desactivado en `NODE_ENV=production`; puedes ejecutar un backend de desarrollo aislado si necesitas Swagger).

### 4. Captura local de tráfico

Captura únicamente tráfico de prueba hacia `localhost:8080` en la interfaz virtual de Docker Desktop. Usa `/health` y datos sintéticos, sanea PCAP antes de compartirla y borra la captura al terminar. No interceptes sesiones reales, credenciales, redes de terceros ni otros dispositivos. HTTP permite observar contenido de laboratorio; repite con HTTPS para comprobar el cifrado de transporte.

### 5. Wi-Fi y disponibilidad

La práctica WLAN requiere un punto de acceso propio y aislado, clientes de prueba, autorización y ningún puente a la red institucional o Internet. Para disponibilidad, usa solo el entorno local, limita duración y carga, y mide salud y recuperación; no generes tráfico contra servicios externos.

## Evidencia

Registra fecha, commit, objetivo, autorización, topología, comandos, resultados, limitaciones y limpieza. Capturas, PCAP, certificados, usuarios y archivos quedan fuera del repositorio. Nunca publiques claves, cookies, códigos MFA ni contenido documental en issues o reportes.
