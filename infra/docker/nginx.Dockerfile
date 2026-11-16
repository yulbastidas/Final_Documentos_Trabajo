# Nginx de producción: imagen oficial sin privilegios + parches de seguridad de Alpine.
# Nginx es el único servicio expuesto a internet, así que no se aceptan
# vulnerabilidades del sistema que ya tengan corrección publicada.
FROM nginxinc/nginx-unprivileged:1.30-alpine3.24@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03

USER root
RUN apk upgrade --no-cache
USER 101
