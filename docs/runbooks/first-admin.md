# Runbook : premier ADMIN en production

Le rôle ADMIN ne s'obtient jamais par l'interface (PHASE-01, `create-admin`).

1. Vérifier que `REGISTRATION_MODE=allowlist` et que `REGISTRATION_ALLOWLIST` ne contient que votre adresse (`/etc/orbit/production/compose.env`).
2. S'inscrire sur `https://orbit.example.com/register`, ouvrir le lien reçu par e-mail, se connecter une fois.
3. Sur le VPS, en `admin` :

```bash
docker compose -p orbit-production exec api node dist/cli/cli.js create-admin --email <votre adresse>
```

4. Vérifier : se déconnecter puis se reconnecter ; le menu « Plus » affiche la zone **Dev** et **Admin**. L'opération figure dans `audit_logs`.
5. Transfert ultérieur du rôle : même commande avec `--force` et la nouvelle adresse (un seul ADMIN à la fois).
