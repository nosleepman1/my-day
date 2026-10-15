# Runbook : revenir à la version précédente

## Décider (≤ 5 min)

Revenir en arrière si : tests de fumée en échec, hausse d'erreurs 5xx dans Sentry, parcours de connexion cassé. En cas de doute sur une **corruption de données**, ne rien redéployer et passer à `incident.md`.

## Front (Vercel) — d'abord

Vercel → projet ORBIT → Deployments → déploiement de production précédent → **Instant Rollback** (quelques secondes, sans rebuild).

## API — ensuite, si nécessaire

```bash
sudo orbit-deploy rollback production
```

Le script redémarre l'image du SHA précédent (`/var/lib/orbit/production/previous_sha`), **sans** migration descendante, puis rejoue les tests de fumée. C'est sûr parce que toute migration est rétrocompatible avec la version N−1 (expand/contract).

Pour le staging : `sudo orbit-deploy rollback staging`.

## Si une migration fautive a été appliquée

1. Ne **jamais** modifier une migration déjà appliquée ni lancer de « down ».
2. Écrire une **nouvelle** migration corrective (roll-forward), la tester en staging, la déployer.
3. Dernier recours, sur décision humaine : restaurer `pre-migrate-<sha>.dump` (`backup-restore.md`), en annonçant la perte des écritures postérieures.

## Exercice obligatoire (PHASE-03)

En staging : déployer N, puis `orbit-deploy rollback staging`, vérifier `GET https://api-staging.example.com/api/v1/health/ready` et consigner la durée dans le rapport.
