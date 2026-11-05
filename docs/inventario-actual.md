# Inventario actual de SecureDocs

Este inventario describe la base entregada antes de las incorporaciones de backend e infraestructura. Para el estado más reciente, consulta [entrega de Jacobo](entrega-jacobo.md), [entrega de Jerónimo](entrega-jeronimo.md) y `rg --files`. El README original sin extensión permanece intacto.

Se muestran todos los archivos fuente; se omiten dependencias, builds, resultados de pruebas y archivos de entorno privados.

```text
PROYECTO_FINAL/
├── .github/
│   ├── workflows/
│   │   └── README.md
│   └── pull_request_template.md
├── backend/
│   ├── src/
│   │   ├── health/
│   │   │   └── health.module.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   ├── api.md
│   ├── arquitectura.md
│   ├── check-runtime.mjs
│   ├── colaboracion.md
│   ├── entrega-yuly.md
│   ├── fases.md
│   ├── inventario-actual.md
│   ├── inventario.md
│   └── validacion.md
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── acceso-denegado/
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── auditoria/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── ayuda/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── documentos/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── laboratorios/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── reportes/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── seguridad/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── usuarios/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── error.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── mfa/
│   │   │   │   └── page.tsx
│   │   │   ├── registro/
│   │   │   │   └── page.tsx
│   │   │   ├── sesion-expirada/
│   │   │   │   └── page.tsx
│   │   │   ├── globals.css
│   │   │   ├── interface.css
│   │   │   ├── layout.tsx
│   │   │   ├── not-found.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── auth-form.tsx
│   │   │   ├── ui/
│   │   │   │   ├── icon.tsx
│   │   │   │   ├── modal.tsx
│   │   │   │   └── primitives.tsx
│   │   │   ├── workspace/
│   │   │   │   ├── audit.tsx
│   │   │   │   ├── demo-provider.tsx
│   │   │   │   ├── documents.tsx
│   │   │   │   ├── labs.tsx
│   │   │   │   ├── overview.tsx
│   │   │   │   ├── reports.tsx
│   │   │   │   ├── security-center.tsx
│   │   │   │   ├── shell.tsx
│   │   │   │   └── users.tsx
│   │   │   ├── header.tsx
│   │   │   └── placeholder.tsx
│   │   └── lib/
│   │       ├── api/
│   │       │   └── health.ts
│   │       ├── fixtures.ts
│   │       ├── presentation.ts
│   │       └── types.ts
│   ├── tests/
│   │   ├── e2e/
│   │   │   └── frontend.spec.ts
│   │   └── unit/
│   │       └── presentation.test.mjs
│   ├── .env.example
│   ├── AGENTS.md
│   ├── next-env.d.ts
│   ├── next.config.ts
│   ├── package.json
│   ├── playwright.config.ts
│   ├── postcss.config.mjs
│   ├── README.md
│   └── tsconfig.json
├── infra/
│   ├── docker/
│   │   ├── backend.Dockerfile
│   │   └── frontend.Dockerfile
│   ├── labs/
│   │   └── README.md
│   ├── nginx/
│   │   └── README.md
│   └── compose.yaml
├── security/
│   └── README.md
├── .dockerignore
├── .env.example
├── .gitignore
├── .nvmrc
├── .prettierignore
├── .prettierrc.json
├── package-lock.json
├── package.json
├── README
└── README.md
```

Archivos fuente listados: 84. Ver frontend/README.md para rutas y docs/entrega-yuly.md para alcance, pruebas y revisión previa al commit.
