#!/usr/bin/env bash
set -Eeuo pipefail
set +x

readonly repo=/opt/securedocs/repo
source "$repo/.env"
compose=(docker compose --env-file "$repo/.env" -f "$repo/infra/compose.yaml" -f "$repo/infra/compose.https.yaml" -f "$repo/infra/compose.aws.yaml")

read -r -p 'Admin email: ' admin_email
read -r -p 'Admin display name: ' admin_name
read -r -s -p 'Temporary strong password: ' admin_password
printf '\n'
export ADMIN_EMAIL="$admin_email" ADMIN_NAME="$admin_name" ADMIN_PASSWORD="$admin_password"
unset admin_password
"${compose[@]}" run --rm --no-deps \
  -e ADMIN_EMAIL -e ADMIN_NAME -e ADMIN_PASSWORD \
  --entrypoint /usr/local/bin/securedocs-entrypoint \
  backend node dist/scripts/create-admin.js
unset ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
echo 'Create the account MFA enrollment and then remove the temporary password from your password manager.'
