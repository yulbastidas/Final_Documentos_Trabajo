#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly repo=/opt/securedocs/repo
readonly region="$(cat /etc/securedocs/region)"
source /etc/securedocs/deploy.env
source "$repo/.env"
compose=(docker compose --env-file "$repo/.env" -f "$repo/infra/compose.yaml" -f "$repo/infra/compose.https.yaml" -f "$repo/infra/compose.aws.yaml")
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

readonly key="backups/$(date -u +%Y/%m)/securedocs-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
aws s3 cp "$work/securedocs-backup.tar.gz" "s3://${BACKUP_BUCKET}/${key}" \
  --region "$region" --sse AES256 --only-show-errors
aws cloudwatch put-metric-data --region "$region" \
  --namespace SecureDocs/Operations \
  --metric-data 'MetricName=BackupSuccess,Dimensions=[{Name=Project,Value=SecureDocs}],Unit=Count,Value=1'
echo "Backup uploaded to s3://${BACKUP_BUCKET}/${key}. Encryption keys are stored separately in SSM and offline escrow."
