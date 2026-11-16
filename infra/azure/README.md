# Despliegue de SecureDocs en Azure

Alternativa a `infra/aws/` para la suscripción **Azure for Students**. Mantiene la misma arquitectura:
una VM con Docker Compose, Nginx como único servicio expuesto (80 → 443), MySQL y documentos
cifrados en volúmenes locales, certificado de Let's Encrypt y despliegue desde GitHub Actions.

| AWS (`infra/aws`)                  | Azure (`infra/azure`)                                                   |
| ---------------------------------- | ----------------------------------------------------------------------- |
| CloudFormation `securedocs.yaml`   | Bicep `main.bicep`                                                      |
| EC2 Amazon Linux + EBS cifrado     | VM Ubuntu 24.04 (Trusted Launch) + disco administrado cifrado en reposo |
| Elastic IP + dominio propio        | IP pública estática + `<label>.<region>.cloudapp.azure.com`             |
| Security Group 80/443              | NSG 80/443 (22 cerrado)                                                 |
| SSM Parameter Store                | Key Vault (RBAC)                                                        |
| ECR                                | Azure Container Registry (Basic, sin usuario admin)                     |
| SSM Run Command                    | `az vm run-command` (sin SSH)                                           |
| Rol IAM con OIDC de GitHub         | Identidad administrada con credencial federada de GitHub                |
| S3 (respaldos)                     | Blob Storage sin claves compartidas, retención 35 días                  |
| CloudWatch                         | Registros locales con rotación + chequeo de salud con autorreinicio     |
| `.github/workflows/deploy-aws.yml` | `.github/workflows/deploy-azure.yml`                                    |

Costo aproximado: VM `Standard_B2als_v2` ≈ USD 30/mes, ACR Basic ≈ USD 5/mes, IP y disco ≈ USD 6/mes.
Para no gastar crédito cuando no se use: `az vm deallocate -g securedocs-prod -n securedocs-vm`
(y `az vm start` para volver). Para borrarlo todo: `az group delete -n securedocs-prod`.

## 1. Crear la infraestructura (una vez)

Requisitos: Azure CLI (`az login`) y permisos de propietario en la suscripción.

```powershell
az group create -n securedocs-prod -l chilecentral   # Azure for Students solo permite 5 regiones; B2als_v2 tenía capacidad aquí
ssh-keygen -t rsa -b 4096 -f $HOME\.ssh\securedocs_azure -N '""'   # Azure la exige; el puerto 22 sigue cerrado
az deployment group create -g securedocs-prod -f infra/azure/main.bicep `
  -p dnsLabel=<etiqueta-unica> certificateEmail=<correo> `
     operatorPrincipalId=$(az ad signed-in-user show --query id -o tsv) `
     adminSshPublicKey="$(Get-Content $HOME\.ssh\securedocs_azure.pub)"
```

Las salidas del despliegue (`az deployment group show -g securedocs-prod -n main --query properties.outputs`)
son los valores para GitHub.

## 2. Cargar los secretos en Key Vault (una vez)

Cada secreto son 32 bytes aleatorios en Base64. Se generan en un archivo temporal, se suben y se borran;
nunca pasan por la línea de comandos ni por el repositorio:

`mysql-password`, `mysql-root-password`, `document-kek`, `mfa-encryption-key`, `csrf-secret`.

`document-kek-previous` solo se crea al rotar la KEK. Guarde una copia fuera de línea de `document-kek`:
sin ella los respaldos de documentos no se pueden descifrar.

## 3. Configurar GitHub (una vez)

En _Settings → Environments → production → Variables_:

| Variable                | Salida de Bicep     |
| ----------------------- | ------------------- |
| `AZURE_CLIENT_ID`       | `githubClientId`    |
| `AZURE_TENANT_ID`       | `tenantId`          |
| `AZURE_SUBSCRIPTION_ID` | `subscriptionId`    |
| `AZURE_RESOURCE_GROUP`  | `resourceGroupName` |
| `AZURE_VM_NAME`         | `vmName`            |
| `ACR_NAME`              | `acrName`           |
| `ACR_LOGIN_SERVER`      | `acrLoginServer`    |
| `PUBLIC_ORIGIN`         | `publicOrigin`      |

No hay secretos que guardar en GitHub: el login usa OIDC y la credencial federada solo acepta
ejecuciones del environment `production` de este repositorio.

## 4. Desplegar

_Actions → Desplegar SecureDocs en Azure → Run workflow_ (rama `main`). El workflow compila, ejecuta
todas las pruebas (incluidas las e2e del backend con MySQL), audita dependencias, escanea con Trivy,
publica imágenes inmutables (`:<sha>`) en ACR y ejecuta `securedocs-deploy.sh` en la VM, que emite el
certificado la primera vez, migra la base y verifica `/api/v1/health/ready` por HTTPS.

Rollback: ejecutar el workflow con `release_sha` de un commit anterior de `main` cuya imagen siga en ACR.

## 5. Crear el primer administrador

```powershell
az vm run-command invoke -g securedocs-prod -n securedocs-vm --command-id RunShellScript `
  --scripts 'ADMIN_EMAIL="$1" ADMIN_NAME="$2" ADMIN_PASSWORD="$3" bash /usr/local/sbin/securedocs-create-admin' `
  --parameters <correo> "<nombre>" "<contraseña temporal fuerte>"
```

Al entrar por primera vez, active MFA y cambie la contraseña temporal.

## Operación

- Estado: `az vm run-command invoke ... --scripts 'cd /opt/securedocs/repo && docker compose --env-file .env -f infra/compose.yaml -f infra/compose.https.yaml -f infra/compose.azure.yaml ps'`
- Salud: `journalctl -t securedocs-health` (cada 5 min; reinicia la pila tras 3 fallos seguidos).
- Respaldos: diario 03:00 UTC a Blob Storage (`journalctl -t securedocs-backup`).
- Certificado: renovación diaria automática (`securedocs-cert-renew.timer`).
- Parches del sistema: `unattended-upgrades` de Ubuntu.
