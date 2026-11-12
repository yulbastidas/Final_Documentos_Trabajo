#!/usr/bin/env bash
set -Eeuo pipefail

readonly repo=/opt/securedocs/repo
readonly tls_dir="$repo/infra/tls"
readonly cert_dir="$repo/.certbot/live/securedocs"
source /etc/securedocs/deploy.env

[[ -f "$repo/.env" ]] || exit 0
compose=(docker compose --env-file "$repo/.env" -f "$repo/infra/compose.yaml" -f "$repo/infra/compose.https.yaml" -f "$repo/infra/compose.aws.yaml")
old_mtime=0
[[ -f "$tls_dir/fullchain.pem" ]] && old_mtime="$(stat -c %Y "$tls_dir/fullchain.pem")"

docker run --rm -v "$repo/.certbot:/etc/letsencrypt" \
  -v "$repo/.certbot/webroot:/var/www/certbot" \
  certbot/certbot:v5.10.0 renew --webroot -w /var/www/certbot --quiet
new_mtime=0
[[ -f "$cert_dir/fullchain.pem" ]] && new_mtime="$(stat -c %Y "$cert_dir/fullchain.pem")"
if (( new_mtime > old_mtime )); then
  install -o 101 -g 101 -m 0444 "$cert_dir/fullchain.pem" "$tls_dir/fullchain.pem"
  install -o 101 -g 101 -m 0400 "$cert_dir/privkey.pem" "$tls_dir/privkey.pem"
  "${compose[@]}" exec -T nginx nginx -s reload
fi
