# Gestión de vulnerabilidades de imágenes de terceros

El workflow `deploy-azure.yml` escanea con Trivy (v0.76.2, severidad HIGH/CRITICAL, solo hallazgos con
corrección publicada) todas las imágenes que llegan a producción y **bloquea el despliegue** si encuentra
alguno. Este documento registra cómo se trató cada hallazgo de las imágenes de terceros (análisis del
2026-11-16).

## Criterio

1. **Si existe parche, se aplica.** No se aceptan riesgos que se pueden corregir.
2. **Si no existe parche**, se analiza si el código vulnerable es alcanzable en SecureDocs. Solo si no lo
   es, se acepta el riesgo con: justificación por hallazgo, **alcance limitado a esa imagen** (archivo de
   excepciones propio, usado solo en su paso de escaneo) y **fecha de vencimiento** (2027-02-16). Al vencer,
   el despliegue vuelve a bloquearse hasta que alguien lo reevalúe.

## Resultado por imagen

| Imagen                                           | Hallazgos | Tratamiento                                                                                |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------ |
| `nginxinc/nginx-unprivileged:1.30-alpine3.24`    | 13 (1 C)  | **Corregido.** `infra/docker/nginx.Dockerfile` aplica `apk upgrade`; la imagen queda en 0. |
| `mysql:8.4.13`                                   | 35 (2 C)  | Riesgo aceptado: [`mysql.trivyignore.yaml`](mysql.trivyignore.yaml)                        |
| `certbot/certbot:v5.10.0`                        | 5         | Riesgo aceptado: [`certbot.trivyignore.yaml`](certbot.trivyignore.yaml)                    |
| Imágenes propias (`securedocs-backend/frontend`) | 0         | Sin excepciones.                                                                           |

### Nginx (expuesto a internet)

Es el único contenedor con puertos publicados. Las 13 vulnerabilidades (zlib, brotli, libexpat, musl,
libxslt, curl) son paquetes de Alpine con corrección publicada pero aún no incluida en la imagen oficial.
La imagen derivada solo añade los parches del sistema: misma versión de Nginx (1.30.6), mismo usuario sin
privilegios (UID 101) y misma configuración. Se publica en ACR como `securedocs-nginx:<sha>`.

### MySQL

La imagen oficial de Oracle (incluido su build más reciente del 2026-11-03) trae:

- **26 CVE de la biblioteca estándar de Go en `gosu`.** `gosu` solo se ejecuta al iniciar el contenedor
  para pasar de root al usuario `mysql` y luego hace `exec` de `mysqld`; no usa red, TLS, HTTP ni procesa
  entradas externas, que es donde están las vulnerabilidades. La excepción se limita a la ruta
  `usr/local/bin/gosu`.
- **9 vulnerabilidades en librerías de Python** (certifi, cryptography, pyOpenSSL, urllib3) empaquetadas
  con **MySQL Shell** (`mysqlsh`), herramienta de administración opcional que SecureDocs nunca ejecuta.

Además, MySQL corre en la red Docker `securedocs-internal` (`internal: true`): sin salida a internet y sin
puertos publicados; solo la API llega a él.

### Certbot

Contenedor efímero (`--rm`) que solo corre al emitir o renovar el certificado (una vez al día como máximo)
y únicamente inicia conexiones HTTPS hacia la API ACME de Let's Encrypt; no recibe conexiones. Las 5
vulnerabilidades (setuptools, msgpack, urllib3) están en librerías de Python y v5.10.0 es la última versión.

## Verificación

Las excepciones se probaron con Trivy v0.76.2: cada imagen queda limpia con su propio archivo, y la imagen
de MySQL **sigue fallando** si se escanea con el archivo de Certbot, lo que demuestra que una excepción no
encubre hallazgos de otra imagen.

## Reevaluación

Antes del 2027-02-16 (o al actualizar cualquiera de estas imágenes): volver a escanear, borrar las
excepciones que ya no apliquen y actualizar este documento.
