#!/usr/bin/env bash
# Crea la primera cuenta de administrador. Las credenciales llegan por variables de entorno
# (ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD) o, en una sesión interactiva, por teclado.
set -Eeuo pipefail
set +x

readonly repo=/opt/securedocs/repo
source "$repo/.env"
compose=(docker compose --env-file "$repo/.env" -f "$repo/infra/compose.yaml" -f "$repo/infra/compose.https.yaml" -f "$repo/infra/compose.azure.yaml")

if [[ -z "${ADMIN_EMAIL:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
  read -r -p 'Admin email: ' ADMIN_EMAIL
  read -r -p 'Admin display name: ' ADMIN_NAME
  read -r -s -p 'Temporary strong password: ' ADMIN_PASSWORD
  printf '\n'
fi
export ADMIN_EMAIL ADMIN_NAME="${ADMIN_NAME:-Administrador}" ADMIN_PASSWORD
"${compose[@]}" run --rm --no-deps \
  -e ADMIN_EMAIL -e ADMIN_NAME -e ADMIN_PASSWORD \
  --entrypoint /usr/local/bin/securedocs-entrypoint \
  backend node dist/scripts/create-admin.js
unset ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
echo 'Admin created. Enroll MFA on first login and rotate the temporary password.'
