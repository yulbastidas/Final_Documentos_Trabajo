# Manual de uso de SecureDocs

SecureDocs guarda documentos cifrados y controla quién puede verlos según su rol y la clasificación de cada documento. Todo lo que pasa queda registrado en una auditoría. Este manual explica cómo levantarlo, cómo usarlo con cada rol y qué hacer si algo falla.

## 1. Levantar el sistema

Requisitos: Docker Desktop en ejecución ("Engine running") y PowerShell abierto en la raíz del repositorio.

```powershell
Copy-Item .env.example .env                   # solo la primera vez
./infra/scripts/init-local-secrets.ps1        # crea las claves que falten; no toca las existentes
docker compose --env-file .env -f infra/compose.yaml up --build -d
Invoke-RestMethod http://localhost:8080/api/v1/health/ready   # debe decir status: ready
```

| Dirección                      | Para qué sirve                               |
| ------------------------------ | -------------------------------------------- |
| http://localhost:8080          | Portada                                      |
| http://localhost:8080/portal   | Aplicación real (inicio de sesión y módulos) |
| http://localhost:8080/api/docs | Swagger: documentación interactiva de la API |

Para apagarlo sin perder datos: `docker compose --env-file .env -f infra/compose.yaml down`. Con `down -v` se borran la base de datos y los documentos.

### Crear el primer administrador

La API no permite crear administradores desde fuera. El primero se crea con un comando dentro del contenedor:

```powershell
$env:ADMIN_EMAIL='admin@ejemplo.test'; $env:ADMIN_NAME='Administrador'
$env:ADMIN_PASSWORD='<contraseña de 12 o más caracteres>'
docker compose --env-file .env -f infra/compose.yaml run --rm --no-deps `
  -e ADMIN_EMAIL -e ADMIN_NAME -e ADMIN_PASSWORD `
  --entrypoint /usr/local/bin/securedocs-entrypoint backend node dist/scripts/create-admin.js
Remove-Item Env:ADMIN_PASSWORD
```

La contraseña debe tener al menos 12 caracteres y 5 caracteres distintos, no puede ser una contraseña común ni contener la parte del correo antes de la @.

## 2. Roles y clasificaciones

| Rol                     | Qué puede hacer                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Administrador (`admin`) | Todo: documentos de cualquier clasificación, borrar cualquiera, usuarios, auditoría y reportes |
| Colaborador (`editor`)  | Ver documentos internos y confidenciales, subir documentos y borrar solo los suyos             |
| Lector (`reader`)       | Ver documentos internos y marcar favoritos                                                     |

| Clasificación | Quién la ve                                     |
| ------------- | ----------------------------------------------- |
| Interno       | Todos los usuarios                              |
| Confidencial  | Colaboradores, administradores y el propietario |
| Restringido   | Solo el propietario y los administradores       |

Lo que la pantalla oculta es solo comodidad: el servidor vuelve a comprobar cada permiso. Si alguien pide un documento que no puede ver, la API responde 404 como si no existiera.

## 3. Uso diario

### Entrar

1. Abre http://localhost:8080/portal, escribe correo y contraseña y pulsa **Entrar**.
2. Si tienes MFA activo, escribe el código de 6 dígitos de tu aplicación y pulsa **Verificar**. Si perdiste el teléfono, elige **Usar código de recuperación**.
3. La sesión caduca tras 30 minutos sin actividad o a las 8 horas. Después de 5 contraseñas incorrectas seguidas la cuenta se bloquea 15 minutos.

Cualquier persona puede pulsar **Crear cuenta**; las cuentas nuevas siempre empiezan como Lector. Un administrador puede cambiarles el rol después.

### Documentos (todos los roles)

- **Cargar documento** (colaborador y administrador): título, clasificación y un archivo PDF o TXT de hasta 10 MB. Se rechazan los archivos cuyo contenido real no corresponde a la extensión, por ejemplo un ejecutable renombrado a `.pdf`.
- **Descargar**: el servidor descifra el archivo y comprueba su huella SHA-256 antes de entregarlo. Si alguien alteró el archivo en el disco, la descarga falla con un error de integridad en lugar de entregar contenido manipulado.
- **Marcar favorito** / **Quitar favorito** y **Buscar** por título o nombre de archivo. La API admite además filtrar por clasificación y ordenar (ver Swagger).
- **Eliminar**: el colaborador solo sus documentos; el administrador, cualquiera.

### Mi seguridad (todos los roles): activar MFA

1. Pulsa **Configurar MFA**. La pantalla muestra una clave manual.
2. En Google Authenticator, Microsoft Authenticator o similar, agrega una cuenta con "Introducir clave de configuración" y escribe esa clave (tipo basado en tiempo).
3. Escribe el código de 6 dígitos que muestra la aplicación y pulsa **Activar MFA**.
4. Guarda los **10 códigos de recuperación** que aparecen. Solo se muestran una vez y cada uno sirve una sola vez.

Desde aquí también puedes **Renovar códigos** de recuperación o **Desactivar MFA**; esto último pide contraseña y un código vigente.

### Usuarios (administrador)

Lista y busca cuentas, cambia el rol (Administrador, Colaborador, Lector) y el estado (Activo, Deshabilitado). Al guardar un cambio se cierran las sesiones abiertas de ese usuario. Un administrador no puede cambiarse a sí mismo, y el sistema no deja quitar el rol al último administrador.

### Auditoría (administrador)

Muestra cada evento con fecha, acción, actor, resultado (Permitido, Denegado o Fallido), IP e identificador de solicitud. El campo de filtro de esta pestaña filtra por resultado (`success`, `denied` o `failure`); la API admite además acción, actor y fechas. Nunca guarda contraseñas, claves ni el contenido de los documentos.

### Reportes (administrador)

Resumen del período elegido (1 a 90 días): documentos, usuarios con MFA, accesos fallidos y fallos de integridad. **Exportar resumen CSV** descarga el reporte; las celdas que empiezan por `=`, `+`, `-` o `@` se neutralizan para que Excel no las ejecute como fórmulas.

## 4. Recorrido para la presentación

1. Entra como administrador y sube un TXT sintético marcado como **Restringido**. Muestra su huella SHA-256.
2. Cierra sesión, entra como lector y muestra que el documento restringido no aparece y que no existe el botón de carga.
3. Vuelve como administrador y abre **Auditoría** y **Reportes** para relacionar los eventos con lo que acabas de hacer.
4. En **Mi seguridad**, activa MFA con una cuenta de prueba; no muestres la clave ni los códigos en pantalla compartida.

Para la parte técnica están el [informe de pentesting](informe-pentesting.md), los [laboratorios de red](../infra/labs/README.md) y la [guía de sustentación](guia-sustentacion.md).

## 5. Pruebas automáticas

| Qué                                       | Comando                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Recorrido completo en Chrome (base vacía) | `$env:ADMIN_EMAIL=...; $env:ADMIN_PASSWORD=...; node frontend/tests/integration/portal.mjs` |
| Pentesting (41 pruebas)                   | Ver [informe de pentesting](informe-pentesting.md#6-cómo-repetir-la-prueba)                 |
| Laboratorio WPA2 con radios simuladas     | `./infra/labs/wpa2/run-wpa2-lab.ps1`                                                        |
| Frontend: unitarias y e2e                 | `npm run build -w frontend; npm run test -w frontend`                                       |

El recorrido en Chrome espera una base recién creada: en la página de Usuarios busca al administrador en la primera página del listado.

## 6. Problemas frecuentes

| Síntoma                                                                                        | Causa y solución                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker Desktop dice "WSL is unresponsive" o `docker` no conecta con el motor                   | WSL quedó colgado. En PowerShell como administrador: `wsl --shutdown` (o `Restart-Service WslService -Force`) y vuelve a abrir Docker Desktop. Si sigue, reinicia el equipo. |
| `npm run dev:backend` falla con "An Application Control policy has blocked this file" (argon2) | Smart App Control de Windows bloquea el binario nativo de argon2. Ejecuta la API con Docker, donde corre en Linux. No desactives la protección de Windows para esto.         |
| `/dashboard` da 404 en http://localhost:8080                                                   | Es intencional: la demostración con datos ficticios no se incluye en la imagen Docker. Para verla: `npm run dev:frontend` y abre http://localhost:3000/dashboard.            |
| La API responde 429                                                                            | Se superó el límite de solicitudes (10 por minuto en autenticación). Espera un minuto.                                                                                       |
| "No se creó el administrador: Ya existe un usuario con ese correo"                             | Usa otro correo, o `down -v` para empezar con una base vacía.                                                                                                                |
| Un documento devuelve error de integridad                                                      | El archivo cifrado fue alterado o la clave KEK no es la misma con la que se cifró. Restaura el volumen y el archivo `.secrets/document_kek` desde un respaldo.               |
