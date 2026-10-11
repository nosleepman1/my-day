# SQL brut (`platform/database/raw/`)

Seul dossier de l'application où `$queryRaw` et `$executeRaw` sont autorisés (ADR-007 point 5, amendé par ADR-028). Le lint ESLint et les tests d'architecture bloquent tout usage ailleurs.

Règles :

- **Toujours** le gabarit étiqueté `` prisma.$queryRaw`...` `` : les valeurs sont liées comme paramètres, jamais concaténées.
- **Jamais** `$queryRawUnsafe`, `$executeRawUnsafe` ni `Prisma.raw` : ils sont interdits partout, y compris ici.
- Toute requête sur une table métier filtre `user_id` en premier prédicat (ADR-007).
- Chaque fichier exporte des fonctions nommées et typées, une par requête, documentées (pourquoi le SQL brut est nécessaire).
- Toute modification de ce dossier est relue par `database-reviewer` et `security-reviewer` (DEVELOPMENT_METHOD.md).
