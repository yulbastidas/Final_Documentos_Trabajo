# Frontend de SecureDocs — Yuly

Interfaces de las fases 1–6, independientes del backend. El panel es una **demostración explícita con datos sintéticos**. No inicia sesiones, crea cuentas, verifica MFA, almacena documentos ni cifra archivos. Los cambios locales se pierden al recargar y al salir de la demo.

## Ejecutar

Desde la raíz del repositorio:

```powershell
npm ci
npm run dev:frontend
```

Abrir http://localhost:3000 . No hace falta iniciar MySQL ni backend para explorar la interfaz. El botón «Comprobar API» sí consulta el endpoint de salud real cuando el backend está disponible; `NEXT_PUBLIC_API_URL` se configura en frontend/.env.local siguiendo .env.example.

## Rutas

| Ruta                               | Interfaz                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| /                                  | Portada y acceso a la demostración                                                                                                  |
| /login                             | Formulario de acceso, mostrar/ocultar contraseña y validación local                                                                 |
| /registro                          | Solicitud visual, confirmación y validación de contraseña de prueba                                                                 |
| /mfa                               | Vista de código de seis dígitos, sin verificación real                                                                              |
| /dashboard                         | Resumen, documentos recientes y actividad ficticia                                                                                  |
| /dashboard/documentos              | Búsqueda, clasificación, orden, paginación, favoritos, selección/arrastre de archivo, metadatos, detalles y confirmación de borrado |
| /dashboard/usuarios                | Perfiles ficticios, edición de rol visual y matriz de capacidades                                                                   |
| /dashboard/seguridad               | Estado de integración, consulta de salud con timeout/reintento y estados 401/403                                                    |
| /dashboard/auditoria               | Eventos sintéticos, texto, resultado, fechas y paginación                                                                           |
| /dashboard/reportes                | Estadísticas, distribución, filtro, CSV e impresión de muestra                                                                      |
| /dashboard/laboratorios            | Plan de evidencias y lista de preparación local, sin herramientas de red                                                            |
| /dashboard/ayuda                   | Manual, recorrido de presentación y alcance por fase                                                                                |
| /sesion-expirada, /acceso-denegado | Vistas públicas de ejemplo; no son una evaluación de sesión o permisos                                                              |
| Cualquier ruta inexistente         | Página 404 con retorno al inicio                                                                                                    |

El panel incluye navegación móvil, enlace para saltar al contenido, tablas con desplazamiento interno, formularios etiquetados, mensajes de estado y diálogos nativos con Escape y restauración de foco.

## Organización

- src/app/: rutas, layouts, estados de carga/error y estilos.
- src/components/ui/: iconos, títulos, indicadores, avisos y diálogo.
- src/components/auth/: formularios visuales de identidad.
- src/components/workspace/: módulos y estado efímero de la demostración.
- src/lib/: modelos de presentación, datos ficticios y utilidades de exportación/validación.
- src/lib/api/health.ts: único cliente HTTP activo, limitado al contrato de salud ya implementado.
- tests/unit/: reglas de archivos de prueba y exportación CSV.
- tests/e2e/: navegación, formularios, roles visuales, documentos, reportes, salud, seguridad básica y responsive.

## Pruebas

Desde raíz:

```powershell
npm run build -w frontend
npm run check -w frontend
npm run test:unit -w frontend
npm run test:e2e -w frontend
npm run format:check
```

Playwright requiere Google Chrome instalado, utiliza el puerto 3200 y levanta automáticamente el build de producción para las pruebas. No usar ese puerto para otra aplicación. No requiere credenciales ni conexión real con el backend: las respuestas de salud se interceptan únicamente dentro del test. Los resultados, capturas e informe HTML se generan en frontend/test-results/ y frontend/playwright-report/, ignorados por Git.

Pruebas en dos tamaños: escritorio 1440×1000 y móvil 390×844. Estas dimensiones no equivalen a cobertura de todos los dispositivos. Los tests no acreditan seguridad del backend ni cumplimiento WCAG completo.

## Seguridad e integración

No guardar claves ni sesiones en localStorage/sessionStorage. No usar documentos ni contraseñas reales en esta demo. Los archivos seleccionados solo aportan nombre y tamaño; su contenido no se lee ni transmite. El límite de 10 MB y PDF/TXT son criterios visuales provisionales, no un contrato del servidor.

Las entradas se muestran como texto mediante React, sin HTML arbitrario. El CSV escapa comillas y neutraliza prefijos de fórmula. Los roles solo controlan la experiencia visual; el servidor debe autorizar cada operación. No hay checksum, tag GCM, eventos inmutables ni verificación de malware en el frontend.

next.config.ts prepara nosniff, bloqueo de framing, política de referrer y permisos de dispositivos. La CSP es parcial (framing, objetos, base y formularios); no implementa una política completa de scripts. HTTPS/HSTS, nonces y CSP definitiva deben acordarse con Jerónimo y probarse con Next.js. No se habilita HSTS en localhost.

No se modificó docs/api.md ni se conectaron endpoints futuros sin acuerdo. Ver [entrega de Yuly](../docs/entrega-yuly.md) para las dependencias de integración y la preparación del commit.
