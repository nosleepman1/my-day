# Runbook : sauvegardes et restauration

Objectifs (ADR-015) : **RPO 24 h**, **RTO 4 h**. Aucune donnée réelle avant une restauration testée et chronométrée.

## Sauvegarde

- Automatique : timer `orbit-backup` à 02:15 UTC (`infra/scripts/backup.sh --env production`), et avant chaque migration de production.
- Contenu : `pg_dump -Fc` vérifié par `pg_restore --list`, volume n8n, configuration non sensible ; envoi chiffré par restic vers Backblaze B2 (fournisseur distinct d'OVH). Les clés maîtres (`/etc/orbit-kek`) sont exclues.
- Supervision : Healthchecks.io alerte si aucun succès depuis 26 h ou si le script signale `/fail`.
- Contrôle manuel : `systemctl list-timers orbit-backup.timer` ; `journalctl -u orbit-backup -n 50`.
- Rétention distante : `restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --keep-yearly 2 --prune`, **depuis votre poste** une fois par mois (la clé du VPS ne peut pas supprimer).

## Restauration (chronomètre lancé)

1. **Décider (≤ 15 min)** : quelle sauvegarde, quelle perte acceptée.
2. **Récupérer le dump** sur une machine avec Docker (VPS jetable, staging ou poste) :

```bash
restic restore latest --tag daily --tag production --target /tmp/restore
```

3. **Restaurer et vérifier** dans une base vierge jetable :

```bash
bash infra/scripts/restore.sh --dump /tmp/restore/srv/orbit/backup/production/db/<fichier>.dump --keep
```

Le script crée les rôles, restaure, vérifie que toutes les migrations sont terminées, compte les lignes par table et affiche la durée.
4. **Vérifier l'application** : démarrer l'API sur cette base (URL `postgresql://orbit_app:…@127.0.0.1:55432/orbit`), `GET /api/v1/health/ready` = 200, connexion d'un compte de test.
5. **Remise en service réelle** (perte totale du VPS) : nouveau VPS (`first-setup.md` étapes 3 à 5), restaurer `/srv/orbit/n8n`, recréer la base par `pg_restore` dans le conteneur `postgres`, puis `orbit-deploy production <sha courant>`.
6. **Clôturer** : consigner dans le rapport de phase (puis chaque mois dans `docs/ops/restore-tests.md`) la date, le dump, la durée par étape et totale, les écarts.

## Répétition locale de PHASE-03 (14 octobre 2026)

Dump de la base de développement (40 Ko, 8 comptes de test E2E) restauré par `restore.sh` dans PostgreSQL 17.6 vierge : 3 migrations terminées, 8 tables vérifiées, **13 s**. Reste à faire sur une vraie sauvegarde de staging après la mise en ligne.
