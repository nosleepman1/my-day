# AGENTS.md : règles impératives pour les agents IA d'ORBIT

Ces règles s'appliquent à **tout** agent qui travaille dans ce dépôt (Claude Code, sous-agents ECC, autres IA). Elles ne se négocient pas. En cas de doute, arrête-toi et demande au propriétaire.

## 1. Avant d'écrire la moindre ligne

1. Lis, dans cet ordre :
   - `docs/00-INDEX.md`
   - `docs/DECISIONS.md`
   - `docs/PRODUCT_SCOPE.md`
   - `docs/ROADMAP.md`
   - le dernier `docs/progress/PHASE-XX-REPORT.md`
   - la fiche `docs/phases/PHASE-XX-*.md` de la phase en cours
2. Charge **uniquement** les documents listés dans la section « Contexte à charger » de la fiche. Ne charge jamais tout `PRODUCT_SPEC.md` : lis seulement les sections citées.
3. **Hiérarchie des sources :** `DECISIONS.md` > `PRODUCT_SCOPE.md` > documents thématiques > `PRODUCT_SPEC.md`. Dans le cahier, `workspace_id` se lit `user_id`.
4. Produis un plan de tâches et fais-le valider par le propriétaire **avant** de coder (voir `docs/DEVELOPMENT_METHOD.md`).

## 2. Toujours

- Travailler dans le périmètre de la phase en cours. Ce qui en sort devient une proposition, jamais un ajout silencieux.
- **TDD :** test rouge, puis vert, puis refactorisation. Un commit Conventional Commits par tâche, sur la branche `phase-XX/<slug>`.
- **Isolation :** chaque requête est filtrée par `user_id`. Un accès à la donnée d'un autre utilisateur renvoie **404**. Chaque nouvelle route reçoit son test d'isolation.
- **Argent :** `BIGINT` en unités mineures et `packages/money`. Les montants circulent en chaînes dans l'API. Jamais de `float`, de `Number()` ni de `parseFloat` sur un montant. Le FCFA n'a pas de décimales.
- **Validation :** schémas Zod de `packages/contracts`, côté back comme côté front.
- **Réponses :** `select` explicite. Jamais d'entité Prisma brute dans une réponse.
- **Opérations composées :** une seule transaction SQL, et une `Idempotency-Key` pour les créations sensibles.
- **Suivre les patrons** de `docs/DESIGN_PATTERNS.md` et les conventions de `docs/CODING_STANDARDS.md`.
- **Revue renforcée** par un agent `security-reviewer` pour tout ce qui touche à l'authentification, à l'isolation, à la finance, au coffre et aux intégrations. Un agent `database-reviewer` relit chaque migration.
- **Fin de phase :** rédiger `docs/progress/PHASE-XX-REPORT.md` selon le gabarit de `docs/DEVELOPMENT_METHOD.md`. Ce rapport est la seule mémoire que recevra la session suivante.

## 3. Jamais

- Ajouter un secret réel, un mot de passe, un jeton ou une donnée personnelle réelle dans Git, dans les tests, dans les logs ou dans un prompt.
- Inventer un résultat de test, de build ou de déploiement. Si une étape n'a pas tourné, le dire.
- Modifier une migration déjà appliquée, ou lancer une migration destructive sans accord explicite.
- Laisser deux agents modifier en même temps `prisma/schema/` ou les migrations. Seul l'agent intégrateur de la phase y touche.
- Écrire du SQL brut (`$queryRaw`, `$executeRaw`) ailleurs que dans `apps/api/src/platform/database/raw/`.
- Donner à l'ADMIN un accès aux données privées des autres utilisateurs.
- Ajouter une dépendance sans justifier son utilité et son coût de maintenance dans le rapport de phase.
- Appeler un service payant ou externe, créer un compte, envoyer un vrai message ou un vrai e-mail sans autorisation.
- Prendre une décision d'architecture sans l'enregistrer : chaque nouvelle décision devient une ADR ajoutée à `docs/DECISIONS.md`.

## 4. Contrat de sortie d'une tâche ou d'une phase

Réponds toujours avec :
1. le périmètre traité ;
2. les fichiers créés ou modifiés ;
3. les décisions prises et leurs raisons ;
4. les migrations ;
5. les tests exécutés, avec leur résultat **réel** ;
6. les risques et limites ;
7. ce qui reste à faire ;
8. la confirmation qu'aucun secret réel n'a été ajouté.
