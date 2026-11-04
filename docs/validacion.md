# Validación de Fase 0

Fecha: 3 de noviembre de 2026, America/Bogota. Raíz: `C:\Users\YULY\Documents\UNIVERSIDAD\OCTAVO SEMESTRE\PROYECTO_FINAL`.

## Inspección inicial y conservación

Solo existía `README` sin extensión, vacío (0 bytes). Se conserva intacto. No había .git, repositorio remoto, tecnologías ni configuraciones previas. No se ejecutó git init; no se crearon ramas, commits ni push. Todos los archivos de código y documentación de esta base son nuevos; Next.js ajustó su tsconfig al compilar.

## Comprobaciones ejecutadas

| Comprobación                                        | Resultado                                                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| npm install --ignore-scripts                        | Correcto; lockfile generado y dependencias resueltas                                                                               |
| npm run build                                       | Correcto para frontend y backend con las dependencias corregidas                                                                   |
| npm run check                                       | TypeScript de ambas aplicaciones sin errores                                                                                       |
| node docs/check-runtime.mjs                         | Correcto: salud JSON, contrato OpenAPI, autenticación futura ausente (404), Swagger ausente en producción, cuatro páginas HTTP 200 |
| node docs/check-runtime.mjs --dev                   | Correcto también arrancando la API desde TypeScript con ts-node                                                                    |
| Compatibilidad TypeORM/glob                         | Correcto: carga de JSON mediante utilidad de TypeORM con el override aplicado                                                      |
| docker compose -f infra/compose.yaml config --quiet | Correcto, usando variables temporales de validación sin credenciales reales                                                        |
| docker info                                         | Motor Docker 29.1.5 accesible fuera del sandbox                                                                                    |
| npm audit --json                                    | 0 vulnerabilidades conocidas reportadas, tras correcciones                                                                         |
| Revisión de secretos                                | Sin coincidencias de claves privadas, tokens GitHub/AWS o contraseñas literales; ejemplos revisados, contraseñas vacías            |
| Estado Git final                                    | No inicializado; sin remoto, ramas, commits ni push                                                                                |

La primera compilación de Next.js y la primera comprobación HTTP encontraron limitaciones del sandbox. Se repitieron fuera del sandbox y pasaron. Esto no requiere cambiar el código para otros equipos.

Se detectaron inicialmente 7 alertas de dependencias (5 moderadas, 2 altas). Se fijaron overrides en package.json: multer 2.5.0, js-yaml 5.5.0 y glob 14.0.2 bajo TypeORM. Fue necesario regenerar la instalación y el lockfile porque npm conservó resoluciones previas. Los respaldos temporales generados se eliminaron; el README original no se tocó. El override de glob cambia su versión mayor: se comprobó la interfaz utilizada por TypeORM; Jacobo debe volver a validar carga de entidades y migraciones al implementarlas y retirar el override cuando el proveedor incorpore una corrección compatible.

## Límites y pendientes reales

- No se construyeron imágenes Docker ni se levantó Compose/MySQL. La validación de Compose comprueba configuración, no funcionamiento completo. Jerónimo debe validar ese recorrido antes de compartirlo como entorno probado.
- No se ha probado conexión real MySQL, migraciones o persistencia; no hay entidades todavía.
- No se ejecutaron pruebas visuales en navegador, de accesibilidad automatizada, E2E funcionales ni pentesting. El responsive está definido por estilos y breakpoints; falta revisión visual en dispositivos.
- No hay ESLint, suite de pruebas unitarias ni pipelines activos. `npm run check` comprueba tipos y no debe presentarse como lint.
- El análisis de patrones de secretos y npm audit no garantizan ausencia total de riesgos. No existe todavía autenticación, autorización, MFA, cifrado, HTTPS ni seguridad de producción.
- No hay repositorio GitHub creado ni protección de main configurada; las instrucciones están en colaboracion.md.
- Las rutas futuras API son una propuesta documental que requiere acuerdo del equipo antes de implementarlas.

## Repetir

También se ejecutó `npm run format:check`: todos los archivos comprobados siguen el formato compartido de Prettier.

```powershell
npm ci
npm run build
npm run check
node docs/check-runtime.mjs
node docs/check-runtime.mjs --dev
npm audit
```

La comprobación HTTP usa los puertos locales 3100, 4100 y 4101 y termina sus procesos al finalizar. Ejecutarla desde la raíz con esos puertos libres. Para validar Compose, proporcionar variables locales mediante .env como explica README.md; no copiar valores reales al informe.
