# Plan y criterios de aceptación

Las entregas de Yuly, Jacobo y Jerónimo están integradas en `main`: portal conectado a la API, Compose con MySQL y Nginx, HTTPS local, CI con Trivy, despliegue en AWS y laboratorios. La tabla de estado resume la evidencia de cada fase; la aceptación final la confirma el equipo en conjunto. Estos archivos no activan reglas de protección de ramas en GitHub.

## Estado al 14 de noviembre de 2026

| Fase | Estado   | Evidencia                                                                                                                                                                                                            |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Cumplida | Compose completo levantado; health, readiness y Swagger respondiendo                                                                                                                                                 |
| 1    | Cumplida | Pruebas e2e del backend; pentest A1–A8, C1–C9 y G1 (Argon2id, MFA TOTP con antirreúso, sesiones revocables, denegación predeterminada)                                                                               |
| 2    | Cumplida | Pentest F1–F4: archivo cifrado sin texto plano, alteración de 1 byte detectada, SHA-256 verificado, sin claves en metadatos; límites de carga E1–E4                                                                  |
| 3    | Cumplida | Pentest A3, B1–B4 y D1–D6; CSP ampliada sin violaciones en Chrome; TLS y cabeceras en [laboratorios](../infra/labs/README.md)                                                                                        |
| 4    | Cumplida | CI con Trivy; Trivy local sin hallazgos HIGH/CRITICAL; `npm audit` de producción en 0; [informe de pentesting](informe-pentesting.md) con alcance, resultados y remediación                                          |
| 5    | Cumplida | VLAN, disponibilidad, TLS, Wireshark y WPA2 (radios simuladas) en [laboratorios](../infra/labs/README.md). WPA2 no se probó con un AP físico                                                                         |
| 6    | Cumplida | Recorrido completo en Chrome (`frontend/tests/integration/portal.mjs`) aprobado sobre base vacía; auditoría sin secretos (pentest J1); [manual de uso](manual-uso.md) y [guía de sustentación](guia-sustentacion.md) |

Riesgos residuales y mejoras propuestas: ver la sección 5 del [informe de pentesting](informe-pentesting.md#5-hallazgos-y-remediación).

## Plan original

| Fase | Alcance previsto                                                             | Criterios de aceptación                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Estructura, portada, rutas estáticas, esqueleto API, Compose y documentación | Builds y tipos de ambas aplicaciones; health y Swagger comprobados; configuración Compose validada; revisión de secretos; pendientes documentados                                                 |
| 1    | Autenticación, usuarios, IAM, MFA, Zero Trust                                | Contrato aprobado; validación servidor, hash de contraseña apropiado, MFA verificado, permisos con denegación predeterminada, sesiones seguras; pruebas de acceso permitido/denegado y expiración |
| 2    | Documentos, AES-256-GCM, hashing e integridad                                | Permisos por objeto; cifrado/descifrado probado; nonce único, tag autenticado y claves fuera de BD/repositorio; detección de manipulación; límites de carga y descarga autorizada                 |
| 3    | Desarrollo seguro, SQL Injection, XSS, HTTPS y hardening                     | Consultas parametrizadas; salida segura; validación; CSRF según sesión; TLS y cabeceras verificados; sin hallazgos críticos pendientes sin tratamiento acordado                                   |
| 4    | GitHub Actions, Trivy, Docker, pentesting estructurado                       | Pipeline reproducible, permisos mínimos, escaneo de dependencias/imágenes, informe de alcance y remediación; pruebas solo autorizadas                                                             |
| 5    | VLAN, WPA2, Wireshark, MITM y disponibilidad                                 | Laboratorio aislado y autorizado; topología, datos sintéticos, capturas saneadas, límites y limpieza documentados; sin afectar redes externas                                                     |
| 6    | Auditoría, reportes, integración y presentación                              | Eventos sin secretos, acceso restringido, reportes verificados; recorrido completo probado, evidencias y limitaciones, manual de uso y presentación conjunta                                      |

Yuly: diseñar flujos y estados accesibles, formularios e integración acordada por fase; no simular seguridad con controles visuales. Jacobo: definir modelo de datos/migraciones y controles del servidor; implementar fases 1 y 2 tras aprobación. Jerónimo: validar Compose real, diseñar HTTPS/hardening, CI/escaneos y laboratorios en su fase. Los tres revisan amenazas, contrato y evidencia de aceptación.
