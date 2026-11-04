# Inventario de entrega — Fase 0

Raíz física: `C:\Users\YULY\Documents\UNIVERSIDAD\OCTAVO SEMESTRE\PROYECTO_FINAL`. Nombre lógico: securedocs; no se renombró la carpeta de Yuly.

## Árbol completo de fuentes

```text
PROYECTO_FINAL/
├── .dockerignore
├── .env.example
├── .gitignore
├── .nvmrc
├── .prettierignore
├── .prettierrc.json
├── package.json
├── package-lock.json
├── README                        # Original: 0 bytes, conservado
├── README.md
├── .github/
│   ├── pull_request_template.md
│   └── workflows/
│       └── README.md
├── frontend/
│   ├── .env.example
│   ├── next-env.d.ts
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── tsconfig.json
│   └── src/
│       ├── app/
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── dashboard/
│       │   │   └── page.tsx
│       │   ├── login/
│       │   │   └── page.tsx
│       │   └── registro/
│       │       └── page.tsx
│       └── components/
│           ├── header.tsx
│           └── placeholder.tsx
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── app.module.ts
│       ├── main.ts
│       └── health/
│           └── health.module.ts
├── infra/
│   ├── compose.yaml
│   ├── docker/
│   │   ├── backend.Dockerfile
│   │   └── frontend.Dockerfile
│   ├── labs/
│   │   └── README.md
│   └── nginx/
│       └── README.md
├── security/
│   └── README.md
└── docs/
    ├── api.md
    ├── arquitectura.md
    ├── check-runtime.mjs
    ├── colaboracion.md
    ├── fases.md
    ├── inventario.md
    └── validacion.md
```

Todos los archivos son nuevos salvo README, conservado intacto. Next.js ajustó frontend/tsconfig.json y next-env.d.ts durante el build. Los archivos fuente se formatearon con Prettier.

Artefactos locales generados, excluidos de Git y del árbol de fuentes: node_modules/ (dependencias y enlaces de workspaces), frontend/.next/ (build), backend/dist/ (JavaScript compilado), frontend/tsconfig.tsbuildinfo (caché). No deben editarse ni subirse. No hay .env con credenciales reales ni .git.

## Versiones resueltas

| Tecnología | Versión |
|---|---|
| Node.js / npm locales | 24.14.0 / 11.9.0 |
| Git instalado | 2.53.0.windows.1 |
| Docker Engine y CLI / Compose | 29.1.5 / 5.0.1 |
| Next.js | 16.4.5 |
| React / React DOM | 19.3.1 |
| TypeScript | 5.9.3 |
| Tailwind CSS / plugin PostCSS | 4.3.4 |
| NestJS common, core, platform-express | 11.2.8 |
| NestJS Config / Swagger / TypeORM | 4.0.4 / 11.4.7 / 11.0.3 |
| TypeORM / mysql2 | 0.3.31 / 3.24.6 |
| Joi / RxJS / reflect-metadata | 18.3.1 / 7.8.2 / 0.2.2 |
| ts-node / Prettier | 10.9.2 / 3.9.10 |
| MySQL (imagen declarada, no ejecutada) | 8.4 |

Transitivas corregidas: multer 2.5.0, js-yaml 5.5.0 y glob 14.0.2. Ver justificación y límites en validacion.md. package-lock.json fija las resoluciones npm. Docker declara etiquetas de desarrollo Node 24 y MySQL 8.4, no digests inmutables; Jerónimo definirá la política de imágenes en Fase 4. Nginx no tiene versión ni configuración activa todavía.

## Entrega por integrante

- Yuly: portada y componentes listos; revisar responsive/accesibilidad visualmente y construir formularios y estados de sesión tras aprobar Fase 1 y contrato.
- Jacobo: esqueleto NestJS, salud, Swagger, entorno validado y TypeORM preparados; revisar contrato, definir entidades/migraciones y desarrollar identidad y criptografía en sus fases autorizadas.
- Jerónimo: Compose y Dockerfiles iniciales, carpetas Nginx/labs/security/workflows preparadas; comprobar build y ejecución de contenedores, y abordar hardening, CI y laboratorios en sus fases.
- Equipo: acordar contratos antes de integrar, coordinar raíz/lockfile y configurar GitHub solo tras autorización de Yuly.
