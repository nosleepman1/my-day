# Runbook : rotation des secrets

Fréquences : `INFRASTRUCTURE.md` §7.3. Toujours : nouvelle valeur générée aléatoirement, copie dans le gestionnaire de mots de passe, puis retrait de l'ancienne.

## Secret applicatif lu par l'API (`/etc/orbit/<env>/secrets/*`)

```bash
sudo install -m 0400 /dev/stdin /etc/orbit/production/secrets/<nom>
```

puis `docker compose -p orbit-production up -d --force-recreate api` (lu au démarrage). Vérifier `GET /api/v1/health/ready`.

| Secret | Particularité |
|---|---|
| `rate_limit_hmac_key` | les compteurs anti-abus repartent de zéro ; `login_events.email_hmac` antérieurs ne sont plus rapprochés (accepté) |
| `smtp_password` | créer la nouvelle clé chez Brevo avant de supprimer l'ancienne |
| mots de passe PostgreSQL | `ALTER ROLE orbit_app PASSWORD '…'` (rôle propriétaire), mettre à jour `orbit_app_password` **et** `database_url`, puis recréer `api` |
| `n8n_encryption_key` | **ne pas** tourner sans procédure n8n de re-chiffrement : les identifiants stockés deviendraient illisibles |

## Clé SSH de la CI (6 mois)

Nouvelle paire `orbit-ci`, remplacer la ligne dans `/home/deploy/.ssh/authorized_keys` (même préfixe `command=…`), mettre à jour le secret GitHub `VPS_DEPLOY_SSH_KEY`, lancer un déploiement de staging pour vérifier, puis supprimer l'ancienne clé.

## Mot de passe restic

`restic key add` puis `restic key remove <ancien-id>` ; jamais de simple remplacement du fichier.
