# GitHub y trabajo en equipo

Estado inicial de Fase 0: Git no estaba inicializado y no había remoto. Posteriormente Yuly inicializó Git y autorizó el primer commit y su publicación en https://github.com/yulbastidas/Final_Documentos_Trabajo.git . Los informes de Fase 0 y de entrega frontend describen el estado previo a este primer commit. Un solo repositorio contiene las tres áreas.

Estrategia actual solicitada por Yuly: main (versiones estables), developer (integración), dev/yuly, dev/jacobo y dev/jeronimo (trabajo individual). Flujo: ramas personales → PR a developer → validación conjunta → PR a main. La publicación inicial de la base es el punto de partida; developer y las ramas personales se crean después, cuando corresponda.

Cada persona trabaja principalmente en su área descrita en arquitectura.md. Cambios compartidos, package-lock.json y contratos requieren coordinación. No sobrescribir trabajo ajeno. No usar push --force. Antes de cada fase: revisar developer, main, contratos y PR integrados. Documentar todas las funcionalidades y sus pruebas.

Configurar en GitHub protección de main y developer: PR obligatorio, al menos una revisión, conversaciones resueltas y prohibición de force push. En Fase 4 agregar checks obligatorios después de disponer de workflows reales. El propietario deberá configurar estas reglas; no están activadas por estos archivos.

## Subir la base — solo cuando Yuly autorice

Crear un repositorio GitHub vacío, preferiblemente privado, sin README generado. Desde la raíz ejecutar manualmente:

```powershell
git init -b main
git status --short
git add .
git diff --cached --stat
git diff --cached
# Revisar que no haya .env, node_modules, secretos ni documentos reales.
# Solo con autorización para commit y push:
git commit -m "first commit"
git remote add origin https://github.com/yulbastidas/Final_Documentos_Trabajo.git
git push -u origin main
```

Si Git ya está inicializado en master y todavía no hay commits, usar git branch -M main para renombrar la rama antes del primer commit, en vez de repetir git init. En PowerShell escribir los comandos sin barras invertidas al final.

Invitar colaboradores con sus cuentas. No poner tokens en la URL; usar el gestor de credenciales de GitHub.

## Crear la rama de integración — después de publicar main

```powershell
git switch main
git switch -c developer
git push -u origin developer
```

Estos comandos se documentan para el paso siguiente; no forman parte de la publicación inicial solicitada.

## Incorporación de los compañeros — después de subir main

```powershell
git clone https://github.com/yulbastidas/Final_Documentos_Trabajo.git
cd Final_Documentos_Trabajo
npm ci
git switch developer
git pull --ff-only origin developer
# Cada persona ejecuta únicamente su opción cuando esté autorizada:
git switch -c dev/yuly
# O: git switch -c dev/jacobo
# O: git switch -c dev/jeronimo
```

Para publicar cada rama, después de revisión y autorización: git push -u origin dev/NOMBRE. Abrir PR contra developer con alcance y pruebas; después de validar la integración, abrir PR de developer a main. Los asistentes solo hacen commit/push con autorización explícita, como la otorgada para la publicación inicial. Para integrar avances: guardar trabajo mediante commit autorizado, git fetch origin y git merge origin/developer desde la rama personal; resolver conflictos con los propietarios y repetir comprobaciones. No usar reset destructivo para resolverlos.
