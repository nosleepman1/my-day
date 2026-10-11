# ORBIT : méthode de développement par phases avec IA

- **Statut :** référence. Applique ADR-003 (développement intégral en 18 phases, sans MVP).
- **Responsabilité :** décrire **comment** une phase est conduite, de son démarrage à son merge : rôles, cycle, contexte IA, revues, Definition of Done, rapport de fin de phase, gestion des écarts.
- **Ne couvre pas :** l'ordre des phases (`ROADMAP.md`), le contenu de chaque phase (`phases/PHASE-XX-*.md`), les conventions de code (`CODING_STANDARDS.md`), la stratégie de test détaillée (`TESTING.md`).
- **Documents liés :** `00-INDEX.md`, `DECISIONS.md`, `PRODUCT_SCOPE.md`, `ROADMAP.md`, `TESTING.md`, `CODING_STANDARDS.md`, `SECURITY.md`, `INFRASTRUCTURE.md`, `../AGENTS.md`.

---

## 1. Principe : la documentation est la mémoire

Une IA qui démarre une session ne se souvient de rien. Tout ce qui n'est pas écrit dans `docs/` **n'existe pas** pour elle.

Conséquences pratiques :

1. **Une décision non écrite n'est pas prise.** Toute décision structurante devient une ADR dans `DECISIONS.md` (section 9).
2. **Une phase non rapportée n'est pas terminée.** Le rapport `docs/progress/PHASE-XX-REPORT.md` est la seule passerelle vers la phase suivante.
3. **Le code ne remplace pas la doc, la doc ne remplace pas le code.** Si le code s'écarte de la doc, on corrige l'un ou l'autre dans la même phase, jamais « plus tard ».
4. **Hiérarchie des sources :** `DECISIONS.md` > `PRODUCT_SCOPE.md` > documents techniques (`ARCHITECTURE.md`, `DATA_MODEL.md`, `FINANCE_RULES.md`, `SECURITY.md`…) > `PRODUCT_SPEC.md`. Partout où le cahier dit `workspace_id`, lire `user_id` (ADR-001).
5. **Fiches autoportantes.** Une fiche de phase liste tout ce qu'il faut lire. Si une IA a besoin d'un document non listé, c'est un défaut de la fiche : elle le signale dans son rapport.

---

## 2. Qui fait quoi

| Acteur | Rôle | Ce qu'il fait | Ce qu'il ne fait jamais |
|---|---|---|---|
| **Propriétaire** (Abdou, développeur solo) | Décideur et valideur | Valide le plan de phase ; tranche les ambiguïtés et les écarts ; crée les comptes externes (VPS OVH, Vercel, Sentry, DNS, fournisseur e-mail, Google Cloud…) et saisit les secrets réels ; relit le rapport ; fait la recette manuelle ; merge. | Déléguer la saisie d'un secret réel à l'IA ; merger sans rapport. |
| **IA coordinatrice** (session Claude Code principale) | Chef de chantier de la phase | Lit le contexte ; produit le plan de tâches ; exécute les tâches en TDD ; seule à toucher `prisma/schema.prisma`, aux migrations et aux fichiers de configuration partagés ; lance les agents ECC ; intègre leurs résultats ; exécute la vérification ; rédige le rapport. | Inventer un résultat de test ; appeler un service payant ; écrire un secret réel ; lancer une migration destructive ; terminer sa session en « attendant » un sous-agent. |
| **Sous-agents ECC** | Spécialistes ponctuels | Travaillent sur un périmètre fermé que la coordinatrice leur décrit (revue, tests E2E, résolution de build, implémentation d'un sous-module indépendant). Rendent un résultat au format du contrat de sortie (section 8). | Modifier le schéma Prisma, une migration, `package.json` racine, la CI ou la config sans mandat explicite. |

**Agents ECC de référence :**

| Agent | Quand |
|---|---|
| `planner` | Plan de tâches d'une phase complexe (étape 2 du cycle). |
| `architect` | Choix structurant non couvert par une ADR. |
| `tdd-guide` | Chaque tâche qui produit du code métier. |
| `code-reviewer` | Fin de chaque lot de tâches, et en revue de phase. |
| `typescript-reviewer` | Toute phase (front et back sont en TypeScript). |
| `react-reviewer`, `a11y-architect` | Phases qui touchent `apps/web`. |
| `security-reviewer` | **Obligatoire** dès qu'une phase touche l'auth, les sessions, la finance, le coffre-fort, l'isolation par `user_id`, les uploads, les webhooks, les exports ou l'IA. |
| `database-reviewer` | **Obligatoire** pour toute migration, index, requête SQL brute (`platform/database/raw/`). |
| `e2e-runner` | Parcours Playwright critiques de la phase. |
| `build-error-resolver` | Build ou typecheck cassé. |
| `silent-failure-hunter` | Phases avec jobs, outbox, webhooks, intégrations. |
| `doc-updater` | Mise à jour de la doc touchée par la phase. |

---

## 3. Cycle d'une phase

```
1. Démarrage → 2. Plan validé → 3. Boucle TDD par tâche → 4. Revue ECC
→ 5. Vérification → 6. Rapport → 7. Validation humaine et merge
```

### 3.1 Démarrage

1. Lire, dans cet ordre (`00-INDEX.md` §2) :
   1. `AGENTS.md` (racine du dépôt) ;
   2. `DECISIONS.md` ;
   3. `PRODUCT_SCOPE.md` ;
   4. `ROADMAP.md` ;
   5. le dernier `docs/progress/PHASE-XX-REPORT.md` ;
   6. la fiche de la phase courante.
2. Puis **uniquement** les documents listés dans « Contexte à charger » de la fiche.
3. Vérifier les prérequis :
   - chaque phase listée dans « Dépend de » a un rapport au statut **Terminée** ;
   - les « Reste à faire » bloquants des rapports précédents sont traités ou explicitement reportés ;
   - `main` est vert en CI ;
   - `pnpm install && pnpm lint && pnpm typecheck && pnpm test` passe en local.
4. Créer la branche : `git checkout -b phase-XX/<slug>` (le slug est celui du nom de fichier de la fiche, par exemple `phase-05/finance-coeur`).
5. Passer le statut de la fiche à **En cours**.

Si un prérequis manque : **s'arrêter** et le signaler au propriétaire, sans contourner.

### 3.2 Plan de tâches (avant tout code)

L'IA produit un plan qui reprend la section 9 de la fiche et le précise :

- tâches T1…Tn, **au plus une demi-journée chacune**, ordonnées par dépendance ;
- pour chaque tâche : fichiers touchés, tests écrits d'abord, critère de fin ;
- migrations prévues (noms) ;
- tâches parallélisables (section 5) ;
- questions ouvertes et hypothèses.

Le propriétaire **valide** le plan (ou l'amende). Aucun code n'est écrit avant cette validation. Le plan validé est collé en tête du futur rapport (section « Plan exécuté »).

### 3.3 Boucle par tâche : TDD

Pour chaque tâche T :

1. **RED** : écrire les tests (unitaires, intégration, isolation) qui expriment le critère de fin. Les exécuter : ils **doivent échouer** pour la bonne raison.
2. **GREEN** : écrire le minimum de code pour les faire passer.
3. **REFACTOR** : nettoyer (fonctions < 50 lignes, fichiers < 800 lignes, pas d'imbrication > 4 niveaux, immutabilité), tests toujours verts.
4. Exécuter `pnpm lint && pnpm typecheck` et les tests du module.
5. **Commit** au format Conventional Commits, un commit par tâche (ou plus si la tâche est longue, jamais un commit pour plusieurs tâches) :
   - `feat(finance): add transfer with explicit fx rate`
   - `test(auth): add cross-user isolation tests for sessions`
   - `chore(infra): add mailpit to docker compose`
   - types : `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci` ; portée = module.
   - Identité git du propriétaire ; **pas de trailer `Co-Authored-By`** (préférence du propriétaire).
6. Cocher la tâche dans le plan.

### 3.4 Revue par agents ECC

À la fin de chaque lot cohérent (et au minimum une fois en fin de phase) :

| Revue | Obligatoire si |
|---|---|
| `code-reviewer` | toujours |
| `typescript-reviewer` | toujours |
| `security-reviewer` | auth, sessions, finance, coffre-fort, isolation, uploads, webhooks, exports, IA |
| `database-reviewer` | toute migration ou SQL brut |
| `react-reviewer` + `a11y-architect` | changement dans `apps/web` |

Règles :
- les constats **CRITICAL** et **HIGH** sont corrigés avant la vérification ;
- les **MEDIUM** sont corrigés si possible, sinon listés dans le rapport ;
- les modules sensibles (auth, finance, isolation, coffre-fort) sont revus par un agent **différent** de celui qui a écrit le code (§11.12 du cahier).

### 3.5 Vérification

Commandes (définies en PHASE-00, détaillées dans `TESTING.md` et `INFRASTRUCTURE.md`) :

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test            # unitaires
pnpm test:int        # intégration (Testcontainers)
pnpm test:isolation  # tests d'isolation générés par route
pnpm test:e2e        # Playwright, si la phase touche le front
pnpm test:cov        # seuils : 80 % global, 100 % packages/money et domaine finance
pnpm build
```

La sortie réelle (résumé) de ces commandes est copiée dans le rapport. **Aucun résultat n'est inventé.** Une commande qui n'a pas pu être lancée est déclarée comme telle.

### 3.6 Rapport de fin de phase

L'IA rédige `docs/progress/PHASE-XX-REPORT.md` selon le gabarit de la section 7, met à jour la doc touchée (`DATA_MODEL.md`, `API.md`… si la phase a précisé ou corrigé quelque chose) et passe la fiche au statut **Terminée** (sous réserve de validation).

### 3.7 Validation humaine et merge

1. Le propriétaire lit le rapport et fait une **recette manuelle** des parcours listés dans la fiche (sur mobile et desktop dès PHASE-02, sur staging dès PHASE-03).
2. Il valide ou renvoie des corrections (nouvelles tâches dans la même branche).
3. Merge dans `main` (`--no-ff` pour garder l'historique des commits de tâche), CI verte.
4. À partir de PHASE-03 : déploiement staging automatique, puis production déclenchée manuellement par le propriétaire.

---

## 4. Gestion du contexte de l'IA

1. **Une phase = une ou plusieurs sessions.** Une phase de 8 jours ne tient pas dans une session.
2. **Fin de session = point de reprise écrit.** Avant de fermer une session, l'IA met à jour un rapport **partiel** `docs/progress/PHASE-XX-REPORT.md` (statut « En cours ») : tâches faites, tâche en cours, prochaine tâche, décisions prises, pièges rencontrés.
3. **Reprendre avec le rapport.** Une nouvelle session relit l'ordre de lecture (section 3.1) ; le rapport partiel remplace la mémoire.
4. **`/compact`** quand le contexte dépasse environ 60 % : avant, résumer l'état dans le rapport partiel. Ne jamais compacter au milieu d'une migration ou d'un refactoring multi-fichiers.
5. **Ne jamais charger tout le cahier** (`PRODUCT_SPEC.md`, ~2 500 lignes). Charger seulement les sections citées par la fiche (ex. « §4.10 et §6 »).
6. **Charger des sections, pas des documents entiers**, quand la fiche le précise.
7. **Les sous-agents reçoivent un brief autonome** : chemin des fichiers, extrait des règles applicables, critère de fin. Ils ne relisent pas tout `docs/`.

---

## 5. Parallélisation

Autorisée **uniquement** sur des périmètres indépendants :

| Autorisé en parallèle | Interdit en parallèle |
|---|---|
| Un agent sur `apps/web/src/features/ideas`, un autre sur `apps/web/src/features/tasks` | Deux agents sur `apps/api/prisma/schema.prisma` |
| Revue `security-reviewer` et `database-reviewer` d'un même lot | Deux agents qui créent chacun une migration |
| Tests E2E (`e2e-runner`) pendant l'écriture de la doc | Deux agents sur `package.json`, `pnpm-lock.yaml`, `tsconfig`, CI, `docker-compose*.yml` |
| Implémentation de deux modules sans table commune, **après** que la coordinatrice a écrit leur schéma | Un agent sur un module pendant qu'un autre en modifie les contrats Zod |

Règles :
- la **coordinatrice est seule responsable** du schéma Prisma, des migrations, des contrats partagés (`packages/contracts`) et de la configuration ;
- elle **collecte** les résultats de chaque sous-agent avant de clore sa propre tâche (pas de délégation « tire et oublie ») ;
- elle ne délègue pas une tâche qui tient dans son propre contexte.

---

## 6. Definition of Done générale

Adaptée du §11 du cahier. **Chaque fiche de phase l'inclut.** Une fonctionnalité est terminée si :

- [ ] **Validation backend** : champs et règles métier validés côté API par les schémas Zod de `packages/contracts`.
- [ ] **Isolation** : toute donnée est filtrée par `user_id` (extension Prisma `tenantScope`) ; accès à la donnée d'un autre utilisateur → **404** audité ; un test d'isolation généré existe pour chaque nouvelle route.
- [ ] **Rôles** : les routes ADMIN sont protégées par `@Roles('ADMIN')` et testées en refus pour USER.
- [ ] **Erreurs** : enveloppe d'erreur standard (`API.md`), sans fuite d'information (pas de stack, pas d'existence de compte révélée).
- [ ] **Cas limites** testés (dont ceux listés dans la fiche et, pour la finance, les cas FIN-xx de `FINANCE_RULES.md`).
- [ ] **Idempotence** ou protection anti-doublon des opérations critiques (finance, jobs, webhooks).
- [ ] **UI** : états chargement, vide, succès, erreur réseau, erreur de validation, accès refusé, archivé et, si pertinent, conflit et données périmées (`DESIGN_SYSTEM.md`).
- [ ] **Migrations** ajoutées, nommées, non destructives, revues par `database-reviewer`.
- [ ] **Documentation** mise à jour (`API.md`, `DATA_MODEL.md`… si la phase les a précisés).
- [ ] **Logs** : aucun secret, jeton, mot de passe ni contenu sensible (redaction pino vérifiée par test).
- [ ] **Tests** : verts dans un environnement reproductible (Testcontainers, CI) ; couverture ≥ 80 % global, 100 % sur `packages/money` et le domaine finance.
- [ ] **Effets de bord** sur les autres modules vérifiés (dashboard, recherche, exports, suppression de compte).
- [ ] **Revue** par un agent différent pour les modules sensibles.
- [ ] **Audit** : actions sensibles écrites dans `audit_logs`.
- [ ] **Aucun secret réel** dans le dépôt (`.env.example` seulement).
- [ ] **Lint, format, typecheck, build** verts.
- [ ] **Rapport** `docs/progress/PHASE-XX-REPORT.md` rédigé.

---

## 7. Gabarit du rapport de fin de phase

Fichier : `docs/progress/PHASE-XX-REPORT.md`.

```markdown
# PHASE-XX : <Titre> — rapport

- **Statut :** En cours | Terminée | Terminée avec réserves
- **Branche :** phase-XX/<slug>
- **Période :** <date début> → <date fin> ; <n> sessions IA ; <n> jours effectifs
- **Commit de merge :** <sha> (après merge)

## 1. Résumé
Trois à cinq lignes : ce qui est livré et utilisable.

## 2. Plan exécuté
| Tâche | Intitulé | Statut | Commit(s) |
|---|---|---|---|
| T1 | … | Fait / Reporté / Abandonné | abc1234 |

## 3. Fichiers créés ou modifiés
Liste groupée par app/package (chemins).

## 4. Modèle de données et migrations
- Migrations : `<horodatage>_<nom>` (réversibilité, données touchées).
- Tables créées / modifiées.

## 5. API livrée
| Méthode | Route | Rôle | Testée (int / isolation) |

## 6. Frontend livré
Écrans, routes, états couverts.

## 7. Décisions techniques
Décision, raison, alternative écartée. Renvoi aux ADR ajoutées (ADR-0xx).

## 8. Écarts par rapport à la fiche
Ce qui diffère de la fiche ou des docs de référence, et pourquoi.

## 9. Tests exécutés (sorties réelles)
- `pnpm lint` : …
- `pnpm typecheck` : …
- `pnpm test` : n réussis / n échoués
- `pnpm test:int` : …
- `pnpm test:isolation` : n routes couvertes
- `pnpm test:e2e` : …
- Couverture : global x %, money x %, finance x %
- `pnpm build` : …
Toute commande non exécutée est signalée ici, avec la raison.

## 10. Revues ECC
| Agent | Constats CRITICAL/HIGH | Corrigés | Restants (MEDIUM/LOW) |

## 11. Risques et limitations connus

## 12. Reste à faire
- Bloquant pour la phase suivante : …
- Reporté à PHASE-YY : …

## 13. Recette manuelle à faire par le propriétaire
Parcours à vérifier (mobile + desktop, staging si disponible).

## 14. Point de reprise (si statut En cours)
Dernière tâche terminée, tâche en cours, prochaine action exacte.

## 15. Confirmation sécurité
- [ ] Aucun secret réel ajouté au dépôt.
- [ ] Aucune migration destructive.
- [ ] Aucun service payant ou externe appelé sans accord.
```

---

## 8. Contrat de sortie d'un agent

Repris du §0.3 du cahier. Toute tâche non triviale (coordinatrice ou sous-agent) se termine par un compte rendu contenant :

1. le périmètre traité ;
2. les fichiers créés ou modifiés ;
3. les décisions techniques prises et leurs raisons ;
4. les migrations éventuelles ;
5. les tests exécutés et leurs résultats **réels** ;
6. les risques ou limitations connus ;
7. les tâches restantes ;
8. la confirmation qu'aucun secret réel n'a été ajouté au dépôt.

L'agent n'écrase pas des changements non liés et ne lance aucune migration destructive sans autorisation.

---

## 9. Écarts et nouvelles décisions

| Situation | Action |
|---|---|
| La fiche est ambiguë sur un point **mineur** (nommage interne, découpage de fichier) | L'IA tranche, le note dans « Décisions techniques » du rapport. |
| Le point touche la **sécurité, la finance, la structure des données ou une intégration externe** (§0.1.3 du cahier) | L'IA **s'arrête**, propose une décision argumentée (options, recommandation) et attend la validation du propriétaire. |
| Une doc de référence est fausse ou contredit une autre | L'IA applique la hiérarchie (section 1.4), signale la contradiction, propose la correction ; le propriétaire valide. |
| Décision structurante nouvelle ou qui remplace une ADR | Nouvelle entrée `ADR-0xx` dans `DECISIONS.md` (décision, raison, conséquence). Une ADR existante n'est **jamais** modifiée : on la marque `Remplacée par ADR-0xx`. |
| Fonctionnalité non prévue | Proposée comme décision, jamais ajoutée d'office (§19.15 du cahier). |
| Tâche plus longue que prévu (> 1 jour) | La redécouper ; si la phase dérive de plus de 30 %, prévenir le propriétaire. |

---

## 10. Interdits

1. **Secrets réels** dans le dépôt, les tests, les fixtures, les logs ou les prompts. Seulement des valeurs factices dans `.env.example` et les seeds.
2. **Résultats de tests inventés**, ou déploiement déclaré réussi sans preuve.
3. **Migrations destructives** (DROP, perte de données, réécriture d'une migration appliquée) sans accord écrit du propriétaire. Toujours une nouvelle migration (§0.1.9 du cahier).
4. **Dépendances non justifiées** : toute nouvelle dépendance est justifiée (utilité, maintenance, licence, taille) dans le rapport.
5. **Services payants ou externes** (SaaS, API payantes, envoi de vrais e-mails/SMS/WhatsApp, création de comptes) sans accord du propriétaire. Les intégrations sont développées avec mocks.
6. **Contournement de l'isolation** : `findUnique` sur le seul `id`, `$queryRaw` hors de `platform/database/raw/`, requête sans `user_id`.
7. **Montants en `number`/float** (ADR-008).
8. **Écriture financière hors ligne** (ADR-016).
9. **Opérations destructives** sur un environnement partagé (staging, production) sans demande explicite.
10. **Modifier une ADR** existante.

---

## 11. Prompts types

### 11.1 Démarrer une phase

```text
Tu es l'IA coordinatrice d'ORBIT. Nous démarrons PHASE-XX (<titre>).

1. Lis dans l'ordre : AGENTS.md, docs/DECISIONS.md, docs/PRODUCT_SCOPE.md,
   docs/ROADMAP.md, le dernier docs/progress/PHASE-*-REPORT.md,
   docs/phases/PHASE-XX-<slug>.md, puis UNIQUEMENT les documents de sa
   section « Contexte à charger ».
2. Vérifie les prérequis (phases dont elle dépend terminées, main vert,
   tests locaux verts). S'il en manque un, arrête-toi et dis-le.
3. Crée la branche phase-XX/<slug>.
4. Produis le plan de tâches (T1…Tn, ≤ une demi-journée chacune, tests
   d'abord, migrations prévues, parallélisation possible, questions
   ouvertes). N'écris AUCUN code avant que je valide le plan.

Règles : docs/DEVELOPMENT_METHOD.md (TDD, un commit Conventional Commits
par tâche, sans Co-Authored-By, revues ECC, aucun secret réel, aucun
résultat de test inventé).
```

### 11.2 Reprendre une phase

```text
Nous reprenons PHASE-XX (<titre>), en cours.

1. Lis : AGENTS.md, docs/DECISIONS.md, docs/PRODUCT_SCOPE.md,
   docs/phases/PHASE-XX-<slug>.md et docs/progress/PHASE-XX-REPORT.md
   (rapport partiel, section « Point de reprise »).
2. Charge uniquement les documents nécessaires à la prochaine tâche.
3. Vérifie l'état réel : git status, git log --oneline -15, tests du module.
4. Résume en 5 lignes où nous en sommes, puis reprends à la tâche indiquée
   en TDD. Mets à jour le point de reprise avant chaque fin de session.
```

### 11.3 Lancer une revue

```text
Revue de fin de lot, PHASE-XX, branche phase-XX/<slug>.
Diff : git diff main...HEAD.

Lance en parallèle :
- code-reviewer et typescript-reviewer sur tout le diff ;
- security-reviewer (auth / finance / isolation / exports / webhooks si
  touchés) avec rappel : 404 sur ressource d'un autre user_id, pas de
  secret dans les logs, CSRF (X-Requested-With + Origin), montants en
  chaîne ;
- database-reviewer sur prisma/schema.prisma, les nouvelles migrations et
  platform/database/raw/ ;
- react-reviewer et a11y-architect si apps/web est touché.

Attends tous les résultats, corrige CRITICAL et HIGH, liste MEDIUM/LOW
restants dans le rapport (section « Revues ECC »).
```

### 11.4 Clore une phase

```text
Clôture PHASE-XX. Exécute la vérification complète (DEVELOPMENT_METHOD §3.5),
copie les résumés réels des sorties, coche la DoD de la fiche, rédige
docs/progress/PHASE-XX-REPORT.md selon le gabarit §7, mets à jour la doc
de référence touchée, et liste la recette manuelle que je dois faire.
```
