#!/usr/bin/env bash
set -Eeuo pipefail

readonly repo=/opt/securedocs/repo
readonly region="$(cat /etc/securedocs/region)"
source /etc/securedocs/deploy.env

# Avoid false alarms before first deployment or while a certificate is absent.
[[ -s "$repo/.env" && -s "$repo/infra/tls/fullchain.pem" ]] || exit 0

instance_id="$(curl --fail --silent --show-error --max-time 2 \
  -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' \
  http://169.254.169.254/latest/api/token)"
instance_id="$(curl --fail --silent --show-error --max-time 2 \
  -H "X-aws-ec2-metadata-token: ${instance_id}" \
  http://169.254.169.254/latest/meta-data/instance-id)"

if curl --fail --silent --output /dev/null --max-time 8 \
  --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/v1/health/ready"; then
  value=1
  echo 'SecureDocs readiness check passed.'
else
  value=0
  echo 'SecureDocs readiness check failed.' >&2
fi

aws cloudwatch put-metric-data --region "$region" --namespace SecureDocs/Host \
  --metric-data "MetricName=AppReady,Dimensions=[{Name=InstanceId,Value=${instance_id}}],Unit=Count,Value=${value}"
