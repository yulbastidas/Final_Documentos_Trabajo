# Seguridad compartida

Jerónimo coordina pruebas; cada integrante responde por la seguridad de su código. No cargar documentos reales en este prototipo. La portada y el endpoint de salud no representan controles de seguridad implementados.

No versionar .env, claves, certificados privados, capturas con datos personales ni credenciales. Revisar cambios antes de cada commit. Reportar hallazgos sensibles privadamente al equipo, sin publicar secretos en issues. Revocar y rotar inmediatamente cualquier secreto expuesto; borrarlo del archivo no elimina el historial.

Pendiente por fases: modelo de amenazas, matriz de autorización, pruebas de abuso, análisis de dependencias, políticas de claves y respaldos. Ver docs/fases.md.
