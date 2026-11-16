#!/usr/bin/env bash
# Despliegue en la VM de Azure. Lo invoca GitHub Actions con `az vm run-command`.
# Equivalente a infra/aws/securedocs-deploy.sh: secretos desde Key Vault e imágenes desde ACR,
# ambos con la identidad administrada de la VM (sin credenciales en disco).
set -Eeuo pipefail
umask 077

readonly repo=/opt/securedocs/repo
source /etc/securedocs/deploy.env

commit="${1:-}"
backend_image="${2:-}"
frontend_image="${3:-}"
nginx_image="${4:-}"
public_origin="${5:-}"
if [[ ! "$commit" =~ ^[a-f0-9]{40}$ || "$public_origin" != "https://${DOMAIN}" ]]; then
  echo 'SecureDocs deployment arguments are invalid.' >&2
  exit 2
fi
[[ "$backend_image" == "${ACR_LOGIN_SERVER}/securedocs-backend:${commit}" ]]
[[ "$frontend_image" == "${ACR_LOGIN_SERVER}/securedocs-frontend:${commit}" ]]
[[ "$nginx_image" == "${ACR_LOGIN_SERVER}/securedocs-nginx:${commit}" ]]

[[ -f /etc/securedocs/bootstrap-complete ]] || {
  echo 'VM bootstrap (cloud-init) has not finished yet.' >&2
  exit 3
}

# Copy this script before changing the checkout that contains it.
if [[ "${SECUREDOCS_DEPLOY_COPY:-}" != 1 ]]; then
  script_copy="$(mktemp /tmp/securedocs-deploy.XXXXXX)"
  cp "$repo/infra/azure/securedocs-deploy.sh" "$script_copy"
  trap 'rm -f "$script_copy"' EXIT
  SECUREDOCS_DEPLOY_COPY=1 bash "$script_copy" "$commit" "$backend_image" "$frontend_image" "$nginx_image" "$public_origin"
  exit $?
fi

git -C "$repo" fetch --depth=1000 origin main
git -C "$repo" merge-base --is-ancestor "$commit" origin/main || {
  echo 'Refusing a commit that is not reachable from origin/main.' >&2
  exit 2
}
git -C "$repo" checkout --detach "$commit"

az login --identity --output none

cd "$repo"
install -d -m 0700 .secrets infra/tls
install -d -m 0755 .certbot/webroot
for name in mysql-password mysql-root-password document-kek mfa-encryption-key csrf-secret; do
  az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$name" \
    --query value --output tsv | tr -d '\r\n' > ".secrets/${name//-/_}"
  [[ -s ".secrets/${name//-/_}" ]] || { echo "Key Vault secret ${name} is empty." >&2; exit 1; }
  chmod 0600 ".secrets/${name//-/_}"
done
if ! az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name document-kek-previous \
  --query value --output tsv 2> .secrets/parameter-error | tr -d '\r\n' > .secrets/document_kek_previous; then
  if ! grep -q SecretNotFound .secrets/parameter-error; then
    cat .secrets/parameter-error >&2
    exit 1
  fi
  : > .secrets/document_kek_previous
fi
rm -f .secrets/parameter-error
chmod 0600 .secrets/document_kek_previous

cat > .env <<EOF
PUBLIC_ORIGIN=${public_origin}
COOKIE_SECURE=true
REGISTRATION_MODE=closed
MYSQL_DATABASE=securedocs
MYSQL_USER=securedocs_app
DOCUMENT_KEK_ID=k1
BACKEND_IMAGE=${backend_image}
FRONTEND_IMAGE=${frontend_image}
NGINX_IMAGE=${nginx_image}
EOF
chmod 0600 .env

az acr login --name "$ACR_NAME" --expose-token --query accessToken --output tsv |
  docker login "$ACR_LOGIN_SERVER" --username 00000000-0000-0000-0000-000000000000 --password-stdin
docker pull "$backend_image"
docker pull "$frontend_image"
docker pull "$nginx_image"

# First deployment: Nginx serves only ACME challenges until a certificate exists.
if [[ ! -s .certbot/live/securedocs/fullchain.pem ]]; then
  bootstrap_compose=(docker compose --env-file .env -f infra/compose.yaml -f infra/compose.azure.yaml -f infra/compose.acme-bootstrap.yaml)
  "${bootstrap_compose[@]}" up -d --no-deps nginx
  docker run --rm -v "$PWD/.certbot:/etc/letsencrypt" \
    -v "$PWD/.certbot/webroot:/var/www/certbot" \
    certbot/certbot:v5.10.0 certonly --webroot -w /var/www/certbot --non-interactive \
    --agree-tos --keep-until-expiring --cert-name securedocs \
    --email "$CERTIFICATE_EMAIL" -d "$DOMAIN"
  "${bootstrap_compose[@]}" stop nginx
  "${bootstrap_compose[@]}" rm -f nginx
fi
install -o 101 -g 101 -m 0444 .certbot/live/securedocs/fullchain.pem infra/tls/fullchain.pem
install -o 101 -g 101 -m 0400 .certbot/live/securedocs/privkey.pem infra/tls/privkey.pem

compose=(docker compose --env-file .env -f infra/compose.yaml -f infra/compose.https.yaml -f infra/compose.azure.yaml)
"${compose[@]}" pull mysql
"${compose[@]}" up -d mysql
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d backend frontend nginx
docker image prune -f --filter 'until=168h' >/dev/null || true

for attempt in {1..30}; do
  if curl --fail --silent --output /dev/null --resolve "${DOMAIN}:443:127.0.0.1" \
    "https://${DOMAIN}/api/v1/health/ready"; then
    echo "SecureDocs ${commit} is healthy."
    exit 0
  fi
  sleep 10
done
echo "SecureDocs readiness failed for ${commit}." >&2
"${compose[@]}" ps >&2 || true
"${compose[@]}" logs --tail 40 backend nginx >&2 || true
exit 1
