# Seguridad compartida

Jerónimo coordina pruebas; cada integrante responde por la seguridad de su código. No cargar documentos reales en este prototipo. La portada y el endpoint de salud no representan controles de seguridad implementados.

No versionar .env, claves, certificados privados, capturas con datos personales ni credenciales. Revisar cambios antes de cada commit. Reportar hallazgos sensibles privadamente al equipo, sin publicar secretos en issues. Revocar y rotar inmediatamente cualquier secreto expuesto; borrarlo del archivo no elimina el historial.

La CI ejecuta compilación, comprobación de tipos, pruebas unitarias existentes, `npm audit` y Trivy para repositorio e imágenes. Los resultados son una señal de revisión, no una certificación. Protege `main` y `developer` con PR obligatorio, revisión y checks requeridos; Git no activa estas reglas por sí solo.

Continúan pendientes el modelo de amenazas acordado por el equipo, validación visual del TLS con certificado público, retención y respaldos verificados de la KEK, pruebas de carga y pentesting autorizado. Ver [docs/fases.md](../docs/fases.md) y [infra/labs/README.md](../infra/labs/README.md).
