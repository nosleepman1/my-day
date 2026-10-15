# Runbook : déployer ORBIT

## Chemin normal (aucune commande manuelle)

1. Merge d'une PR dans `main` → `ci.yml` vert.
2. `deploy.yml` construit `ghcr.io/<owner>/orbit-api:<sha>`, puis lance `orbit-deploy staging <sha>` sur le VPS (migrations, démarrage, tests de fumée). Vercel déploie `main` sur `staging.orbit.example.com`.
3. Vérifiez le staging (parcours de connexion, écran modifié).
4. Dans GitHub Actions, **approuvez** le job « deploy production » : sauvegarde pré-migration, migrations, démarrage, tests de fumée de l'API, puis avance de la branche `production` → Vercel déploie le front, et le job attend que le front serve la nouvelle version.

L'API part toujours **avant** le front : elle doit rester compatible avec le front N−1 (règle expand/contract, `INFRASTRUCTURE.md` §9).

## Ce que fait `orbit-deploy <env> <sha>`

1. Vérifie que l'image existe sur GHCR ; place le dépôt local sur le SHA (Compose, Caddyfile, scripts de la même version).
2. Tire les images.
3. Production : `backup.sh --pre-migrate <sha>` (échec ⇒ arrêt).
4. `docker compose run --rm migrate` (`prisma migrate deploy`) ; échec ⇒ arrêt, l'ancienne version continue de servir.
5. `docker compose up -d --wait`.
6. `smoke.sh <env>` ; échec ⇒ retour automatique au SHA précédent et code de sortie non nul.
7. Journal : `/var/log/orbit/deploys.log`.

## Déploiement manuel (dépannage seulement)

```bash
sudo orbit-deploy staging <sha-complet-40-caractères>
```

Interdits sur staging et production : `prisma migrate dev`, `db push`, `migrate reset`, tout seed ou test.

## Après un déploiement de production

- `tail /var/log/orbit/deploys.log`
- Sentry : aucune nouvelle issue dans les 30 minutes.
- Si quelque chose ne va pas : `rollback.md`.
