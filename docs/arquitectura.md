# Arquitectura y responsabilidades

Estado: Fase 0. La carpeta PROYECTO_FINAL es la raíz lógica `securedocs`; no se crea un directorio anidado. El archivo README vacío original se conserva.

El navegador presenta Next.js App Router + React + TypeScript + Tailwind. Consumirá HTTP JSON de NestJS bajo /api/v1. NestJS será la única capa con acceso a MySQL mediante TypeORM. El navegador nunca accede a MySQL ni recibe claves privadas. Nginx/HTTPS se incorporará en Fase 3. El almacenamiento documental privado se definirá en Fase 2; no usar public/ para documentos confidenciales.

| Área                                  | Responsable | Alcance                                                                       |
| ------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| frontend/                             | Yuly        | Interfaz, componentes, responsive, accesibilidad, integración del contrato    |
| backend/                              | Jacobo      | API modular, persistencia, autenticación, autorización y criptografía futuras |
| infra/, security/, .github/workflows/ | Jerónimo    | Entornos, Docker, proxy, análisis y laboratorios futuros                      |
| docs/, archivos raíz y lockfile       | Equipo      | Cambios coordinados y revisión cruzada                                        |

Módulos implementados en dev/jacobo (pendientes de integración): identidad y sesión, MFA, usuarios, roles/permisos, documentos, criptografía/integridad, auditoría, reportes y salud. Versiones documentales no existen todavía. Detalle en entrega-jacobo.md.

TypeORM con MySQL: 7 entidades creadas solo por migraciones (backend/src/database/migrations), sin synchronize, dropSchema ni migrationsRun. DB_ENABLED=false inicia la API solo con salud; /health mide vida del proceso y /health/ready la disponibilidad de MySQL y del almacenamiento. DB_ENABLED=true exige contraseña y claves. Los documentos cifrados se guardan en STORAGE_DIR, fuera de directorios públicos.

Convenciones: carpetas y archivos kebab-case; componentes y clases PascalCase; funciones/variables camelCase; variables de entorno SCREAMING_SNAKE_CASE; tablas snake_case plural; UUID como identificador público futuro; timestamps ISO 8601 UTC. Código TypeScript estricto, documentación en español, API en inglés. Componentes reutilizables en frontend/src/components, páginas en frontend/src/app; módulos backend en backend/src/<modulo>.

No registrar contraseñas, tokens, contenido documental ni claves. La validación y la autorización deben ejecutarse en servidor. CORS no sustituye autorización. Swagger solo se monta fuera de producción. Las rutas /login, /registro y /dashboard son públicas y estáticas: no protegen datos ni autentican.

Referencias de plataforma: https://nextjs.org/docs/app y https://docs.nestjs.com/first-steps . Versiones exactas resueltas en package-lock.json; usar npm ci para reproducirlas.
