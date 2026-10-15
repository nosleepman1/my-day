# PHASE-04 : Organisation (idées, tâches, projets, tags, notes)

- **Statut :** Terminée côté code, recette du propriétaire à faire (voir `progress/PHASE-04-REPORT.md`)
- **Dépend de :** PHASE-02, PHASE-03
- **Accès :** Tous
- **Estimation :** 8 à 10 jours effectifs

## 1. Objectif
Rendre ORBIT utilisable **au quotidien** pour l'organisation personnelle : capturer une idée ou une tâche en quelques secondes (y compris hors ligne), planifier ses tâches (Aujourd'hui, En retard, Semaine, Sans échéance), suivre ses projets, écrire des notes reliées aux autres éléments et transformer une idée en projet sans la perdre.

## 2. Contexte à charger
1. `DECISIONS.md` : ADR-007, 010, 011, 012 (pas de job avant PHASE-08), 016 (file hors ligne), 017, 018 (liens explicites), 020, 023.
2. `PRODUCT_SCOPE.md` §4 (ligne M03) et §5.
3. `DATA_MODEL.md` : sections organisation (`ideas`, `projects`, `tasks`, `task_dependencies`, `tags`, tables de liaison de tags, `notes`, `note_links`), conventions de clés composites `(user_id, id)` et de `CHECK num_nonnulls`.
4. `API.md` : conventions CRUD, pagination par curseur, filtres, tri, archivage, routes `/ideas`, `/tasks`, `/projects`, `/notes`, `/tags`.
5. `DESIGN_PATTERNS.md` : module type (contrôleur, service applicatif, domaine, repository), machine à états.
6. `FRONTEND.md` : features, file hors ligne IndexedDB, mutations optimistes, capture rapide.
7. `DESIGN_SYSTEM.md` : listes, Kanban, éditeur de note, états.
8. `SECURITY.md` : rendu sûr du Markdown (contenus non fiables).
9. `TESTING.md` : fabriques, isolation générée, E2E.
10. `PRODUCT_SPEC.md` §4.5, §4.14, §4.15, §4.17 (partie Notes uniquement), §10.2.

## 3. Périmètre
### Inclus
**Idées**
- Champs : titre (obligatoire), description, `captured_at`, source (`MANUAL`, `QUICK_CAPTURE`, `EMAIL`, `WHATSAPP`, `VOICE`, `IMPORT` — seules les deux premières sont produites dans cette phase), statut (`INBOX`, `TO_REVIEW`, `EVALUATED`, `SELECTED`, `IN_PROGRESS`, `REALIZED`, `ABANDONED`), priorité, domaine (texte court), score potentiel facultatif (0–10), décision documentée (texte), `converted_project_id`, archivage.
- Tri par défaut : plus récente d'abord ; filtres statut, priorité, domaine, tag, archivées ; recherche simple par titre (ILIKE + trigram) dans la liste.
- **Conversion idée → projet** : crée un projet (titre, description repris), enregistre le lien idée ↔ projet (colonne `ideas.converted_project_id` et/ou `projects.source_idea_id` selon `DATA_MODEL.md`), passe l'idée à `IN_PROGRESS` ; l'idée est conservée ; opération atomique et idempotente (une idée déjà convertie renvoie le projet existant).
- Suggestion de doublon : à la création, renvoi d'au plus 3 idées similaires (trigram ≥ seuil) **à titre indicatif**, jamais de fusion automatique.

**Projets**
- Champs selon `DATA_MODEL.md` : nom, description, statut (`PLANNED`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`), dates de début et d'échéance, priorité, `source_idea_id`, archivage. `client_id` arrivera en PHASE-10.
- Progression dérivée : tâches terminées / tâches non annulées du projet (non stockée).
- Vue détail : tâches, notes liées, idée d'origine.

**Tâches**
- Champs : titre, description, statut (`TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`), priorité (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), `start_date`, `due_date` (date civile) et `due_time` facultatif, `completed_at`, durée estimée et réelle (minutes), `project_id`, `parent_task_id` (**sous-tâches**, un seul niveau), `recurrence_rule` (sous-ensemble RRULE : quotidien, hebdomadaire avec jours, mensuel par jour du mois, annuel ; intervalle ; fin par date ou nombre), `recurrence_series_id`, `is_automatic` (faux dans cette phase), archivage.
- **Dépendances** (`task_dependencies`) : « A bloque B » ; **interdiction des cycles** (détection par parcours avant insertion, dans la transaction) ; une tâche ne dépend pas d'elle-même ; les deux tâches appartiennent au même utilisateur (clé composite).
- **Vues** calculées dans le fuseau de l'utilisateur (ADR-023) : **Aujourd'hui** (échéance = aujourd'hui, ou début ≤ aujourd'hui et non terminée), **En retard** (échéance < aujourd'hui, statut non terminal — dérivé, ADR-020), **Cette semaine** (échéance dans la semaine ISO courante), **Sans échéance**.
- Vues d'affichage : liste et **Kanban** par statut (glisser-déposer). La vue calendrier arrive en PHASE-09.
- **Récurrence** : à la complétion d'une occurrence, l'occurrence suivante est créée **de manière synchrone** dans la même transaction (nouvelle tâche, même `recurrence_series_id`) ; les anciennes occurrences ne sont jamais modifiées ; arrêt de série possible. La génération planifiée par le worker arrive en PHASE-08 (ADR-012).
- **Historique** : changements de statut et d'échéance écrits dans `audit_logs` (le cahier exige que les changements d'échéance soient auditables), consultables dans le détail de la tâche.

**Tags**
- Tags par utilisateur (nom unique insensible à la casse, couleur) ; liaisons `idea_tags`, `task_tags`, `project_tags`, `note_tags` ; renommage et fusion simple (réaffectation puis suppression), suppression d'un tag retire ses liaisons.

**Notes**
- Champs : titre, contenu Markdown, type (`NOTE`, `MEETING`, `REFERENCE`, `CHECKLIST`), source, épinglage, archivage, tags.
- **`note_links`** (ADR-018) : une ligne par lien, colonnes FK nullables `idea_id`, `task_id`, `project_id` avec `CHECK (num_nonnulls(idea_id, task_id, project_id) = 1)` ; d'autres cibles seront ajoutées par les phases suivantes (nouvelle colonne + mise à jour du CHECK par migration).
- Rendu Markdown **assaini** (pas de HTML brut, liens `rel="noopener noreferrer"`, pas de `javascript:`).

**Capture rapide réelle**
- Le `QuickCaptureSheet` de PHASE-02 active les types **idée**, **tâche** et **note** : titre seul suffisant ; champs avancés repliés (échéance, projet, tags).
- **File hors ligne** (ADR-016) : si le réseau est absent, la capture est stockée en IndexedDB avec un `id` UUIDv7 généré par le client ; rejouée automatiquement au retour du réseau, dans l'ordre ; l'API accepte l'`id` fourni par le client et **renvoie l'élément existant si cet `id` existe déjà pour cet utilisateur** (idempotence par clé primaire) ; badge « en attente de synchronisation » ; erreurs de rejeu affichées et conservées pour correction. **Aucune écriture financière n'emprunte cette file.**

### Exclu (et phase où ces éléments seront traités)
- Rappels de tâches et notifications d'échéance → PHASE-08 (génération planifiée des récurrences aussi).
- Vue calendrier des tâches → PHASE-09.
- Liens notes ↔ documents, événements → PHASE-09 ; ↔ clients, factures → PHASE-10 ; ↔ objectifs → PHASE-11.
- `projects.client_id` → PHASE-10.
- Recherche globale plein texte → PHASE-07 (cette phase ne fait que du filtrage par liste).
- Sources e-mail, WhatsApp, voix → PHASE-14 et PHASE-16.
- Responsable de tâche autre que soi : sans objet (ADR-001, pas d'équipe).

## 4. Modèle de données
Tables créées (noms canoniques, détail dans `DATA_MODEL.md`, section organisation) : `ideas`, `projects`, `tasks`, `task_dependencies`, `tags`, `idea_tags`, `task_tags`, `project_tags`, `note_tags`, `notes`, `note_links`.

Points obligatoires :
- `user_id` sur chaque table ; contrainte d'unicité `(user_id, id)` sur chaque table référencée ; **toutes les FK sont composites** `(user_id, x_id)` (ADR-007 point 4).
- `tasks.parent_task_id` composite, avec `CHECK (parent_task_id <> id)` ; un seul niveau de sous-tâche vérifié dans le service.
- `task_dependencies` : PK `(user_id, blocking_task_id, blocked_task_id)`, `CHECK (blocking_task_id <> blocked_task_id)`.
- `note_links` : `CHECK (num_nonnulls(idea_id, task_id, project_id) = 1)`, index par cible.
- `tags` : unicité `(user_id, lower(name))`.
- Index : `tasks (user_id, status, due_date)`, `tasks (user_id, project_id)`, `ideas (user_id, captured_at desc)`, index trigram sur `ideas.title`.

Migration : `0002_organisation`.

## 5. API
Voir `API.md`. Rôle : tout utilisateur authentifié, données propres uniquement.

| Méthode | Route | Remarque |
|---|---|---|
| GET / POST | `/ideas` | liste filtrée, curseur ; création (accepte `id` client) |
| GET / PATCH / DELETE | `/ideas/:id` | DELETE = archivage |
| POST | `/ideas/:id/restore` | désarchiver |
| POST | `/ideas/:id/convert-to-project` | idempotent |
| GET | `/ideas/:id/similar` | suggestions de doublons |
| GET / POST | `/projects` | |
| GET / PATCH / DELETE | `/projects/:id` | DELETE = archivage |
| POST | `/projects/:id/restore` | |
| GET / POST | `/tasks` | filtres `view=today|overdue|week|no-due`, `projectId`, `status`, `tag`, `parentId` |
| GET / PATCH / DELETE | `/tasks/:id` | |
| POST | `/tasks/:id/complete` | crée l'occurrence suivante si récurrente |
| POST | `/tasks/:id/reopen` | |
| GET | `/tasks/:id/history` | issu de `audit_logs` |
| POST | `/tasks/:id/dependencies` | corps `{ blockingTaskId }` ; 409 `DEPENDENCY_CYCLE` |
| DELETE | `/tasks/:id/dependencies/:blockingTaskId` | |
| POST | `/tasks/:id/recurrence/stop` | |
| GET / POST | `/tags` | |
| PATCH / DELETE | `/tags/:id` | |
| POST | `/tags/:id/merge` | corps `{ targetTagId }` |
| GET / POST | `/notes` | |
| GET / PATCH / DELETE | `/notes/:id` | |
| POST | `/notes/:id/links` | corps `{ ideaId | taskId | projectId }` |
| DELETE | `/notes/:id/links/:linkId` | |

Les tags d'un élément sont fixés via le champ `tagIds` des PATCH/POST.

## 6. Frontend
| Route | Écran |
|---|---|
| `/ideas` | Liste des idées (filtres, statuts, recherche locale, archivées) |
| `/ideas/:id` | Détail : évaluation, décision, score, conversion en projet, notes liées, doublons suggérés |
| `/tasks` | Onglets Aujourd'hui / En retard / Semaine / Sans échéance / Toutes ; bascule liste ↔ Kanban |
| `/tasks/:id` | Détail : sous-tâches, dépendances, récurrence, historique, notes |
| `/projects`, `/projects/:id` | Liste (progression) et détail (tâches, notes, idée d'origine) |
| `/notes`, `/notes/:id` | Liste (épinglées en tête) et éditeur Markdown avec aperçu assaini, liens |
| `/settings/tags` | Gestion des tags (renommer, couleur, fusionner, supprimer) |

- Capture rapide : formulaires idée, tâche, note ; file hors ligne avec indicateur global du nombre d'éléments en attente.
- Barre du bas : **Tâches** ouvre la vue Aujourd'hui.
- États obligatoires sur chaque écran (chargement, vide avec action, erreur, validation, archivé, conflit si `updatedAt` a changé, hors ligne).

## 7. Règles métier et cas limites
- Ajout d'une dépendance qui créerait un cycle (direct ou indirect) → 409 `DEPENDENCY_CYCLE`, rien n'est écrit.
- Une tâche `DONE` conserve son historique ; la rouvrir ne supprime pas l'occurrence suivante déjà créée.
- Complétion d'une tâche récurrente rejouée deux fois (double clic, rejeu hors ligne) → une seule occurrence suivante (verrou ligne + contrôle `recurrence_series_id` + date).
- Calcul des vues avec le fuseau de l'utilisateur ; tests à la frontière de minuit et lors des changements d'heure (`Europe/Paris`, `America/New_York`).
- Une sous-tâche ne peut pas avoir elle-même de sous-tâches ; un parent `DONE` avec des sous-tâches ouvertes : autorisé avec avertissement côté UI (règle à confirmer dans le plan).
- Conversion d'une idée archivée ou `ABANDONED` → 409 ; idée déjà convertie → renvoie le projet existant (200).
- `id` client déjà utilisé par **un autre** utilisateur → traité comme inexistant pour B : création refusée par la contrainte, réponse 409 générique sans fuite.
- Lien de note vers un élément d'un autre utilisateur → 404 (FK composite + vérification).
- Markdown : contenu traité comme non fiable (XSS) ; longueur maximale fixée dans les contrats.
- Archivage ≠ suppression : les éléments archivés sortent des vues par défaut ; la suppression définitive n'est pas exposée.

## 8. Tests exigés
- **Unitaires :** machine à états des idées et des tâches, détection de cycle (graphes variés, propriétés fast-check : jamais de cycle après une suite d'ajouts acceptés), calcul des vues par fuseau, calcul de l'occurrence suivante (RRULE, fins de mois, années bissextiles), progression de projet.
- **Intégration :** CRUD de chaque ressource, contraintes PostgreSQL (`CHECK num_nonnulls`, FK composites refusant un lien inter-utilisateurs), conversion atomique et idempotente, complétion récurrente concurrente (deux requêtes simultanées → une occurrence), idempotence par `id` client, fusion de tags.
- **Isolation :** harnais généré couvrant **toutes** les nouvelles routes ; tests manuels supplémentaires pour les liens (`note_links`, dépendances, `parentTaskId`, `tagIds`) pointant vers des données de B.
- **Sécurité :** XSS dans le Markdown (scripts, `javascript:`, `onerror`), longueur excessive, injection dans les filtres.
- **E2E Playwright :** capture rapide d'une idée sur mobile → conversion en projet → ajout d'une tâche au projet → complétion ; tâche récurrente quotidienne → compléter → occurrence du lendemain visible ; capture **hors ligne** (contexte offline) → retour en ligne → élément synchronisé une seule fois ; Kanban glisser-déposer ; tentative de cycle de dépendances refusée.

## 9. Découpage en tâches
| Tâche | Intitulé | Dépend de |
|---|---|---|
| T1 | Schéma Prisma des 11 tables, FK composites, CHECK, index ; migration `0002_organisation` ; revue `database-reviewer` | — |
| T2 | Contrats Zod (`packages/contracts`) pour idées, projets, tâches, tags, notes | T1 |
| T3 | Module tags (CRUD, fusion) et mécanique `tagIds` réutilisable | T2 |
| T4 | Module idées (CRUD, statuts, archivage, filtres, `id` client idempotent) | T3 |
| T5 | Module projets (CRUD, statuts, progression dérivée) | T3 |
| T6 | Conversion idée → projet (atomique, idempotente) ; suggestions de doublons (trigram) | T4, T5 |
| T7 | Module tâches : CRUD, statuts, sous-tâches, historique via `audit_logs` | T5 |
| T8 | Vues Aujourd'hui / En retard / Semaine / Sans échéance par fuseau | T7 |
| T9 | Dépendances sans cycle | T7 |
| T10 | Récurrence de tâche (RRULE restreinte, occurrence suivante synchrone, concurrence) | T7 |
| T11 | Module notes et `note_links` ; rendu Markdown assaini (front) | T4, T5, T7 |
| T12 | Front idées et projets (listes, détails, conversion) | T6 |
| T13 | Front tâches (vues, liste, Kanban, détail, dépendances, récurrence) | T8–T10 |
| T14 | Front notes et tags | T11, T3 |
| T15 | Capture rapide réelle (idée, tâche, note) et file hors ligne IndexedDB | T12–T14 |
| T16 | Tests d'isolation complémentaires (liens), sécurité XSS, E2E | T15 |
| T17 | Revues ECC, vérification, mise à jour docs, rapport | T16 |

T3 à T5 peuvent être confiés à des sous-agents en parallèle **après** T1–T2 (schéma et contrats écrits par la coordinatrice).

## 10. Agents ECC à mobiliser
- `tdd-guide` (toutes les tâches de code), `planner` pour le plan initial.
- `database-reviewer` (T1, requêtes de vues et trigram).
- `security-reviewer` (isolation des liens, Markdown, file hors ligne).
- `typescript-reviewer`, `code-reviewer`, `react-reviewer`, `a11y-architect`.
- `e2e-runner` (T16).

## 11. Definition of Done
- [ ] Les 11 tables existent avec FK composites ; aucun lien inter-utilisateurs possible en base.
- [ ] Cycles de dépendances impossibles (prouvé par tests de propriétés).
- [ ] Vues de tâches correctes dans 3 fuseaux.
- [ ] Récurrence sans doublon sous concurrence.
- [ ] Capture rapide idée/tâche/note en ligne et hors ligne, synchronisée une seule fois.
- [ ] Conversion idée → projet idempotente, idée conservée.
- [ ] Toutes les nouvelles routes couvertes par le harnais d'isolation.
- [ ] Recette mobile par le propriétaire (usage réel, jalon J3 de `ROADMAP.md`).
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` cochée.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-04-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`).
