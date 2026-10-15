#!/usr/bin/env bash
# Durcissement idempotent du VPS ORBIT (INFRASTRUCTURE.md §10), à exécuter par le propriétaire en root
# sur Debian 12 ou Ubuntu 24.04 fraîchement installé, après avoir déposé sa clé SSH publique :
#   ADMIN_SSH_KEY="ssh-ed25519 AAAA… admin@poste" \
#   DEPLOY_STAGING_SSH_KEY="ssh-ed25519 AAAA… orbit-ci-staging" \
#   DEPLOY_PRODUCTION_SSH_KEY="ssh-ed25519 AAAA… orbit-ci-production" bash harden.sh
# Rejouable sans effet de bord. Ne crée aucun secret applicatif (voir docs/runbooks/first-setup.md).
set -Eeuo pipefail

: "${ADMIN_SSH_KEY:?set ADMIN_SSH_KEY to the owner ed25519 public key}"
: "${DEPLOY_STAGING_SSH_KEY:?set DEPLOY_STAGING_SSH_KEY to the staging CI ed25519 public key}"
: "${DEPLOY_PRODUCTION_SSH_KEY:?set DEPLOY_PRODUCTION_SSH_KEY to the production CI ed25519 public key}"
[[ $EUID -eq 0 ]] || { echo "harden.sh must run as root" >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive

step() { printf '\n== %s\n' "$*"; }

step "packages"
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg ufw fail2ban unattended-upgrades chrony auditd \
  restic git jq

step "users: admin (sudo) and deploy (forced command only)"
id admin >/dev/null 2>&1 || adduser --disabled-password --gecos "" admin
usermod -aG sudo admin
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
install -d -m 0700 -o admin -g admin /home/admin/.ssh
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
echo "$ADMIN_SSH_KEY" >/home/admin/.ssh/authorized_keys
# Une clé par environnement, chacune liée à son environnement par la commande forcée (revue PHASE-03, H3).
{
  echo "restrict,command=\"/usr/local/bin/orbit-deploy-wrapper staging\" ${DEPLOY_STAGING_SSH_KEY}"
  echo "restrict,command=\"/usr/local/bin/orbit-deploy-wrapper production\" ${DEPLOY_PRODUCTION_SSH_KEY}"
} >/home/deploy/.ssh/authorized_keys
chown admin:admin /home/admin/.ssh/authorized_keys && chmod 0600 /home/admin/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 0600 /home/deploy/.ssh/authorized_keys
# Le compte deploy ne peut lancer que orbit-deploy, sans mot de passe.
echo 'deploy ALL=(root) NOPASSWD: /usr/local/bin/orbit-deploy' >/etc/sudoers.d/orbit-deploy
chmod 0440 /etc/sudoers.d/orbit-deploy
visudo -cf /etc/sudoers.d/orbit-deploy
# admin n'a pas de mot de passe (connexion par clé seule) : sudo sans mot de passe, sinon le propriétaire
# serait enfermé dehors une fois la connexion root fermée (revue PHASE-03, H4).
echo 'admin ALL=(ALL) NOPASSWD: ALL' >/etc/sudoers.d/orbit-admin
chmod 0440 /etc/sudoers.d/orbit-admin
visudo -cf /etc/sudoers.d/orbit-admin

step "ssh: keys only, no root login"
cat >/etc/ssh/sshd_config.d/10-orbit.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AllowUsers admin deploy
X11Forwarding no
MaxAuthTries 3
EOF
sshd -t
# Le service s'appelle « ssh » sur Debian/Ubuntu récents, « sshd » ailleurs.
if systemctl list-unit-files ssh.service >/dev/null 2>&1; then systemctl reload ssh; else systemctl reload sshd; fi

step "firewall: 22, 80, 443 only"
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

step "automatic security updates, reboot at 04:30 UTC if required"
cat >/etc/apt/apt.conf.d/52orbit-unattended <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
EOF
systemctl enable --now unattended-upgrades

step "fail2ban (sshd)"
cat >/etc/fail2ban/jail.d/orbit.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
EOF
systemctl enable --now fail2ban && systemctl restart fail2ban

step "system: UTC, chrony, 2 GB swap, overcommit for Redis"
timedatectl set-timezone UTC
systemctl enable --now chrony
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
cat >/etc/sysctl.d/90-orbit.conf <<'EOF'
vm.overcommit_memory = 1
vm.swappiness = 10
EOF
sysctl --system >/dev/null

step "docker engine (official repository) with userns-remap and log rotation"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  # shellcheck disable=SC1091 # fourni par la distribution
  . /etc/os-release
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
cat >/etc/docker/daemon.json <<'EOF'
{
  "userns-remap": "default",
  "no-new-privileges": true,
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" }
}
EOF
systemctl restart docker

step "directories: secrets 0700 root, data under /srv/orbit"
for env in production staging; do
  install -d -m 0750 "/etc/orbit/${env}"
  install -d -m 0700 "/etc/orbit/${env}/secrets"
  install -d -m 0750 "/srv/orbit/${env}" "/srv/orbit/backup/${env}" "/var/lib/orbit/${env}"
done
install -d -m 0700 /etc/orbit-kek
install -d -m 0750 /srv/orbit/n8n /srv/orbit/uptime-kuma /var/log/orbit /opt/orbit
# UID remappé du conteneur (userns-remap "default" : premier sous-UID de dockremap + 1000).
remap_base=$(awk -F: '$1=="dockremap"{print $2; exit}' /etc/subuid)
# Volumes montés : propriétaire = UID remappé de l'utilisateur du conteneur (revue PHASE-03, H4).
chown -R "$((remap_base + 1000)):$((remap_base + 1000))" /srv/orbit/n8n     # n8n (node, 1000)
chown -R "${remap_base}:${remap_base}" /srv/orbit/uptime-kuma                # Uptime Kuma (root)
for env in production staging; do
  install -d -m 0700 -o "$((remap_base + 70))" -g "$((remap_base + 70))" "/srv/orbit/${env}/pgdata" # postgres (70)
done
install -m 0755 "$(dirname "$0")/install-secret.sh" /usr/local/sbin/install-secret

step "done"
echo "Next: clone the repository into /opt/orbit/repo (read-only deploy key), install the scripts,"
echo "write /etc/orbit/* files and secrets, then follow docs/runbooks/first-setup.md."
