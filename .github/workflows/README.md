# GitHub Actions y Trivy

`ci-security.yml` corre en PR hacia `developer`/`main`, en push a las ramas de integración y personales, y manualmente. Comprueba build, tipos, unit tests existentes, `npm audit`, configuración/secretos/dependencias con Trivy y vulnerabilidades HIGH/CRITICAL en las dos imágenes Docker. Los permisos globales son `contents: read`; no se suben imágenes ni se publican resultados SARIF.

Las acciones están fijadas a SHA completo cuando se dispone de SHA verificado; Trivy usa el release inmutable `v0.36.0`. Dependabot propone actualizaciones de npm y GitHub Actions cada semana. Antes de exigir checks en las reglas de rama, ejecuta el workflow en GitHub y confirma sus nombres de job. Trata falsos positivos mediante revisión y excepciones acotadas, nunca deshabilitando el escaneo global.
