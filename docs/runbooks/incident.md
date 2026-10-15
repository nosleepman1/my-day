# Runbook : incident

## 1. Qualifier (≤ 10 min)

| Signal | Première vérification |
|---|---|
| Site indisponible (Uptime Kuma) | `curl -sI https://api.example.com/api/v1/health/ready` ; `docker compose -p orbit-production ps` |
| VPS injoignable (Healthchecks.io) | console OVH : état, redémarrage, réseau |
| Erreurs 5xx (Sentry) | issue Sentry : `requestId` → `docker logs orbit-production-api-1 \| grep <requestId>` |
| Disque ou swap (diskcheck) | `df -h`, `free -m`, `docker system df` |
| Sauvegarde manquante | `journalctl -u orbit-backup -n 100` |
| Suspicion de fuite (secret, accès) | passer directement à la section 3 |

## 2. Rétablir

- Version fautive : `rollback.md`.
- Conteneur arrêté ou tué pour mémoire : `docker compose -p orbit-production up -d --wait` ; si la mémoire manque, arrêter le staging : `docker compose -p orbit-staging stop`.
- Disque plein : `docker image prune -a --filter until=240h`, purge des dumps locaux de plus de 3 jours.
- Base corrompue : ne rien écrire ; `backup-restore.md`.

## 3. Sécurité

1. Révoquer l'accès : clé SSH de la CI (`/home/deploy/.ssh/authorized_keys`), jetons GHCR, clés fournisseurs.
2. **Tout secret exposé est compromis** : rotation immédiate (`secrets-rotation.md`) ; la réécriture d'historique Git ne suffit pas.
3. Sessions : la rotation de `RATE_LIMIT_HMAC_KEY` ne déconnecte personne ; pour forcer la déconnexion de tous, vider la table `sessions` (rôle propriétaire) après décision.
4. Conserver les journaux (`docker logs`, `/var/log/orbit`) avant tout redémarrage.

## 4. Clôturer

Rapport court dans `docs/ops/incidents/<date>.md` : chronologie (UTC), cause, impact (utilisateurs, données), actions, prévention.
