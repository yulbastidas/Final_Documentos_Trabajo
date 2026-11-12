#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly repo=/opt/securedocs/repo
readonly region="$(cat /etc/securedocs/region)"
source /etc/securedocs/deploy.env

commit="${1:-}"
backend_image="${2:-}"
frontend_image="${3:-}"
public_origin="${4:-}"
if [[ ! "$commit" =~ ^[a-f0-9]{40}$ || "$public_origin" != "https://${DOMAIN}" ]]; then
  echo 'SecureDocs deployment arguments are invalid.' >&2
  exit 2
fi
[[ "$backend_image" == "${BACKEND_REPOSITORY}:${commit}" ]]
[[ "$frontend_image" == "${FRONTEND_REPOSITORY}:${commit}" ]]

# Copy this script before changing the checkout that contains it.
script_copy="$(mktemp /tmp/securedocs-deploy.XXXXXX)"
cp "$repo/infra/aws/securedocs-deploy.sh" "$script_copy"
trap 'rm -f "$script_copy"' EXIT
if [[ "${SECUREDOCS_DEPLOY_COPY:-}" != 1 ]]; then
  SECUREDOCS_DEPLOY_COPY=1 bash "$script_copy" "$commit" "$backend_image" "$frontend_image" "$public_origin"
  exit $?
fi

git -C "$repo" fetch --depth=1000 origin main
git -C "$repo" merge-base --is-ancestor "$commit" origin/main || {
  echo 'Refusing a commit that is not reachable from origin/main.' >&2
  exit 2
}
git -C "$repo" checkout --detach "$commit"

cd "$repo"
install -d -m 0700 .secrets infra/tls
install -d -m 0755 .certbot/webroot
for name in mysql-password mysql-root-password document-kek mfa-encryption-key csrf-secret; do
  aws ssm get-parameter --name "/securedocs/prod/${name}" --with-decryption \
    --region "$region" --query Parameter.Value --output text \
    > ".secrets/${name//-/_}"
  chmod 0600 ".secrets/${name//-/_}"
done
if ! aws ssm get-parameter --name /securedocs/prod/document-kek-previous \
  --with-decryption --region "$region" --query Parameter.Value --output text \
  > .secrets/document_kek_previous 2> .secrets/parameter-error; then
  if ! grep -q ParameterNotFound .secrets/parameter-error; then
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
AWS_REGION=${region}
BACKEND_IMAGE=${backend_image}
FRONTEND_IMAGE=${frontend_image}
EOF
chmod 0600 .env

aws ecr get-login-password --region "$region" |
  docker login --username AWS --password-stdin "${BACKEND_REPOSITORY%%/*}"
docker pull "$backend_image"
docker pull "$frontend_image"

# First deployment: Nginx serves only ACME challenges until a certificate exists.
if [[ ! -s infra/tls/fullchain.pem || ! -s infra/tls/privkey.pem ]]; then
  bootstrap_compose=(docker compose --env-file .env -f infra/compose.yaml -f infra/compose.aws.yaml -f infra/compose.acme-bootstrap.yaml)
  "${bootstrap_compose[@]}" pull nginx
  "${bootstrap_compose[@]}" up -d --no-deps nginx
  docker run --rm -v "$PWD/.certbot:/etc/letsencrypt" \
    -v "$PWD/.certbot/webroot:/var/www/certbot" \
    certbot/certbot:v5.10.0 certonly --webroot -w /var/www/certbot --non-interactive \
    --agree-tos --keep-until-expiring --cert-name securedocs \
    --email "$CERTIFICATE_EMAIL" -d "$DOMAIN"
  "${bootstrap_compose[@]}" stop nginx
fi
install -o 101 -g 101 -m 0444 .certbot/live/securedocs/fullchain.pem infra/tls/fullchain.pem
install -o 101 -g 101 -m 0400 .certbot/live/securedocs/privkey.pem infra/tls/privkey.pem

compose=(docker compose --env-file .env -f infra/compose.yaml -f infra/compose.https.yaml -f infra/compose.aws.yaml)
"${compose[@]}" pull mysql nginx
"${compose[@]}" up -d mysql
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d backend frontend nginx

for attempt in {1..30}; do
  if curl --fail --silent --output /dev/null --resolve "${DOMAIN}:443:127.0.0.1" \
    "https://${DOMAIN}/api/v1/health/ready"; then
    echo "SecureDocs ${commit} is healthy."
    exit 0
  fi
  sleep 10
done
echo "SecureDocs readiness failed for ${commit}." >&2
exit 1
