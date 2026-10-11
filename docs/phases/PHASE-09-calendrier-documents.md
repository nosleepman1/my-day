# PHASE-09 : Calendrier interne et documents

- **Statut :** À faire
- **Dépend de :** PHASE-04, PHASE-05, PHASE-06, PHASE-07, PHASE-08
- **Accès :** Tous
- **Estimation :** 6 à 8 jours effectifs

## 1. Objectif
Donner à chaque utilisateur un calendrier interne fiable (fuseaux horaires, changements d'heure, rappels) et un espace de documents privés, stockés hors base, servis uniquement par URL signée et rattachables à n'importe quelle entité métier existante.

## 2. Contexte à charger
1. `AGENTS.md`, `DECISIONS.md` (ADR-007, ADR-011, ADR-013, ADR-017, ADR-018, ADR-023), `PRODUCT_SCOPE.md` §4 (M08).
2. `docs/progress/PHASE-08-REPORT.md`.
3. `DATA_MODEL.md` : sections `calendar_events`, `documents`, `document_links`, `reminders` (colonnes de cible existantes).
4. `API.md` : conventions générales, pagination, upload multipart, erreurs.
5. `SECURITY.md` : sections upload de fichiers, URL signées, en-têtes HTTP.
6. `ARCHITECTURE.md` : ports et adaptateurs (`StoragePort`, `JobQueue`).
7. `FRONTEND.md` et `DESIGN_SYSTEM.md` : vues calendrier, listes, téléversement, états obligatoires.
8. `TESTING.md` : isolation entre utilisateurs, fuseaux forcés, Testcontainers.
9. `PRODUCT_SPEC.md` §4.17 (Documents, Exigences) et §4.18 (Événements, Exigences), pour mémoire.

## 3. Périmètre
### Inclus
- **Événements internes** : CRUD, journée entière ou horaire, fuseau IANA de l'événement, lieu, description, statut (`CONFIRMED`, `CANCELLED`), récurrence simple (sous-ensemble RFC 5545 : `FREQ` DAILY/WEEKLY/MONTHLY/YEARLY, `INTERVAL`, `BYDAY`, `COUNT` ou `UNTIL`) avec exceptions de dates.
- **Vue agenda agrégée** (lecture seule) : événements + tâches à échéance + échéances de dettes + occurrences récurrentes prévues (PHASE-06). Les phases 10 et 12 y ajouteront factures et renouvellements.
- **Rappels d'événements** : extension de `reminders` (PHASE-08) avec la cible `calendar_event_id` ; décalages configurables (ex. 10 min, 1 h, 1 jour).
- **Documents** : téléversement (≤ 10 Mo), vérification par magic bytes, liste blanche MIME, nom normalisé, SHA-256, stockage via `StoragePort`, téléchargement par URL signée ≤ 5 min, analyse antivirus asynchrone si disponible, corbeille et purge.
- **`document_links`** : rattachement d'un document à une note, une tâche, un projet, une idée, une transaction, une dette, un événement.
- Extension du **dashboard** (widget « Aujourd'hui / 7 prochains jours »), de la **recherche** (événements, documents par nom) et de l'**export** (événements en JSON/ICS, métadonnées de documents en JSON).

### Exclu (et phase où ces éléments seront traités)
- Synchronisation Google Calendar : PHASE-14 (`external_calendar_events`).
- Rattachement aux clients, contrats, factures : PHASE-10 ; aux objectifs, apprentissage : PHASE-11 ; aux ressources Dev : PHASE-12 (ajout de colonnes cibles à `document_links`).
- Extraction d'échéances depuis un document par IA : PHASE-16.
- Quotas de stockage par plan : PHASE-17 (`usage_counters`). Ici, plafond simple par variable d'environnement.
- Prévisualisation en ligne des documents (rendu dans la page) : non prévue ; téléchargement uniquement.
- Invitations, participants, partage : hors produit (ADR-001).

## 4. Modèle de données
Migration : `phase09_calendar_documents`. Détail des colonnes et contraintes : `DATA_MODEL.md`, sections correspondantes.

| Table | Action | Points clés |
|---|---|---|
| `calendar_events` | création | `user_id`, `title`, `description`, `is_all_day`, `start_at`/`end_at` (`timestamptz`, horaires), `start_date`/`end_date` (`date`, journée entière), `timezone` (IANA, défaut = fuseau de l'utilisateur), `location`, `status`, `recurrence_rule` (texte nullable), `recurrence_exceptions` (`date[]`), `source` (`INTERNAL` ; `GOOGLE` réservé à PHASE-14), timestamps, `deleted_at`. `CHECK` : soit (`is_all_day` et dates civiles non nulles), soit (horaires non nuls) ; `end >= start`. Index `(user_id, start_at)`, `(user_id, start_date)`. |
| `documents` | création | `user_id`, `original_name` (affichage), `normalized_name`, `mime_type` (détecté), `size_bytes` (`CHECK > 0 AND <= 10485760`), `storage_key` (unique), `checksum_sha256`, `scan_status` (`PENDING`, `CLEAN`, `INFECTED`, `SKIPPED`), `uploaded_at`, `deleted_at`, `purge_after`. Index `(user_id, deleted_at)`, index trigramme sur `normalized_name`. |
| `document_links` | création | `user_id`, `document_id`, une colonne FK nullable par cible : `note_id`, `task_id`, `project_id`, `idea_id`, `transaction_id`, `debt_id`, `calendar_event_id`. `CHECK (num_nonnulls(note_id, task_id, project_id, idea_id, transaction_id, debt_id, calendar_event_id) = 1)`. FK composites `(user_id, <cible>)`. Unicité partielle par couple (document, cible). |
| `reminders` | modification | Ajout de `calendar_event_id` nullable (FK composite) et mise à jour du `CHECK num_nonnulls(...) = 1` existant. |

Règles de schéma : UUIDv7 (ADR-011), FK composites `(user_id, id)` (ADR-007), suppression `ON DELETE CASCADE` sur `document_links` uniquement ; un document n'est jamais supprimé en cascade par la suppression d'une entité liée.

## 5. API
Toutes les routes sous `/api/v1`, session requise, scopées par `user_id` (aucun identifiant d'utilisateur dans l'URL). Format : `API.md`.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/calendar/events?from&to` | Tous | Événements du créneau, occurrences récurrentes **développées** côté serveur (fenêtre max 366 jours). |
| POST | `/calendar/events` | Tous | Création. |
| GET | `/calendar/events/:id` | Tous | Détail (série). |
| PATCH | `/calendar/events/:id` | Tous | Modification ; paramètre `scope=series|occurrence` et `occurrenceDate` pour une occurrence (ajout d'exception + nouvel événement détaché). |
| POST | `/calendar/events/:id/cancel` | Tous | Passage à `CANCELLED` (conservé, visible barré). |
| DELETE | `/calendar/events/:id` | Tous | Suppression logique. |
| GET | `/calendar/agenda?from&to` | Tous | Vue agrégée en lecture (événements, tâches, dettes, occurrences prévues). Chaque élément porte `kind`, `id`, `title`, `startsAt` ou `date`. |
| POST | `/calendar/events/:id/reminders` | Tous | Ajoute un rappel (décalage en minutes). Réutilise le service de rappels de PHASE-08. |
| GET | `/documents?query&linkedTo…` | Tous | Liste paginée, filtres par cible liée. |
| POST | `/documents` | Tous | Téléversement `multipart/form-data` (champ `file`, + `links[]` optionnel). |
| GET | `/documents/:id` | Tous | Métadonnées + liens. |
| PATCH | `/documents/:id` | Tous | Renommage (nom d'affichage seulement). |
| POST | `/documents/:id/download-url` | Tous | Retourne `{ url, expiresAt }`, URL signée ≤ 300 s. Refusé (409 `DOCUMENT_NOT_AVAILABLE`) si `scan_status` ∈ {`PENDING`, `INFECTED`}. |
| POST | `/documents/:id/links` | Tous | Ajoute un rattachement `{ targetType, targetId }` (mappé vers la bonne colonne FK). |
| DELETE | `/documents/:id/links/:linkId` | Tous | Retire un rattachement. |
| DELETE | `/documents/:id` | Tous | Corbeille (suppression logique, `purge_after = now + 30 j`). |
| POST | `/documents/:id/restore` | Tous | Restauration depuis la corbeille. |
| GET | `/storage/local/:token` | Tous (jeton) | **Adaptateur local uniquement** (dev/test) : sert le fichier si le jeton HMAC est valide et non expiré. Désactivé en production. |

## 6. Frontend
- **Routes :** `/calendar` (vues Agenda — défaut mobile —, Semaine, Mois), `/calendar/events/:id`, `/documents`, `/documents/:id`.
- **Composants :** `EventForm` (bascule journée entière, sélecteur de fuseau avec défaut utilisateur, récurrence simple, rappels), `AgendaList` (groupée par jour, dans le fuseau de l'utilisateur, indique le fuseau d'origine s'il diffère), `DocumentUploader` (glisser-déposer + bouton, progression, refus côté client des types et tailles hors liste — le serveur reste l'autorité), `DocumentList`, `LinkedDocumentsPanel` réutilisable, intégré aux fiches note, tâche, projet, idée, transaction, dette et événement.
- **Capture rapide (+)** : ajout de l'action « Événement ».
- **États obligatoires** (`DESIGN_SYSTEM.md`) : chargement (squelettes), vide, erreur avec réessai, hors ligne (lecture du cache, aucune écriture de document hors ligne), document en cours d'analyse, document bloqué (infecté).
- **Accessibilité :** navigation clavier dans la grille Semaine/Mois, annonces ARIA lors du changement de période.

## 7. Règles métier et cas limites
1. **Temps (ADR-023)** : un événement horaire est stocké en UTC avec son fuseau IANA ; l'affichage se fait dans le fuseau de l'utilisateur. Le développement des récurrences se fait **dans le fuseau de l'événement** (une réunion hebdomadaire à 9 h Europe/Paris reste à 9 h locales après le passage à l'heure d'été).
2. Heure inexistante (saut de printemps) : décalage vers l'heure valide suivante ; heure ambiguë (retour d'automne) : première occurrence. Règle documentée et testée.
3. Journée entière : dates civiles, sans conversion de fuseau ; `end_date` inclusive.
4. Récurrence : `COUNT` ≤ 730, fenêtre de développement ≤ 366 jours par requête ; règle invalide → 422 `INVALID_RECURRENCE`.
5. Annulation : un événement annulé ne déclenche plus ses rappels (les rappels `PENDING` passent à `CANCELLED`, sans doublon, via le service de PHASE-08).
6. **Documents — validation (SECURITY.md)** :
   - taille ≤ 10 Mo, contrôlée par Multer (limite de flux) **avant** écriture ;
   - type détecté par **magic bytes** (bibliothèque `file-type`), jamais par l'extension ni par le `Content-Type` du client ;
   - liste blanche : `application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `text/plain`, `text/csv`, DOCX, XLSX, ODT, ODS ; **SVG, HTML, XML, JS, exécutables et archives interdits** (415 `UNSUPPORTED_FILE_TYPE`) ;
   - pour `text/*` (pas de magic bytes) : contrôle UTF-8 valide et absence de balises `<script`, `<html`, `<svg` ;
   - nom normalisé côté serveur (NFKC, suppression des séparateurs de chemin et caractères de contrôle, 120 caractères max) ; la clé de stockage est `users/{userId}/documents/{documentId}`, **jamais dérivée du nom**.
7. **Analyse antivirus** : si `CLAMAV_HOST` est configuré, un job BullMQ analyse le fichier (`PENDING` → `CLEAN` ou `INFECTED`) ; sinon `SKIPPED`. Un document `INFECTED` est mis en quarantaine (non téléchargeable), notification de sécurité.
8. **Téléchargement** : URL signée ≤ 300 s, avec `Content-Disposition: attachment` et `Content-Type` forcé au type détecté, `X-Content-Type-Options: nosniff`. Aucun fichier n'est servi publiquement ni depuis le domaine applicatif en production.
9. **Doublons** : même `checksum_sha256` chez le même utilisateur → avertissement non bloquant (proposition de rattacher l'existant).
10. **Corbeille et purge** : purge définitive (objet + ligne) par job quotidien après 30 jours ; purge idempotente (objet déjà absent = succès).
11. **Rattachement** : la cible doit appartenir à l'utilisateur, sinon **404** (ADR-007) ; supprimer une entité supprime ses liens, jamais le document.
12. **Plafond de stockage** provisoire : `STORAGE_MAX_BYTES_PER_USER` (défaut 1 Gio) → 413 `STORAGE_QUOTA_EXCEEDED`.
13. Audit (`audit_logs`) : téléversement, suppression, restauration, purge, détection infectée. Jamais le contenu du fichier dans les logs.

## 8. Tests exigés
- **Unitaires** : développement de récurrences (DST Europe/Paris et America/New_York forcés, ADR-023), heures inexistantes/ambiguës, journée entière ; normalisation de noms (traversée `../`, Unicode, caractères de contrôle) ; détection MIME (PDF renommé `.png`, SVG renommé `.png`, HTML renommé `.pdf`, polyglotte) ; mapping `targetType` → colonne FK.
- **Intégration (Testcontainers + adaptateur de stockage local)** : contrainte `num_nonnulls = 1` ; FK composites refusant un lien vers l'entité d'un autre utilisateur ; flux complet téléversement → analyse (ClamAV simulé, fichier EICAR) → URL signée → expiration après 300 s (horloge simulée) ; purge idempotente ; rappels d'événement annulés à l'annulation.
- **Isolation entre utilisateurs** : test généré pour **chaque** route (ADR-021) — A ne lit, ne modifie, ne rattache, ne télécharge aucun document/événement de B (404) ; jeton d'URL signée de A inutilisable pour un autre objet.
- **Sécurité** : fichier de 10 Mo + 1 octet rejeté sans écriture disque ; SVG avec script rejeté ; URL signée rejouée après expiration → 403 ; altération du jeton → 403 ; en-têtes `nosniff` et `attachment` présents ; `storage_key` jamais exposée dans les réponses.
- **E2E (Playwright)** : créer un événement récurrent, l'afficher dans l'agenda mobile ; téléverser un PDF depuis une tâche puis le télécharger ; tentative de téléversement d'un SVG refusée avec message clair.
- **Frontend** : tests des composants `EventForm` et `DocumentUploader` (états, erreurs).

## 9. Découpage en tâches
| # | Tâche | Dépend de |
|---|---|---|
| T1 | Migration `calendar_events` + `reminders.calendar_event_id`, schémas Zod dans `packages/contracts`. | — |
| T2 | Moteur de récurrence (bibliothèque `rrule` encapsulée) + tests DST. | T1 |
| T3 | Service et contrôleur événements (CRUD, annulation, occurrence/série). | T1, T2 |
| T4 | Endpoint `/calendar/agenda` agrégé (tâches, dettes, occurrences prévues). | T3 |
| T5 | Rappels d'événements via le service de PHASE-08 ; annulation en cascade des rappels. | T3 |
| T6 | Migration `documents` + `document_links` ; contrats Zod. | — |
| T7 | Pipeline de validation d'upload (Multer limite, magic bytes, liste blanche, normalisation, SHA-256). | T6 |
| T8 | Implémentation `StoragePort` : adaptateur local (jetons HMAC) et adaptateur S3 (R2/B2) avec URL présignées ≤ 300 s. | T6 |
| T9 | Service documents (upload, métadonnées, liens, corbeille, restauration) + audit. | T7, T8 |
| T10 | Jobs : analyse ClamAV (optionnelle) et purge quotidienne. | T9 |
| T11 | Tests d'isolation générés + tests de sécurité upload/URL signée. | T3, T9 |
| T12 | Front : écran calendrier (Agenda/Semaine/Mois) et `EventForm`. | T3, T4 |
| T13 | Front : écran documents, `DocumentUploader`, `LinkedDocumentsPanel` intégré aux fiches existantes. | T9 |
| T14 | Extension dashboard (widget 7 jours), recherche (événements, documents), export (ICS + JSON). | T3, T9 |
| T15 | E2E Playwright + rapport de phase. | T12, T13, T14 |

## 10. Agents ECC à mobiliser
- `tdd-guide` : récurrences, validation d'upload (tests d'abord).
- `database-reviewer` : migration, contraintes `CHECK`, index.
- `security-reviewer` : obligatoire sur T7, T8, T9 (upload, URL signées, stockage).
- `typescript-reviewer` et `code-reviewer` : après chaque tâche.
- `react-reviewer` et `a11y-architect` : écrans calendrier et documents.
- `e2e-runner` : T15.

## 11. Definition of Done
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` respectée.
- [ ] Migration `phase09_calendar_documents` appliquée en local, staging, sans perte.
- [ ] Tests DST passent sous `Africa/Dakar`, `Europe/Paris`, `America/New_York`.
- [ ] Aucun type hors liste blanche accepté ; SVG/HTML refusés ; 10 Mo strict.
- [ ] URL signées ≤ 5 min vérifiées par test ; aucun fichier public.
- [ ] Tests d'isolation générés pour toutes les nouvelles routes et verts en CI.
- [ ] Dashboard, recherche et export étendus et testés.
- [ ] Adaptateur S3 vérifié sur staging (R2 ou B2) avec un bucket privé.
- [ ] `security-reviewer` : aucun constat CRITICAL ou HIGH ouvert.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-09-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`), en précisant : choix de bibliothèque de récurrence, statut de l'antivirus en staging, liste blanche finale, colonnes cibles de `document_links` à étendre par les phases 10, 11 et 12.
