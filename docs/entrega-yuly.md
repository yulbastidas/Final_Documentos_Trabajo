# Entrega de frontend — Yuly

Esta entrega amplía la base de Fase 0 por instrucción de Yuly. Implementa interfaces y flujos de demostración para las fases 1–6. **No declara terminadas las fases del sistema**, que requieren backend, infraestructura e integración del equipo. El contrato de API existente no fue cambiado ni se asume aprobado por los compañeros.

## Alcance por fase

| Fase | Trabajo frontend incluido                                                                                                                                                | Integración pendiente                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1    | Acceso, registro, MFA, validación, estados de sesión/permisos, usuarios y edición visual de roles                                                                        | Jacobo: registro real, sesión HttpOnly, CSRF, expiración, MFA, /users/me e IAM                  |
| 2    | Panel documental, filtros, favoritos, paginación, selección/arrastre de archivo de prueba, detalles, confirmación de eliminación y descarga explícita de texto sintético | Jacobo: persistencia, autorización por objeto, contenido original, cifrado, claves e integridad |
| 3    | Salida de texto segura, validación preliminar, mensajes, carga/error/404, cabeceras básicas y UX accesible                                                               | Jacobo: validación y consultas seguras; Jerónimo: TLS, Nginx, hardening y CSP completa          |
| 4    | Pruebas de interfaces en Chrome escritorio/móvil y unitarias de exportación/archivos; instrucciones reproducibles                                                        | Jerónimo: GitHub Actions, Trivy, escaneo de imágenes y pentesting estructurado                  |
| 5    | Pantallas del plan de evidencias de VLAN, WPA2, Wireshark, MITM y disponibilidad; lista de preparación                                                                   | Jerónimo: ejecución autorizada en aislamiento y evidencias reales                               |
| 6    | Actividad sintética con filtros, reportes CSV/impresión, estadísticas y guía de presentación                                                                             | Jacobo: eventos reales/reportes autorizados; equipo: pruebas de integración y aceptación final  |

## Puntos de conexión para Jacobo

1. Revisar juntos docs/api.md antes de conectar formularios: falta definir el formato de sesión/desafío MFA y los DTO definitivos.
2. Acordar cookies, CSRF, orígenes, respuestas 401/403/429 y política de alta; eliminar el recorrido de demostración de cualquier entorno con datos reales.
3. src/lib/types.ts contiene modelos de presentación, no DTO HTTP. Crear un adaptador de respuesta validado cuando el contrato esté aprobado.
4. Reemplazar la fuente en memoria de DemoProvider por servicios autorizados, conservando la demo como entorno separado y explícito. Agregar carga, cancelación, errores de servidor, expiración y concurrencia a cada operación real.
5. Acordar tipos/tamaños de archivos, categorías, paginación/orden/favoritos y semántica de borrado. Favoritos y categorías no tienen endpoints aprobados: hoy son preferencias visuales locales.
6. La edición de roles, los datos MFA y las capacidades visibles son propuestas UX. No hay endpoint de gestión de usuarios/roles acordado. No inferir uno a partir del componente.
7. Descargas reales: verificar autorización, Content-Disposition y MIME; no considerar la muestra TXT un original descifrado. No exponer claves al navegador.
8. Eventos y reportes reales deben filtrar permisos en servidor. El CSV actual indica DEMOSTRACIÓN y no es evidencia de seguridad.
9. GET /health es la única consulta real implementada. El estado «disponible» mide el proceso, no autenticación, base de datos o seguridad.

## Archivos compartidos

Además de frontend/, se actualizan package-lock.json por Playwright, .gitignore/.prettierignore/.dockerignore para excluir artefactos de pruebas, README.md y documentación de estado. No se cambian backend/, infra/, security/, workflows ni el contrato API. Revisar estos archivos compartidos con los compañeros antes del PR.

## Preparar el commit cuando exista el repositorio

Git todavía no estaba inicializado al iniciar esta entrega. No se ejecutan git init, creación de ramas, commits ni push. No se puede crear un commit frontend aislado hasta que la base común esté versionada.

1. Revisar visualmente el panel y el alcance de esta entrega.
2. Cuando Yuly autorice, seguir docs/colaboracion.md para inicializar y publicar la base común en main. Si se publica todo el estado actual como base, incluir esta entrega en la descripción; no atribuirle historial anterior inexistente.
3. Después de disponer de main compartido, crear dev/yuly según la estrategia del equipo. No crear artificialmente un commit duplicado si los archivos ya están en main.
4. En futuros cambios de Yuly, revisar git status y git diff, añadir rutas concretas, ejecutar comprobaciones y revisar git diff --cached antes del commit autorizado. Nunca incluir .env, node_modules, .next ni informes generados.
5. Mensaje sugerido para esta entrega: `feat(frontend): add SecureDocs demo interfaces for planned phases`.

## Validación de esta entrega

Herramienta añadida: @playwright/test 1.64.1 (dependencia de desarrollo). Frontend configurado como módulo ESM. Se conserva el stack Next.js 16.4.5, React 19.3.1 y TypeScript 5.9.3 de la base. Ver inventario-actual.md para el árbol completo actualizado.

Resultados ejecutados sobre la entrega final:

| Comprobación                                            | Resultado                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| npm run build                                           | Frontend y backend compilados; backend sin cambios funcionales                                 |
| npm run build -w frontend (después de corregir el foco) | Aprobada; 14 rutas de contenido y página 404 prerenderizadas                                   |
| npm run check                                           | Tipos de ambos workspaces aprobados; comprobación frontend repetida tras el ajuste del diálogo |
| npm run format:check                                    | Aprobada                                                                                       |
| npm run test:unit -w frontend                           | 3 pruebas aprobadas: archivos de prueba, CSV e identificación del reporte sintético            |
| npm run test:e2e -w frontend                            | 24 pruebas aprobadas: 12 escenarios en Chrome escritorio y móvil                               |
| npm audit --json                                        | 0 vulnerabilidades conocidas reportadas con las dependencias finales                           |
| Revisión visual                                         | Capturas de dashboard y acceso revisadas en escritorio y móvil                                 |
| Revisión de secretos                                    | Sin coincidencias de claves privadas o tokens GitHub/AWS; datos de ejemplo con dominios .test  |
| Estado Git                                              | Sin .git ni remoto; no se crearon ramas, commits ni push                                       |

La primera ejecución E2E detectó selectores ambiguos de las pruebas (anunciador de Next.js y etiquetas de selects). La segunda detectó un fallo real: Escape cerraba el diálogo sin restaurar el foco al botón de apertura. Se corrigieron los selectores y la restauración del foco; la tercera ejecución pasó los 24 casos sin reintentos automáticos.

El frontend queda iniciado para revisión en http://localhost:3000/dashboard . Los resultados generados no forman parte del commit.

Las pruebas frontend no certifican los controles del servidor ni la aceptación global de las fases. No se ejecutó pentesting, un pipeline remoto, un laboratorio de red, conexión MySQL, cifrado ni un recorrido autenticado real. La CSP sigue siendo parcial. El informe de Fase 0 en validacion.md es histórico.
