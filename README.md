# SecureDocs

Sistema de Gestión Documental Segura — Sistemas de Comunicación y Seguridad Informática.

**Estado: base de Fase 0 + frontend de demostración de Yuly para las fases 1–6.** Incluye formularios, panel documental, roles visuales, auditoría sintética, reportes y guía de laboratorios. La API sigue limitada a salud: no hay autenticación, cifrado ni documentos reales. El README original sin extensión permanece intacto. Las fases del sistema requieren integración y aceptación conjunta.

## Inicio local

Node.js 24.14+ (línea 24), npm 11. Desde la raíz:

```powershell
npm ci
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.env.example backend/.env
npm run build
npm run check
npm run format:check
npm run dev:frontend
# En otra terminal:
npm run dev:backend
```

Frontend: http://localhost:3000 . API: http://localhost:4000/api/v1/health . Swagger: http://localhost:4000/api/docs . La API inicia sin MySQL por defecto. Reiniciar backend después de editar código/configuración según el script de desarrollo.

## Docker de desarrollo

Copiar .env.example a .env y generar contraseñas locales distintas para usuario y root. Ejecutar desde raíz:

```powershell
docker compose --env-file .env -f infra/compose.yaml config --quiet
docker compose --env-file .env -f infra/compose.yaml up --build
docker compose --env-file .env -f infra/compose.yaml down
```

No usar down -v si se desea conservar MySQL. Son imágenes de desarrollo, sin TLS y sin hardening de producción. Compose no monta el código para hot reload; reconstruir al modificarlo. No subir .env a GitHub.

## Documentación

- [Frontend: rutas, pruebas y ejecución](frontend/README.md)
- [Entrega de Yuly y dependencias de integración](docs/entrega-yuly.md)

- [Arquitectura y responsables](docs/arquitectura.md)
- [Contrato API](docs/api.md)
- [GitHub e incorporación](docs/colaboracion.md)
- [Fases y aceptación](docs/fases.md)
- [Validación y pendientes](docs/validacion.md)
- [Inventario actual completo](docs/inventario-actual.md)
- [Inventario histórico de Fase 0](docs/inventario.md)

Cada área tiene un responsable: frontend Yuly; backend Jacobo; infraestructura y seguridad Jerónimo. Los archivos compartidos requieren revisión coordinada. No crear ramas, commits ni push sin autorización.
