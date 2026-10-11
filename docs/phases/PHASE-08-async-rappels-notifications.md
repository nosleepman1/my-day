# PHASE-08 : Traitements asynchrones, rappels et notifications

- **Statut :** À faire
- **Dépend de :** PHASE-07
- **Accès :** Tous
- **Estimation :** 7 à 9 jours effectifs

## 1. Objectif
Introduire l'infrastructure asynchrone fiable (Redis, BullMQ, worker séparé, outbox transactionnelle) et s'en servir pour prévenir l'utilisateur au bon moment et une seule fois : rappels sur tâches, dettes et échéances récurrentes, notifications in-app, e-mail et push web, préférences par canal et heures silencieuses, et génération planifiée des occurrences récurrentes (tâches et finances).

## 2. Contexte à charger
1. `DECISIONS.md` : ADR-007 point 8 (contexte rejoué dans le worker), ADR-012 (intégralité), ADR-014, ADR-015, ADR-018, ADR-020, ADR-023.
2. `PRODUCT_SCOPE.md` §4 (ligne M07).
3. `ARCHITECTURE.md` : processus API et worker, port `JobQueue`, outbox, flux d'un événement.
4. `DESIGN_PATTERNS.md` : port `JobQueue`, patron outbox et relais, handlers idempotents, rejouer le contexte CLS.
5. `DATA_MODEL.md` : sections `reminders`, `notifications`, `notification_preferences`, `outbox_events`, `push_subscriptions`.
6. `API.md` : routes `/reminders`, `/notifications`.
7. `INFRASTRUCTURE.md` : ajout de Redis et du worker en dev, staging et production ; métriques de files ; alertes.
8. `SECURITY.md` : contenu minimal des notifications, VAPID, payloads de jobs sans secret.
9. `TESTING.md` : tests de jobs (horloge simulée, Redis Testcontainers), idempotence.
10. `docs/progress/PHASE-04-REPORT.md` et `docs/progress/PHASE-06-REPORT.md` : récurrences synchrones à remplacer ou compléter.
11. `PRODUCT_SPEC.md` §4.18 (partie Rappels), §4.19, §7.5, §7.6, Annexe A.4 (déduplication) uniquement.

## 3. Périmètre
### Inclus
**Infrastructure asynchrone**
- Redis (dev : Docker Compose ; staging/production : conteneur dédié non exposé, persistance AOF) ; BullMQ derrière le port **`JobQueue`** (ADR-012) ; files nommées par domaine (`notifications`, `reminders`, `recurrence`, `outbox`, `maintenance`).
- **Worker** (`worker.ts`, même base de code, processus et conteneur distincts) : enregistre les handlers, **rejoue le contexte CLS** `{ userId, requestId/correlationId }` avant tout accès à la base (ADR-007 point 8), arrêt gracieux.
- **Payload de job normalisé** : `{ jobType, version, userId, entityId, correlationId, idempotencyKey }` — jamais de secret ni de donnée sensible ; validé par schéma Zod à l'entrée du handler.
- Politique de reprise : tentatives avec backoff exponentiel, nombre maximal par type, file d'échec conservée ; handlers **idempotents** (clé d'idempotence vérifiée en base).
- **Outbox** (`outbox_events`) : événements critiques écrits **dans la même transaction SQL** que la donnée (ex. transaction validée, dette soldée, occurrence confirmée) ; relais qui publie les événements non traités vers BullMQ (scrutation courte + verrou `SKIP LOCKED` dans `platform/database/raw/`), marquage `published_at`, purge planifiée.
- Jobs planifiés (répétables BullMQ) : scan des rappels dus, génération des occurrences récurrentes, purge des sessions et jetons expirés (remplace le nettoyage à la connexion de PHASE-01), purge de l'outbox et des notifications anciennes, expiration des `export_jobs`.
- Rate limiting (`@nestjs/throttler`) basculé sur le stockage **Redis** (plusieurs instances possibles).
- Observabilité : profondeur des files, jobs échoués, âge du plus vieil événement d'outbox non publié exposés en métriques ; alertes (jobs échoués > seuil, outbox bloquée, Redis indisponible) ; `/health/ready` vérifie Redis ; tableau de bord des files **réservé ADMIN** (route protégée `@Roles('ADMIN')`, métadonnées uniquement, aucun payload utilisateur affiché en clair).

**Rappels**
- `reminders` : cible par **colonnes FK nullables** (ADR-018) — `task_id`, `debt_id`, `recurring_occurrence_id`, `project_id`, `note_id` (liste exacte et `CHECK num_nonnulls(...) = 1` selon `DATA_MODEL.md`) ; `remind_at` (instant UTC), canal(aux) souhaités, statut (`SCHEDULED`, `SENT`, `CANCELLED`, `MISSED`, `FAILED`), tentatives, résultat, **clé de déduplication** unique.
- Rappels **manuels** (l'utilisateur choisit date/heure sur une tâche, une dette, une note…) et **automatiques** dérivés de règles par défaut, désactivables dans les préférences : tâche à échéance (jour J à l'heure de préférence, et en retard), dette/créance à J-3 et en retard, occurrence récurrente à J-`délai de rappel` (champ de PHASE-06).
- Modification de l'échéance d'une tâche ou d'une dette → rappels automatiques recalculés ; élément terminé, soldé, archivé ou annulé → rappels `CANCELLED`.
- **Rappels manqués** après indisponibilité : envoyés si le retard est inférieur à un seuil (24 h par défaut), sinon marqués `MISSED` et regroupés dans un récapitulatif unique (§4.18 du cahier).

**Notifications**
- `notifications` (in-app) : type, titre et corps **minimaux** (pas de montant détaillé ni de contenu de note dans les canaux non sécurisés — §4.19 du cahier), lien vers l'entité, `read_at`, `dedup_key` unique par utilisateur.
- Types de cette phase : tâche échue, tâche du jour, dette/créance à échéance ou en retard, occurrence récurrente à confirmer, événement de sécurité (nouvelle connexion, changement de mot de passe ou d'e-mail, export de données). Les types renouvellement, facture, synchronisation et automatisation sont ajoutés par leurs phases via un **registre de types**.
- **Canaux** : in-app (toujours), e-mail (via `MailPort`, gabarits FR), **push web** (Web Push, clés VAPID en configuration, `push_subscriptions` par appareil, désinscription automatique sur 404/410 du service push). Le service worker de PHASE-02 gère l'affichage et le clic (ouvre l'entité).
- `notification_preferences` : par type × canal (activé/désactivé), **heures silencieuses** (début/fin en heure locale, fuseau de `user_preferences`), heure préférée des rappels quotidiens ; les événements de sécurité ignorent les heures silencieuses pour l'e-mail.
- Pendant les heures silencieuses : notification in-app créée, e-mail et push **différés** à la fin de la plage (pas supprimés).
- Les e-mails de sécurité de PHASE-01 (envoyés de façon synchrone) passent par l'outbox et le worker.

**Génération planifiée des occurrences récurrentes**
- Tâches (PHASE-04) : job quotidien qui garantit l'existence de la prochaine occurrence de chaque série active (la création synchrone à la complétion reste, la clé `(recurrence_series_id, due_date)` évite les doublons).
- Finance (PHASE-06) : job quotidien de matérialisation des occurrences jusqu'à l'horizon, idempotent ; **mode de confirmation `AUTO`** activé : à l'échéance, le worker crée la transaction réelle (même service, même idempotence par occurrence, événement d'outbox, notification « transaction créée automatiquement »), sinon rappel de confirmation pour le mode `MANUAL`.
- Le job s'exécute par utilisateur dans son fuseau (« aujourd'hui » local), avec reprise en cas d'arrêt (rattrapage des jours manqués, sans doublon).

### Exclu (et phase où ces éléments seront traités)
- Rappels d'événements de calendrier → PHASE-09 ; factures en retard → PHASE-10 ; habitudes et objectifs → PHASE-11 ; renouvellements de domaines, serveurs, services → PHASE-12 (registres livrés ici).
- Notifications via intégrations externes (WhatsApp, Telegram…) → PHASE-14 et PHASE-16.
- Alertes de synchronisation et d'automatisation en échec → PHASE-14 et PHASE-15.
- Exports asynchrones volumineux → PHASE-17.

## 4. Modèle de données
Tables créées (noms canoniques, détail dans `DATA_MODEL.md`) : `reminders`, `notifications`, `notification_preferences`, `outbox_events`, `push_subscriptions`.

Points obligatoires :
- `reminders` : FK composites nullables, `CHECK (num_nonnulls(...) = 1)`, `dedup_key` unique par utilisateur, index `(status, remind_at)` pour le scan.
- `notifications` : `dedup_key` unique par utilisateur, index `(user_id, read_at, created_at desc)`.
- `notification_preferences` : une ligne par utilisateur (ou par type selon `DATA_MODEL.md`), créée par défaut de manière idempotente.
- `outbox_events` : `user_id`, `event_type`, `version`, `aggregate_id`, `payload` jsonb **sans secret**, `created_at`, `published_at`, `attempts` ; index partiel sur les non publiés.
- `push_subscriptions` : `endpoint` unique, clés `p256dh` et `auth` (sensibles : jamais loguées), user-agent, `last_used_at`.
- Modification éventuelle : `recurring_transactions.confirmation_mode` accepte `AUTO` (si l'énumération ne le contient pas déjà).

Migration : `0008_async_notifications`.

## 5. API
Voir `API.md`. Tout utilisateur authentifié, données propres uniquement, sauf mention.

| Méthode | Route | Remarque |
|---|---|---|
| GET / POST | `/reminders` | filtres cible, statut, période ; POST : cible unique + `remindAt` + canaux |
| GET / PATCH / DELETE | `/reminders/:id` | DELETE = annulation |
| GET | `/notifications` | curseur, filtre non lues |
| GET | `/notifications/unread-count` | |
| POST | `/notifications/:id/read` | |
| POST | `/notifications/read-all` | |
| GET / PATCH | `/notifications/preferences` | types × canaux, heures silencieuses, heure préférée |
| GET | `/notifications/push/public-key` | clé VAPID publique |
| POST | `/notifications/push-subscriptions` | enregistre l'abonnement de l'appareil |
| DELETE | `/notifications/push-subscriptions/:id` | |
| POST | `/notifications/test` | envoie une notification de test sur les canaux actifs (limitée) |
| GET | `/admin/metrics/queues` | **ADMIN** : profondeur, échecs, outbox (métadonnées seulement) |

## 6. Frontend
| Route / composant | Écran |
|---|---|
| Cloche de l'en-tête (coquille de PHASE-02 activée) | Compteur non lues, panneau des dernières notifications, « tout marquer comme lu » |
| `/notifications` | Liste complète, filtres, lien vers l'entité |
| `/settings/notifications` | Matrice types × canaux, heures silencieuses, heure préférée, activation du push sur cet appareil, notification de test |
| Détails tâche, dette, note, occurrence | Section « Rappels » : ajouter, modifier, annuler |
| Service worker | Réception et affichage du push, clic → ouverture de l'entité |

- Mise à jour du compteur par rafraîchissement périodique léger (pas de WebSocket dans cette phase).
- États obligatoires : permission push refusée par le navigateur, navigateur non compatible (iOS hors PWA installée), aucune notification, rappel passé.

## 7. Règles métier et cas limites
- **Une seule notification par événement et par canal** (Annexe A.4) : `dedup_key` unique + vérification dans le handler ; un job rejoué ne renvoie rien.
- Heures silencieuses qui traversent minuit (22:00 → 07:00) ; changements d'heure (`Europe/Paris`, `America/New_York`) ; fuseau `Africa/Dakar` par défaut.
- Rappel dont la cible a été supprimée, archivée ou appartient à un autre utilisateur → annulé, jamais envoyé.
- Le worker ne lit jamais de données sans contexte `userId` rejoué ; un job sans `userId` valide échoue immédiatement (non réessayé) et est signalé.
- Le contenu des e-mails et push reste minimal : « Une tâche arrive à échéance aujourd'hui » plutôt que le détail ; jamais de montant de solde ni de contenu de note dans le push.
- Confirmation `AUTO` d'une occurrence : respect des règles de découvert de PHASE-05 ; en cas de refus (solde insuffisant), aucune transaction, notification « confirmation automatique impossible » et occurrence laissée à confirmer.
- Redis indisponible : l'API continue de répondre ; les événements restent dans l'outbox et seront publiés au retour de Redis (aucune perte).
- Abonnement push expiré (404/410) → supprimé automatiquement.
- Arrêt du worker pendant plusieurs jours → au redémarrage, rattrapage des occurrences et des rappels selon la politique « manqués ».

## 8. Tests exigés
- **Unitaires :** calcul des rappels automatiques, heures silencieuses (traversée de minuit, changements d'heure), politique de rappels manqués, construction des `dedup_key`, sérialisation et validation des payloads de jobs, choix des canaux.
- **Intégration (Testcontainers PostgreSQL + Redis, horloge simulée) :** écriture outbox atomique avec la donnée (rollback → pas d'événement) ; relais qui publie une seule fois même avec deux relais concurrents ; handler idempotent rejoué ; rappel dû → notification in-app + e-mail (MailPort factice) + push (client Web Push factice) ; heures silencieuses → envoi différé ; génération quotidienne des occurrences idempotente et rattrapage après arrêt ; confirmation `AUTO` avec et sans provision ; purge des sessions expirées ; throttler sur Redis.
- **Isolation :** harnais généré pour toutes les nouvelles routes ; test ciblé : un rappel créé par A sur une tâche de B → 404 ; le worker exécutant un job de A ne lit aucune donnée de B (job forgé avec `entityId` de B et `userId` de A → aucune action) ; `/admin/metrics/queues` refusé à USER.
- **Sécurité :** aucun secret ni contenu sensible dans les payloads de jobs, l'outbox et les logs du worker (test de scan) ; clés d'abonnement push jamais loguées ; tableau ADMIN sans payload utilisateur.
- **Fiabilité :** coupure de Redis pendant l'écriture → reprise sans perte ; arrêt brutal du worker pendant un job → job repris sans doublon.
- **E2E Playwright :** créer une tâche avec rappel dans 1 minute (horloge contrôlée) → notification in-app visible et e-mail reçu dans Mailpit ; activer le push (navigateur Chromium avec permission accordée) → réception ; heures silencieuses actives → pas d'e-mail pendant la plage.

## 9. Découpage en tâches
| Tâche | Intitulé | Dépend de |
|---|---|---|
| T1 | Redis en Docker Compose (dev) ; port `JobQueue` + adaptateur BullMQ ; worker (`worker.ts`) avec rejeu du contexte CLS ; schéma de payload | — |
| T2 | Schéma des 5 tables ; migration `0008_async_notifications` ; revue `database-reviewer` | — |
| T3 | Outbox : écriture transactionnelle, relais `SKIP LOCKED`, purge ; branchement sur les événements finance existants | T1, T2 |
| T4 | Politique de reprise, file d'échec, idempotence des handlers ; throttler sur Redis ; `/health/ready` avec Redis | T1 |
| T5 | Notifications in-app : registre de types, création dédupliquée, endpoints de lecture | T2 |
| T6 | Préférences de notification et heures silencieuses ; différé des envois | T5 |
| T7 | Canal e-mail via worker (gabarits FR) ; migration des e-mails de sécurité de PHASE-01 vers l'outbox | T3, T6 |
| T8 | Canal push web : VAPID, abonnements, envoi, nettoyage 404/410 ; service worker | T6 |
| T9 | Rappels : CRUD, rappels automatiques (tâches, dettes, occurrences), recalcul et annulation, scan planifié, politique « manqués » | T5, T4 |
| T10 | Génération planifiée des occurrences (tâches et finance) par fuseau, rattrapage ; mode `AUTO` | T3, T4 |
| T11 | Purges planifiées (sessions, jetons, outbox, notifications, exports) | T4 |
| T12 | Observabilité : métriques de files, alertes, `/admin/metrics/queues` (ADMIN) ; Redis et worker en staging et production (compose, CD) | T4 |
| T13 | Front : cloche, liste, paramètres de notifications, rappels dans les détails, push | T5–T9 |
| T14 | Tests de fiabilité, isolation ciblée, sécurité, E2E | T13, T10–T12 |
| T15 | Revues ECC, vérification, mise à jour docs (`INFRASTRUCTURE.md`, runbooks), rapport | T14 |

## 10. Agents ECC à mobiliser
- `planner`, `tdd-guide`, `architect` (si un choix de file ou de relais s'écarte d'`ARCHITECTURE.md`).
- `silent-failure-hunter` (**obligatoire** : handlers, relais, envois).
- `security-reviewer` (**obligatoire** : contexte du worker, payloads, contenu des notifications, push, route ADMIN).
- `database-reviewer` (migration, `SKIP LOCKED`, index de scan).
- `typescript-reviewer`, `code-reviewer`, `react-reviewer`, `a11y-architect`.
- `e2e-runner`.

## 11. Definition of Done
- [ ] Worker en processus et conteneur distincts en dev, staging et production ; contexte `userId` rejoué et testé.
- [ ] Outbox atomique, relais sans doublon, aucune perte lors d'une coupure Redis.
- [ ] Rappels envoyés une seule fois par canal, rappels manqués gérés, heures silencieuses respectées.
- [ ] Notifications in-app, e-mail et push web fonctionnelles ; préférences par type et canal.
- [ ] Occurrences récurrentes (tâches et finance) générées par le worker, idempotentes, avec rattrapage ; mode `AUTO` conforme aux règles de découvert.
- [ ] Métriques et alertes de files actives ; runbook d'incident mis à jour (Redis, worker, outbox).
- [ ] Toutes les nouvelles routes couvertes par le harnais d'isolation.
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` cochée.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-08-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`).
