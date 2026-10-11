# PHASE-14 : Intégrations (Google, webhooks, clés d'API, n8n)

- **Statut :** À faire
- **Dépend de :** PHASE-04, PHASE-08, PHASE-09, PHASE-13
- **Accès :** Tous (clés d'API : ADMIN)
- **Estimation :** 10 à 12 jours effectifs

## 1. Objectif
Connecter l'espace de chaque utilisateur à Google (Calendar en lecture puis en bidirectionnel, Gmail pour transformer un e-mail en tâche ou note et préparer des brouillons), recevoir des webhooks entrants génériques signés, et permettre à l'ADMIN d'orchestrer des workflows n8n au moyen de clés d'API à portée limitée.

## 2. Contexte à charger
1. `AGENTS.md`, `DECISIONS.md` (ADR-006, ADR-007, ADR-012, ADR-019), `PRODUCT_SCOPE.md` §4 (M13).
2. `docs/progress/PHASE-13-REPORT.md` (module `crypto`).
3. `INTEGRATIONS.md` : **en entier** (OAuth, Google, webhooks, n8n).
4. `DATA_MODEL.md` : sections `integrations`, `integration_tokens`, `external_calendar_events`, `webhook_events`, `api_keys`, `calendar_events`, `outbox_events`.
5. `SECURITY.md` : OAuth (PKCE, `state`), stockage des jetons, webhooks (signature, rejeu), clés d'API, contenu non fiable.
6. `API.md` : authentification par jeton d'API (`Authorization: Bearer`), portées, rate limiting.
7. `INFRASTRUCTURE.md` : URL de rappel par environnement, secrets OAuth, domaine vérifié.
8. `PRODUCT_SPEC.md` §4.21 (Architecture, Google Calendar, Gmail, n8n), §8.1 (pour mémoire).

## 3. Périmètre
### Inclus
- **Cadre d'intégration** : connexion, consentement, état (`CONNECTED`, `ERROR`, `REVOKED`, `DISCONNECTED`), portées accordées, jetons chiffrés, synchronisation, journal d'exécution, révocation.
- **Google OAuth 2.0** : flux « authorization code » avec **PKCE S256** et `state` lié à la session, **autorisation incrémentale** (portées demandées fonctionnalité par fonctionnalité), rafraîchissement des jetons, révocation à la déconnexion.
- **Google Calendar** :
  1. **Lecture** : choix des calendriers, synchronisation initiale puis incrémentale (`syncToken`), notifications push (`events.watch`) avec renouvellement des canaux, réconciliation périodique (toutes les 6 h), gestion des suppressions, des événements récurrents et des fuseaux ;
  2. **Bidirectionnel** (activable ensuite par l'utilisateur) : les événements ORBIT d'un calendrier cible choisi sont créés/modifiés/supprimés chez Google, avec gestion des conflits par `etag`.
- **Gmail** : recherche à la demande (requête saisie par l'utilisateur, aucune lecture globale), aperçu d'un message, conversion en **tâche** ou **note** (avec lien vers le message), création d'un **brouillon** de réponse ; **aucun envoi**.
- **Webhooks entrants génériques** : point de réception signé HMAC par intégration, anti-rejeu, stockage minimal, publication d'un événement interne (consommé par les automatisations en PHASE-15).
- **Clés d'API** (ADMIN) : création, portées, expiration, révocation, dernière utilisation ; authentification `Bearer` pour n8n.
- **n8n** : documentation des workflows de référence versionnés (`infra/n8n/workflows/*.json`, sans identifiants) et identité limitée.
- Extensions : dashboard (état des intégrations, erreurs de synchronisation), agenda (événements Google fusionnés), recherche (événements importés), export (métadonnées d'intégration, jamais de jeton).

### Exclu (et phase où ces éléments seront traités)
- WhatsApp Business Platform : PHASE-16.
- Connexion à ORBIT « avec Google » (SSO) : non retenue (ADR-006).
- Envoi d'e-mails par Gmail : jamais automatique ; l'envoi reste manuel dans Gmail.
- Webhooks sortants arbitraires : non (risque SSRF) ; seul n8n appelle ORBIT.
- Autres fournisseurs (Outlook, etc.) : non prévus.

## 4. Modèle de données
Migration : `phase14_integrations`. Détail : `DATA_MODEL.md`.

| Table | Action | Points clés |
|---|---|---|
| `integrations` | création | `user_id`, `provider` (`GOOGLE`, `GENERIC_WEBHOOK` ; `WHATSAPP` réservé à PHASE-16), `status`, `external_account_id` (e-mail Google), `granted_scopes` (`text[]`), `settings` (JSONB validé : calendriers suivis, calendrier cible, mode bidirectionnel), `last_sync_at`, `last_error_code`, `consecutive_failures`, timestamps. Unique partiel `(user_id, provider, external_account_id) WHERE status <> 'DISCONNECTED'`. |
| `integration_tokens` | création | `user_id`, `integration_id`, `token_type` (`ACCESS`, `REFRESH`, `WEBHOOK_SECRET`), `ciphertext`, `nonce`, `wrapped_dek`, `dek_nonce`, `kek_version`, `format_version` (module `crypto`, usage `INTEGRATIONS`), `expires_at`, timestamps. **Jamais de jeton en clair.** |
| `external_calendar_events` | création | `user_id`, `integration_id`, `external_calendar_id`, `external_event_id`, `ical_uid`, `etag`, `external_updated_at`, `calendar_event_id` (FK composite vers l'événement local), `sync_direction` (`INBOUND`, `OUTBOUND`), `deleted_externally_at`. Unique `(integration_id, external_calendar_id, external_event_id)`. |
| `webhook_events` | création | `user_id`, `integration_id`, `provider`, `delivery_id` (unique par intégration), `received_at`, `signature_valid`, `status` (`ACCEPTED`, `REJECTED`, `PROCESSED`, `FAILED`), `payload` (JSONB ≤ 64 Kio, purgé après 30 j), `payload_sha256`, `error_code`. |
| `api_keys` | création | `user_id` (ADMIN), `name`, `prefix` (8 caractères, affichable), `key_hash` (SHA-256), `scopes` (`text[]`, liste blanche), `expires_at` (≤ 1 an), `last_used_at`, `last_used_ip`, `revoked_at`, timestamps. |
| `calendar_events` | modification | Valeur `source = GOOGLE` activée ; ajout `read_only` (bool) pour les événements importés en mode lecture. |

Les canaux push Google (identifiant, ressource, expiration, empreinte du jeton de canal) sont stockés dans `integrations.settings` : pas de table supplémentaire hors liste canonique.

## 5. API
Routes sous `/api/v1`. Les jetons ne sont **jamais** renvoyés.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/integrations` | Tous | Liste et état. |
| POST | `/integrations/:provider/connect` | Tous | `provider = google` : `{ features: ['calendar.read' \| 'calendar.write' \| 'gmail'] }` → `{ authorizationUrl }` (PKCE, `state`). `provider = generic-webhook` : crée l'intégration et renvoie **une seule fois** le secret HMAC et l'URL. |
| GET | `/integrations/:provider/callback` | Tous (session) | Retour OAuth : vérifie `state` + `code_verifier`, échange le code, chiffre les jetons, redirige vers `/settings/integrations`. |
| POST | `/integrations/:provider/disconnect` | Tous | Révocation chez Google, suppression des jetons, choix `{ keepImportedData: boolean }`. |
| POST | `/integrations/:provider/sync` | Tous | Synchronisation manuelle (job), limitée à 1 / 5 min. |
| PATCH | `/integrations/:id/settings` | Tous | Calendriers suivis, calendrier cible, activation bidirectionnelle. |
| GET | `/integrations/:id/runs` | Tous | Journal des synchronisations (sans contenu). |
| GET | `/integrations/google/gmail/messages?q=` | Tous | Recherche à la demande (20 résultats max : expéditeur, sujet, date, extrait). |
| GET | `/integrations/google/gmail/messages/:messageId` | Tous | Aperçu texte brut assaini. |
| POST | `/integrations/google/gmail/messages/:messageId/convert` | Tous | `{ target: 'task' \| 'note', … }` → entité créée avec `source = GMAIL`. |
| POST | `/integrations/google/gmail/messages/:messageId/draft` | Tous | `{ body }` → brouillon créé dans Gmail ; renvoie le lien. |
| POST | `/webhooks/:provider` | Public signé | `google-calendar` (en-têtes de canal) ; `generic` (en-têtes `X-Orbit-Webhook-Id`, `X-Orbit-Timestamp`, `X-Orbit-Signature`, `X-Orbit-Delivery-Id`). Répond 202 rapidement, traitement en job. |
| GET/POST | `/api-keys` | ADMIN | Liste / création (renvoie la clé complète **une seule fois**). |
| DELETE | `/api-keys/:id` | ADMIN | Révocation immédiate. |

**Authentification par clé d'API** : `Authorization: Bearer orbit_<prefix>_<secret>` ; pas de cookie, donc pas de contrôle CSRF, mais portées vérifiées par un guard `@Scopes(...)`. Portées initiales (liste blanche, `API.md`) : `ideas:write`, `tasks:read`, `tasks:write`, `notes:write`, `calendar:read`, `finance:read`, `transactions:propose`. Routes **interdites** à toute clé : `/me/*`, `/auth/*`, `/api-keys`, `/dev/vault/*`, `/admin/*`, `/integrations/*`.

## 6. Frontend
- **Routes :** `/settings/integrations`, `/settings/integrations/:id`, `/settings/api-keys` (ADMIN), `/inbox/gmail` (recherche et conversion).
- **Composants :** `IntegrationCard` (état, portées accordées en langage clair, dernière synchro, erreur, bouton reconnecter), `ConsentExplainer` (finalité de chaque portée avant redirection), `CalendarPicker`, `SyncLog`, `GmailSearch`, `EmailPreview` (texte brut, liens désactivés par défaut), `ConvertEmailDialog`, `DraftReplyDialog`, `WebhookSecretReveal` (affichage unique), `ApiKeyCreateDialog` (portées à cocher, expiration, affichage unique).
- Agenda : événements Google distingués visuellement ; en mode lecture, non modifiables dans ORBIT.
- **États obligatoires** : non connecté, connexion en cours, connecté, erreur (jeton révoqué → « Reconnecter »), synchronisation en cours, portée manquante (proposer l'autorisation incrémentale).

## 7. Règles métier et cas limites
1. **OAuth** : `state` aléatoire 256 bits stocké côté serveur, lié à la session, valable 10 min, usage unique ; `code_verifier` jamais exposé au navigateur ; refus si l'utilisateur de la session a changé entre l'aller et le retour.
2. **Portées minimales** (`INTEGRATIONS.md`) : Calendar lecture `calendar.readonly` puis `calendar.events` pour le bidirectionnel ; Gmail `gmail.readonly` (recherche/lecture à la demande) et `gmail.compose` (brouillons). Une portée refusée désactive seulement la fonctionnalité correspondante.
3. **Vérification Google** : les portées Gmail sont « restreintes » et les portées Calendar « sensibles » ; au-delà des utilisateurs de test, l'application OAuth doit être vérifiée (et, pour Gmail, faire l'objet d'une évaluation de sécurité tierce). Jusqu'à la vérification, Gmail est derrière un drapeau de fonctionnalité réservé aux comptes de test (bloquant pour l'ouverture publique, PHASE-17).
4. **Jetons** : chiffrés par enveloppe (usage `INTEGRATIONS`) ; rafraîchissement anticipé (5 min avant expiration) sous verrou Redis par intégration ; `invalid_grant` → statut `ERROR`, notification « synchronisation échouée », aucune boucle de retry.
5. **Synchronisation Calendar** : idempotente par `(integration, calendrier, external_event_id)` ; `410 Gone` sur `syncToken` → resynchronisation complète ; occurrences d'événements récurrents traitées comme instances avec leur `recurringEventId` ; événements annulés → `CANCELLED` localement ; fuseaux conservés (ADR-023).
6. **Bidirectionnel** : ORBIT écrit uniquement dans le calendrier cible ; mise à jour avec `If-Match: etag` ; en cas de conflit (412), relecture et règle « la modification la plus récente l'emporte », la version perdante est consignée dans le journal ; prévention des boucles (une modification reçue dont l'`etag` est celui que nous venons d'écrire est ignorée).
7. **Canaux push** : jeton de canal vérifié (`X-Goog-Channel-Token`), renouvelés avant expiration par job ; une notification ne contient pas de données : elle déclenche une synchronisation incrémentale (débouncée 30 s).
8. **Gmail** : contenu traité comme **non fiable** — rendu en texte brut, pièces jointes non téléchargées, aucune URL récupérée par le serveur ; seuls l'identifiant du message, le sujet, l'expéditeur et un extrait (500 caractères) sont stockés dans la tâche/note, le corps complet uniquement si l'utilisateur le demande ; jamais d'envoi.
9. **Webhooks génériques** : URL publiques construites depuis `API_PUBLIC_URL` (`https://api.<domaine>/api/v1/webhooks/...`), jamais l'origine du front ni la réécriture Vercel (ADR-038) ; le retour OAuth (`GOOGLE_REDIRECT_URI`) reste en revanche sur l'origine du front, car il exige le cookie de session. Signature `HMAC-SHA256(secret, timestamp + "." + corps brut)` comparée en temps constant ; horodatage à ±5 min ; `delivery_id` unique (rejeu → 200 sans retraitement) ; corps ≤ 256 Kio ; 60 requêtes/min par intégration ; payload validé comme JSON, jamais exécuté ; le `userId` provient de l'intégration, jamais du corps.
10. **Clés d'API** : 256 bits d'entropie, stockage du seul hachage, comparaison en temps constant ; expiration obligatoire ; révocation immédiate (cache ≤ 60 s) ; 120 requêtes/min par clé ; chaque appel audité de façon agrégée (`last_used_at`) et chaque écriture dans `audit_logs` avec `actor = api_key:<prefix>`.
11. **n8n** (instance du VPS installée en PHASE-03, ADR-038) : appelle seulement l'API métier, directement sur `https://api.<domaine>` (`API_PUBLIC_URL`), avec une clé à portée minimale ; ne contourne aucun contrôle ; une proposition de transaction (`transactions:propose`) crée une transaction en attente de confirmation (règle de PHASE-15/16), jamais une transaction validée.
12. **Déconnexion** : révocation du jeton chez Google (erreur tolérée), suppression des jetons, arrêt des canaux ; données importées supprimées ou détachées (`read_only` levé) selon le choix de l'utilisateur.
13. **Contexte de job (ADR-007)** : chaque job porte `userId` et `integrationId` ; le worker rejoue le contexte CLS avant tout accès.
14. Audit : connexion, déconnexion, changement de portées, création/révocation de clé, rejet de webhook.

## 8. Tests exigés
- **Unitaires** : génération PKCE et vérification ; validation de `state` ; signature HMAC (valide, altérée, horodatage expiré) ; mapping événement Google → `calendar_events` (journée entière, fuseau, récurrence, annulation) ; résolution de conflit par `etag`.
- **Intégration** (Google simulé par un serveur de maquette `msw`/`nock`, **aucun appel réel en CI**) : flux OAuth complet ; rafraîchissement concurrent sous verrou ; `invalid_grant` ; sync initiale + incrémentale + `410 Gone` ; webhook dupliqué non retraité ; conversion d'e-mail en tâche ; brouillon créé, jamais d'appel `send`.
- **Sécurité** : `state` rejoué ou d'une autre session → refus ; jetons absents de la base en clair (inspection), des logs et des réponses ; webhook forgé ou rejoué → rejet ; clé d'API révoquée/expirée → 401 ; clé hors portée → 403 ; clé sur `/dev/vault/*` ou `/me/*` → 403 ; injection HTML/script dans un e-mail neutralisée.
- **Isolation entre utilisateurs** : test généré pour chaque route ; une intégration, un message converti ou un webhook de A n'est jamais visible par B ; le `userId` d'un webhook ne peut pas être forcé par le corps.
- **E2E** : connexion Google simulée, import d'un événement visible dans l'agenda ; conversion d'un e-mail en tâche ; création d'une clé d'API (ADMIN) et appel `POST /ideas` avec elle.
- **Recette manuelle sur staging** avec un vrai compte Google de test (consignée dans le rapport).

## 9. Découpage en tâches
| # | Tâche | Dépend de |
|---|---|---|
| T1 | Migration complète ; extension du module `crypto` à l'usage `INTEGRATIONS`. | — |
| T2 | Cadre `IntegrationProvider` (port) + service de jetons chiffrés + verrou de rafraîchissement. | T1 |
| T3 | OAuth Google (PKCE, `state`, autorisation incrémentale, callback, déconnexion). | T2 |
| T4 | Calendar lecture : sync initiale/incrémentale, mapping, réconciliation périodique. | T3 |
| T5 | Canaux push Calendar + webhook `google-calendar` + renouvellement. | T4 |
| T6 | Calendar bidirectionnel (écriture, `etag`, conflits, anti-boucle). | T5 |
| T7 | Gmail : recherche, aperçu, conversion tâche/note, brouillon. | T3 |
| T8 | Webhooks génériques (signature, rejeu, `webhook_events`, publication outbox). | T2 |
| T9 | Clés d'API : modèle, guard `Bearer` + `@Scopes`, rate limit, routes interdites. | T1 |
| T10 | Workflows n8n de référence (versionnés, sans identifiants) + section `INTEGRATIONS.md` à jour. | T9 |
| T11 | Tests de sécurité et d'isolation. | T3–T9 |
| T12 | Front : paramètres d'intégration, consentement, journal. | T3–T6 |
| T13 | Front : boîte Gmail, conversion, brouillon ; clés d'API ; secret de webhook. | T7, T8, T9 |
| T14 | Extensions dashboard, agenda, recherche, export ; E2E ; recette staging ; rapport. | T11, T12, T13 |

## 10. Agents ECC à mobiliser
- `security-reviewer` : obligatoire (OAuth, jetons, webhooks, clés d'API).
- `tdd-guide` : T3, T6, T8, T9.
- `typescript-reviewer`, `code-reviewer`, `silent-failure-hunter` (erreurs de synchro non avalées).
- `database-reviewer` : unicités et index de synchronisation.
- `react-reviewer` : écrans d'intégration.
- `e2e-runner` : T14.
- `docs-lookup` : API Google Calendar/Gmail à jour.

## 11. Definition of Done
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` respectée.
- [ ] OAuth avec PKCE + `state` ; jetons chiffrés ; aucun jeton en clair nulle part (tests).
- [ ] Calendar lecture puis bidirectionnel opérationnels sur staging avec un compte de test.
- [ ] Gmail : conversion et brouillon fonctionnels ; aucun envoi possible.
- [ ] Webhooks signés, anti-rejeu, idempotents.
- [ ] Clés d'API ADMIN à portée limitée, routes sensibles interdites.
- [ ] Tests d'isolation verts pour toutes les nouvelles routes.
- [ ] Statut de vérification de l'application OAuth Google consigné.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-14-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`), en précisant les portées finales, l'état de la vérification Google, la politique de conflit retenue et la liste des portées de clés d'API.
