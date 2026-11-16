#!/usr/bin/env bash
# Comprobación periódica de disponibilidad por HTTPS. Registra el resultado en el journal
# (journalctl -t securedocs-health) y reinicia la pila si falla tres veces seguidas.
set -Eeuo pipefail

readonly repo=/opt/securedocs/repo
readonly state=/var/lib/securedocs-health-failures
source /etc/securedocs/deploy.env

# Avoid false alarms before first deployment or while a certificate is absent.
[[ -s "$repo/.env" && -s "$repo/infra/tls/fullchain.pem" ]] || exit 0

if curl --fail --silent --output /dev/null --max-time 8 \
  --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/v1/health/ready"; then
  rm -f "$state"
  logger -t securedocs-health 'AppReady=1'
  exit 0
fi

failures=$(( $(cat "$state" 2>/dev/null || echo 0) + 1 ))
echo "$failures" > "$state"
logger -p user.err -t securedocs-health "AppReady=0 consecutive_failures=${failures}"
if (( failures >= 3 )); then
  compose=(docker compose --env-file "$repo/.env" -f "$repo/infra/compose.yaml" -f "$repo/infra/compose.https.yaml" -f "$repo/infra/compose.azure.yaml")
  "${compose[@]}" up -d mysql backend frontend nginx
  rm -f "$state"
  logger -p user.warning -t securedocs-health 'Stack restarted after 3 failed readiness checks.'
fi
exit 1
