#!/usr/bin/env bash
# Surveillance disque, swap et mémoire des conteneurs (INFRASTRUCTURE.md §10.1, §12.5), toutes les
# 15 minutes (timer orbit-diskcheck) : disque > 80 %, swap > 50 % ou conteneur tué pour mémoire
# ⇒ ping /fail Healthchecks.io (alerte e-mail et Telegram) ; sinon ping de succès (battement du VPS).
set -Eeuo pipefail

# shellcheck disable=SC1091
source /etc/orbit/monitoring.env # HC_DISK_URL
DISK_LIMIT=80
SWAP_LIMIT=50
problems=()

for mount in / /srv; do
  [[ -d "$mount" ]] || continue
  used=$(df --output=pcent "$mount" | tail -1 | tr -dc '0-9')
  ((used > DISK_LIMIT)) && problems+=("disk ${mount} ${used}%")
done

read -r swap_total swap_used < <(free | awk '/^Swap:/ {print $2, $3}')
if ((swap_total > 0)); then
  swap_pct=$((swap_used * 100 / swap_total))
  ((swap_pct > SWAP_LIMIT)) && problems+=("swap ${swap_pct}%")
fi

oom=$(docker events --since 15m --until 0s --filter event=oom --format '{{.Actor.Attributes.name}}' 2>/dev/null | sort -u | tr '\n' ' ')
[[ -n "$oom" ]] && problems+=("oom-killed: ${oom}")

# L'URL de ping est secrète : passée par configuration sur l'entrée standard, jamais en argument (ps).
if ((${#problems[@]} > 0)); then
  curl -fsS -m 10 -o /dev/null -K - <<<"url = \"${HC_DISK_URL}/fail\"
data-binary = \"$(printf '%s; ' "${problems[@]}")\"" || true
  printf 'diskcheck: %s\n' "${problems[@]}" >&2
  exit 1
fi
curl -fsS -m 10 -o /dev/null -K - <<<"url = \"${HC_DISK_URL}\"" || true
