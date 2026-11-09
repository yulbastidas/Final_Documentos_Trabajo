# Proxy inverso de SecureDocs

Compose publica únicamente Nginx en `127.0.0.1:8080`. El navegador usa el mismo origen para Next.js y `/api/v1`. MySQL, API y frontend quedan en la red interna. Nginx conecta esa red con una red de entrada separada. El proxy limita solicitudes globales y de autenticación, limita cargas a 11 MiB y reenvía la IP y el protocolo.

## Desarrollo local

`default.conf` atiende HTTP para el entorno local. No transportes credenciales ni documentos reales por esta configuración. `TRUST_PROXY=1` permite a la API confiar solo en el proxy inmediato de Compose; el proxy reemplaza `X-Real-IP` y envía `X-Forwarded-Proto`.

## HTTPS local o despliegue

`https.conf` redirige HTTP a HTTPS, habilita TLS 1.2/1.3, HTTP/2, HSTS y cabeceras de seguridad. El certificado y la clave privada deben existir en `infra/tls/fullchain.pem` y `infra/tls/privkey.pem`; `infra/tls/` está ignorado por Git.

1. Instala un certificado confiable para el host que usarás (por ejemplo, `localhost` para pruebas locales).
2. Configura `PUBLIC_ORIGIN=https://localhost` en `.env`.
3. Ejecuta `docker compose --env-file .env -f infra/compose.yaml -f infra/compose.https.yaml up --build -d`.
4. Para un servidor público, cambia los bindings loopback del override por interfaces adecuadas, instala un certificado válido y establece `PUBLIC_ORIGIN` al origen público exacto.

El override activa `COOKIE_SECURE=true`, usa `__Host-sd_session` y monta el certificado en solo lectura. No incluye una autoridad certificadora ni solicita certificados automáticamente. HSTS se habilita en el virtual host TLS; no actives el override detrás de otro proxy sin revisar la cadena de proxies, TLS, IP de cliente, límites y `TRUST_PROXY`.

Si Windows reserva el puerto 80, configura `HTTPS_REDIRECT_PORT=8081`. Si necesitas mover TLS al 8443, usa `HTTPS_PORT=8443` y `PUBLIC_ORIGIN=https://localhost:8443`. Reconstruye el frontend al cambiar el origen. Nginx redirige al origen configurado y deja `/healthz` disponible para el chequeo interno.
