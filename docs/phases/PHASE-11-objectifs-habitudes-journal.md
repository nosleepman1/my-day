# PHASE-11 : Objectifs, habitudes, apprentissage et journal

- **Statut :** À faire
- **Dépend de :** PHASE-04, PHASE-07, PHASE-08, PHASE-09
- **Accès :** Tous
- **Estimation :** 5 à 7 jours effectifs

## 1. Objectif
Aider chaque utilisateur à piloter sa progression personnelle : objectifs mesurables reliés à ses projets et tâches, habitudes suivies jour après jour avec indicateurs de régularité, parcours d'apprentissage avec sessions, et journal personnel daté.

## 2. Contexte à charger
1. `AGENTS.md`, `DECISIONS.md` (ADR-007, ADR-011, ADR-016, ADR-018, ADR-023), `PRODUCT_SCOPE.md` §4 (M10).
2. `docs/progress/PHASE-10-REPORT.md` (et `PHASE-09-REPORT.md` pour `document_links`).
3. `DATA_MODEL.md` : sections `goals`, `goal_links`, `habits`, `habit_logs`, `learning_items`, `learning_sessions`, `journal_entries`, `reminders`, `document_links`.
4. `API.md` : conventions, pagination, `PUT` idempotent.
5. `SECURITY.md` : contenu riche non fiable (Markdown, XSS), confidentialité du journal.
6. `FRONTEND.md` (file de capture hors ligne IndexedDB), `DESIGN_SYSTEM.md` (graphiques de progression, calendrier de régularité).
7. `TESTING.md` : fuseaux forcés, isolation.
8. `PRODUCT_SPEC.md` §4.16 et §4.17 (Journal), pour mémoire.

## 3. Périmètre
### Inclus
- **Objectifs** : titre, description, type de période (`WEEK`, `MONTH`, `QUARTER`, `YEAR`, `CUSTOM`), dates, statut, mode de mesure (`MANUAL`, `NUMERIC`, `TASKS`), valeur cible/actuelle et unité, bilan de clôture ; liens vers projets, tâches, habitudes et entrées de journal (`goal_links`).
- **Habitudes** : nom, fréquence (`DAILY`, `WEEKLY_COUNT` avec cible N fois par semaine, `WEEKDAYS` avec jours choisis), date de début, archivage, notes ; enregistrement journalier (fait / non fait / valeur), série courante, meilleure série, taux de régularité sur 7/30/90 jours ; rappel quotidien optionnel.
- **Apprentissage** : compétence ou technologie, niveaux initial/actuel/cible (1 à 5), statut, ressources (liste de liens et titres), prochaines étapes ; sessions (date, durée, notes, exercice/projet) ; preuves de réalisation via `document_links`.
- **Journal** : une entrée par date locale, contenu Markdown, humeur (1 à 5) et énergie (1 à 5) facultatives ; vue des événements et tâches du jour en contexte (dérivée, non stockée).
- Capture hors ligne : entrée de journal et enregistrement d'habitude ajoutés à la file IndexedDB (non financiers, ADR-016).
- Extensions : dashboard (habitudes du jour, objectifs actifs), recherche (objectifs, apprentissage, journal), export (JSON/CSV des quatre sous-modules), agenda (échéances d'objectifs).

### Exclu (et phase où ces éléments seront traités)
- Bilans et résumés générés par IA : PHASE-16 (le journal est **exclu par défaut** du contexte IA).
- Automatisations déclenchées par une série d'habitude : PHASE-15.
- Suivi du temps (`time_entries`) : non retenu dans le périmètre consolidé.
- Partage ou défis entre utilisateurs : hors produit (ADR-001).

## 4. Modèle de données
Migration : `phase11_goals_habits_learning_journal`. Détail : `DATA_MODEL.md`.

| Table | Action | Points clés |
|---|---|---|
| `goals` | création | `user_id`, `title`, `description`, `period_type`, `start_date`, `target_date` (`CHECK >= start_date`), `measure_type`, `target_value` NUMERIC(14,3) nullable, `current_value` NUMERIC(14,3) nullable, `unit`, `status` (`ACTIVE`, `ACHIEVED`, `ABANDONED`, `ARCHIVED`), `review` (bilan), `closed_at`, timestamps. Les objectifs ne contiennent **aucun montant financier** (un objectif d'épargne utilise une unité libre, non relié au registre). |
| `goal_links` | création | `user_id`, `goal_id`, FK nullables `project_id`, `task_id`, `habit_id`, `journal_entry_id` ; `CHECK num_nonnulls(...) = 1` ; unicité par couple. |
| `habits` | création | `user_id`, `name`, `frequency_type`, `weekly_target` (1–7, si `WEEKLY_COUNT`), `weekdays` (`smallint[]` ISO 1–7, si `WEEKDAYS`), `value_unit` nullable, `start_date`, `archived_at`, `notes`, `reminder_time` (`time`, local) nullable, timestamps. |
| `habit_logs` | création | `user_id`, `habit_id`, `log_date` (`date`, locale), `status` (`DONE`, `SKIPPED`, `MISSED`), `value` NUMERIC(12,3) nullable, `note`. Unique `(habit_id, log_date)`. |
| `learning_items` | création | `user_id`, `title`, `skill`, `level_initial`, `level_current`, `level_target` (`CHECK BETWEEN 1 AND 5`), `status` (`PLANNED`, `IN_PROGRESS`, `PAUSED`, `DONE`), `resources` (JSONB validé : liste `{ title, url? }`, 50 max), `next_steps`, `project_id` nullable, timestamps. |
| `learning_sessions` | création | `user_id`, `learning_item_id`, `session_date`, `duration_minutes` (`CHECK BETWEEN 1 AND 1440`), `notes`, `exercise`. |
| `journal_entries` | création | `user_id`, `entry_date` (`date`), `content` (Markdown, 50 000 caractères max), `mood`, `energy` (1–5 nullables), timestamps. Unique `(user_id, entry_date)`. |
| `reminders` | modification | Ajout `habit_id`, `goal_id` + mise à jour du `CHECK num_nonnulls`. |
| `document_links` | modification | Ajout `goal_id`, `learning_item_id`, `journal_entry_id` + mise à jour du `CHECK`. |

## 5. API
Routes sous `/api/v1`, session requise ; renvoi à `API.md`.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET/POST | `/goals` | Tous | Liste (filtres statut, période) / création. |
| GET/PATCH/DELETE | `/goals/:id` | Tous | Détail avec progression calculée / modification / suppression logique. |
| POST | `/goals/:id/close` | Tous | Clôture `{ status: ACHIEVED|ABANDONED, review }`. |
| POST | `/goals/:id/links` | Tous | Lien `{ targetType, targetId }`. |
| DELETE | `/goals/:id/links/:linkId` | Tous | |
| GET/POST | `/habits` | Tous | Liste (avec statut du jour et séries) / création. |
| GET/PATCH/DELETE | `/habits/:id` | Tous | |
| POST | `/habits/:id/archive` | Tous | |
| GET | `/habits/:id/logs?from&to` | Tous | Historique. |
| PUT | `/habits/:id/logs/:date` | Tous | Enregistrement idempotent du jour (upsert). |
| DELETE | `/habits/:id/logs/:date` | Tous | |
| GET | `/habits/:id/stats` | Tous | Série courante, meilleure série, taux 7/30/90 j. |
| GET/POST | `/learning` | Tous | Parcours d'apprentissage. |
| GET/PATCH/DELETE | `/learning/:id` | Tous | |
| GET/POST | `/learning/:id/sessions` | Tous | Sessions ; total de minutes agrégé. |
| PATCH/DELETE | `/learning/:id/sessions/:sessionId` | Tous | |
| GET | `/journal?from&to` | Tous | Entrées (extraits seulement en liste). |
| GET | `/journal/:date` | Tous | Entrée du jour + contexte dérivé (événements, tâches terminées, habitudes). |
| PUT | `/journal/:date` | Tous | Création ou remplacement idempotent. |
| DELETE | `/journal/:date` | Tous | |

## 6. Frontend
- **Routes :** `/goals`, `/goals/:id`, `/habits`, `/habits/:id`, `/learning`, `/learning/:id`, `/journal`, `/journal/:date`. Entrée « Objectifs » du menu Plus regroupant les quatre sous-modules par onglets.
- **Composants :** `GoalProgress` (barre + valeur/unité ; mode tâches = tâches terminées / liées), `HabitCheckRow` (coche en un geste, mobile-first, retour haptique si disponible), `HabitHeatmap` (régularité sur 90 jours, accessible : tableau alternatif pour lecteurs d'écran), `LearningSessionForm` (minuteur optionnel), `JournalEditor` (Markdown avec aperçu assaini), sélecteurs d'humeur/énergie.
- **Capture rapide (+)** : « Entrée de journal » et « Habitude faite ».
- **États obligatoires** : chargement, vide pédagogique, erreur, hors ligne (enregistrement mis en file et marqué « en attente de synchronisation »), conflit de synchronisation (dernière écriture du serveur affichée, choix de l'utilisateur).

## 7. Règles métier et cas limites
1. **Date locale (ADR-023)** : « aujourd'hui » = date dans le fuseau de l'utilisateur ; `log_date` et `entry_date` sont des dates civiles fournies par le client puis **validées** par le serveur : pas de date future au-delà de « aujourd'hui + 1 jour » (tolérance de décalage horaire), pas avant `habits.start_date`.
2. **Série (streak)** : nombre de périodes consécutives réussies se terminant aujourd'hui ou hier (une journée non encore cochée ne casse pas la série avant minuit local). `DAILY` : jours ; `WEEKDAYS` : seulement les jours prévus ; `WEEKLY_COUNT` : semaines ISO atteignant la cible. `SKIPPED` ne casse pas la série et n'y compte pas.
3. **Taux de régularité** = périodes réussies / périodes attendues sur la fenêtre, depuis `start_date` au plus tôt ; division par zéro → `null`.
4. Changement de fréquence : s'applique à partir du jour du changement ; l'historique n'est pas réinterprété (stocker `frequency_changed_at` ou recalcul par segments ; choix documenté dans le rapport).
5. **Progression d'objectif** : `MANUAL` = `current_value / target_value` ; `NUMERIC` = idem, bornée à 100 % pour l'affichage mais valeur réelle conservée ; `TASKS` = tâches liées terminées / tâches liées (non archivées). Objectif sans cible → progression `null`.
6. Un objectif `ACHIEVED` ou `ABANDONED` n'est plus modifiable sauf réouverture explicite (auditée).
7. **Liens** : cibles de l'utilisateur uniquement (sinon 404) ; suppression d'une tâche supprime le lien, pas l'objectif.
8. **Contenu Markdown** (journal, notes de session) : assaini au rendu (pas de HTML brut, liens `rel="noopener noreferrer nofollow"`), traité comme non fiable (SECURITY.md).
9. **Confidentialité du journal** : exclu des exports « partiels » par défaut (case à cocher explicite), exclu du contexte IA par défaut (réglage de PHASE-16), jamais présent dans les notifications ni dans les logs.
10. Ressources d'apprentissage : URL validées (`http`/`https` seulement), jamais récupérées par le serveur (pas d'aperçu de lien).
11. Rappels d'habitude : un rappel quotidien à `reminder_time` local, généré par le planificateur de PHASE-08 de façon idempotente (clé `habit_id + date`), non envoyé si l'habitude est déjà cochée ou archivée.

## 8. Tests exigés
- **Unitaires** : calcul de série et de taux pour les trois fréquences, autour de minuit et des changements d'heure (Europe/Paris, America/New_York), semaine ISO à cheval sur deux années ; progression d'objectif (trois modes, cible absente) ; validation des dates locales.
- **Propriétés (fast-check)** : la série n'est jamais supérieure au nombre de logs `DONE` ; le taux reste dans [0, 1].
- **Intégration** : unicité `(habit_id, log_date)` et `(user_id, entry_date)` ; `PUT` idempotent ; `CHECK num_nonnulls` de `goal_links` ; rappel d'habitude non dupliqué ni envoyé si déjà coché.
- **Isolation entre utilisateurs** : test généré pour chaque route ; lien d'un objectif de A vers une tâche de B → 404 ; lecture du journal de B → 404.
- **Sécurité** : XSS dans le journal (`<img onerror>`, lien `javascript:`) neutralisé au rendu ; journal absent des logs (test de capture des logs).
- **E2E** : créer une habitude, la cocher 3 jours (horloge simulée) et voir la série à 3 ; créer un objectif en mode tâches et voir la progression évoluer ; écrire une entrée de journal hors ligne puis la synchroniser.

## 9. Découpage en tâches
| # | Tâche | Dépend de |
|---|---|---|
| T1 | Migration complète de la phase + contrats Zod. | — |
| T2 | Domaine pur : séries, taux, progression (tests d'abord). | — |
| T3 | Objectifs : service, routes, clôture, liens. | T1, T2 |
| T4 | Habitudes et logs : service, routes, statistiques. | T1, T2 |
| T5 | Rappels d'habitude et d'objectif via le planificateur de PHASE-08. | T4 |
| T6 | Apprentissage : items, sessions, preuves via `document_links`. | T1 |
| T7 | Journal : `PUT` idempotent, contexte du jour dérivé. | T1 |
| T8 | Tests d'isolation générés, tests de sécurité XSS/logs. | T3, T4, T6, T7 |
| T9 | Front : objectifs et habitudes (check-in, heatmap). | T3, T4 |
| T10 | Front : apprentissage et journal, file hors ligne. | T6, T7 |
| T11 | Extensions dashboard, recherche, export, agenda. | T3, T4, T7 |
| T12 | E2E + rapport de phase. | T9, T10, T11 |

## 10. Agents ECC à mobiliser
- `tdd-guide` : T2 (séries et taux).
- `database-reviewer` : migration, contraintes, index.
- `typescript-reviewer`, `code-reviewer` : chaque tâche.
- `react-reviewer`, `a11y-architect` : heatmap et check-in mobile.
- `security-reviewer` : rendu Markdown, confidentialité du journal.
- `e2e-runner` : T12.

## 11. Definition of Done
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` respectée.
- [ ] Séries et taux exacts sous les trois fuseaux de test.
- [ ] Capture hors ligne du journal et des habitudes fonctionnelle et testée.
- [ ] Journal exclu des logs, notifications et exports partiels par défaut.
- [ ] Tests d'isolation verts pour toutes les nouvelles routes.
- [ ] Dashboard, recherche, export et agenda étendus.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-11-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`), en précisant la règle retenue pour les changements de fréquence et le réglage de confidentialité du journal à reprendre en PHASE-16.
