#!/bin/bash
# Arranque inicial de la VM (customData). Equivalente al UserData de infra/aws/securedocs.yaml.
# main.bicep sustituye los marcadores __X__ antes de enviarlo a Azure.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get -y upgrade
apt-get install -y ca-certificates curl gnupg git jq tar gzip unattended-upgrades

install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod 0644 /etc/apt/keyrings/docker.asc
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" \
  > /etc/apt/sources.list.d/docker.list
curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /etc/apt/keyrings/microsoft.gpg
chmod 0644 /etc/apt/keyrings/microsoft.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/microsoft.gpg] https://packages.microsoft.com/repos/azure-cli/ noble main" \
  > /etc/apt/sources.list.d/azure-cli.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin azure-cli

# Registros locales con rotación (sustituye al driver awslogs de AWS).
install -d -m 0755 /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true
}
JSON
systemctl enable --now docker
systemctl restart docker
docker compose version

install -d -m 0750 /opt/securedocs /etc/securedocs
git clone --depth 1 https://github.com/yulbastidas/Final_Documentos_Trabajo.git /opt/securedocs/repo
cat > /etc/securedocs/deploy.env <<'ENVVARS'
DOMAIN=__DOMAIN__
CERTIFICATE_EMAIL=__CERTIFICATE_EMAIL__
ACR_NAME=__ACR_NAME__
ACR_LOGIN_SERVER=__ACR_LOGIN_SERVER__
KEY_VAULT_NAME=__KEY_VAULT_NAME__
BACKUP_ACCOUNT=__BACKUP_ACCOUNT__
BACKUP_CONTAINER=backups
ENVVARS
chmod 0640 /etc/securedocs/deploy.env

ln -sf /opt/securedocs/repo/infra/azure/securedocs-deploy.sh /usr/local/sbin/securedocs-deploy
ln -sf /opt/securedocs/repo/infra/azure/securedocs-renew-certificate.sh /usr/local/sbin/securedocs-renew-certificate
ln -sf /opt/securedocs/repo/infra/azure/securedocs-backup.sh /usr/local/sbin/securedocs-backup
ln -sf /opt/securedocs/repo/infra/azure/create-admin.sh /usr/local/sbin/securedocs-create-admin
ln -sf /opt/securedocs/repo/infra/azure/securedocs-health-check.sh /usr/local/sbin/securedocs-health-check

cat > /etc/systemd/system/securedocs-cert-renew.service <<'UNIT'
[Unit]
Description=Renew SecureDocs Let's Encrypt certificate
After=docker.service
[Service]
Type=oneshot
ExecStart=/bin/bash /usr/local/sbin/securedocs-renew-certificate
UNIT
cat > /etc/systemd/system/securedocs-cert-renew.timer <<'UNIT'
[Unit]
Description=Check SecureDocs certificate renewal daily
[Timer]
OnCalendar=daily
RandomizedDelaySec=2h
Persistent=true
[Install]
WantedBy=timers.target
UNIT
cat > /etc/systemd/system/securedocs-backup.service <<'UNIT'
[Unit]
Description=Consistent SecureDocs database and encrypted-document backup
After=docker.service
[Service]
Type=oneshot
ExecStart=/bin/bash /usr/local/sbin/securedocs-backup
UNIT
cat > /etc/systemd/system/securedocs-backup.timer <<'UNIT'
[Unit]
Description=Daily SecureDocs backup
[Timer]
OnCalendar=*-*-* 03:00:00 UTC
RandomizedDelaySec=1h
Persistent=true
[Install]
WantedBy=timers.target
UNIT
cat > /etc/systemd/system/securedocs-health-check.service <<'UNIT'
[Unit]
Description=Check SecureDocs HTTPS readiness
After=docker.service
[Service]
Type=oneshot
ExecStart=/bin/bash /usr/local/sbin/securedocs-health-check
UNIT
cat > /etc/systemd/system/securedocs-health-check.timer <<'UNIT'
[Unit]
Description=Check SecureDocs readiness every 5 minutes
[Timer]
OnBootSec=3min
OnUnitActiveSec=5min
AccuracySec=15s
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now securedocs-cert-renew.timer
systemctl enable --now securedocs-backup.timer
systemctl enable --now securedocs-health-check.timer

chown -R root:root /opt/securedocs
chmod -R go-w /opt/securedocs
touch /etc/securedocs/bootstrap-complete
