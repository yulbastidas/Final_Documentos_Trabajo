#!/usr/bin/env bash
# Respaldo diario coherente (MySQL + documentos cifrados) hacia Azure Blob Storage.
# Equivalente a infra/aws/securedocs-backup.sh. Las claves de cifrado NO se respaldan aquí:
# permanecen en Key Vault y en custodia fuera de línea.
set -Eeuo pipefail
umask 077

readonly repo=/opt/securedocs/repo
source /etc/securedocs/deploy.env
[[ -f "$repo/.env" ]] || { echo 'SecureDocs is not deployed yet; skipping backup.'; exit 0; }
source "$repo/.env"
compose=(docker compose --env-file "$repo/.env" -f "$repo/infra/compose.yaml" -f "$repo/infra/compose.https.yaml" -f "$repo/infra/compose.azure.yaml")
readonly work="$(mktemp -d /var/tmp/securedocs-backup.XXXXXX)"
resume_backend() { "${compose[@]}" up -d backend >/dev/null 2>&1 || true; rm -rf "$work"; }
trap resume_backend EXIT

# Stop API writes so the SQL metadata and encrypted document files match.
"${compose[@]}" stop backend
"${compose[@]}" exec -T mysql sh -c \
  'MYSQL_PWD="$(cat /run/secrets/mysql_root_password)" mysqldump --single-transaction --routines --triggers -u root "$MYSQL_DATABASE"' \
  > "$work/database.sql"
docker run --rm --log-driver=none -v securedocs_document_data:/data:ro \
  --entrypoint tar "$BACKEND_IMAGE" -czf - -C /data . \
  > "$work/documents-encrypted.tar.gz"
(
  cd "$work"
  sha256sum database.sql documents-encrypted.tar.gz > SHA256SUMS
  tar -czf "$work/securedocs-backup.tar.gz" database.sql documents-encrypted.tar.gz SHA256SUMS
)

az login --identity --output none
readonly key="backups/$(date -u +%Y/%m)/securedocs-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
az storage blob upload --auth-mode login --account-name "$BACKUP_ACCOUNT" \
  --container-name "$BACKUP_CONTAINER" --name "$key" \
  --file "$work/securedocs-backup.tar.gz" --only-show-errors --output none
logger -t securedocs-backup "BackupSuccess ${BACKUP_ACCOUNT}/${BACKUP_CONTAINER}/${key}"
echo "Backup uploaded to ${BACKUP_ACCOUNT}/${BACKUP_CONTAINER}/${key}. Encryption keys are stored separately in Key Vault and offline escrow."
