# ORBIT : conventions d'API et catalogue des endpoints

- **Statut :** référence. Subordonné à `DECISIONS.md` puis à `PRODUCT_SCOPE.md`. Remplace `PRODUCT_SPEC.md` §7.4 et §16 (routes `/workspaces`, `/auth/refresh`, `/users/me` supprimées).
- **Responsabilité :** contrat HTTP de l'API : formats, erreurs, pagination, idempotence, concurrence, limites, et liste canonique des routes par module et par phase. Les règles de sécurité sont dans `SECURITY.md` ; les schémas de tables dans `DATA_MODEL.md` ; les calculs dans `FINANCE_RULES.md` ; les flux OAuth dans `INTEGRATIONS.md`.
- **Documents liés :** `DECISIONS.md` (ADR-002, 006, 007, 008, 010, 011, 012, 013, 023, 024), `PRODUCT_SCOPE.md` §4, `SECURITY.md`, `DATA_MODEL.md`, `FINANCE_RULES.md`, `ARCHITECTURE.md`, `TESTING.md`.
- **Source de vérité exécutable :** les schémas Zod de `packages/contracts` (ADR-010). Ce document fixe les règles ; en cas d'écart entre un schéma et ce document, corriger le schéma ou ouvrir une ADR.

---

## 1. Principes REST

1. Préfixe unique **`/api/v1`**. Toutes les routes ci-dessous sont relatives à ce préfixe.
2. Ressources en **kebab-case, au pluriel**, groupées par module : `/finance/transactions`, `/pro/invoices`, `/dev/technical-events`.
3. **Aucun `user_id` dans l'URL ni dans le corps.** L'utilisateur est toujours celui de la session ou de la clé d'API (ADR-007).
4. Identifiants : UUIDv7 en minuscules (ADR-011). Un paramètre `:id` non UUID → `400 VALIDATION_FAILED`.
5. Champs JSON en **camelCase** ; valeurs d'énumération en `SCREAMING_SNAKE_CASE` (`MOBILE_MONEY`, `VALIDATED`).
6. Verbes :

| Verbe | Usage | Succès |
|---|---|---|
| `GET` | Lecture ; **jamais** d'effet de bord | `200` |
| `POST` | Création (`201` + en-tête `Location`) ou action métier sur une ressource (`POST /:id/<verbe>`, `200`) ; travail asynchrone (`202`) | `201` / `200` / `202` |
| `PATCH` | Modification partielle (champs absents = inchangés ; `null` = effacer si le champ est nullable) | `200` |
| `PUT` | Remplacement complet d'une collection attachée (`PUT /ideas/:id/tags`) ou d'une valeur identifiée par clé naturelle (`PUT /habits/:id/logs/:date`) | `200` |
| `DELETE` | Suppression logique (soft delete) ou révocation | `204` |

7. Actions métier explicites plutôt que `PATCH status` : `POST /tasks/:id/complete`, `POST /finance/transactions/:id/cancel`, `POST /pro/invoices/:id/issue`. Les transitions d'état sont validées par le domaine (`422 INVALID_STATE_TRANSITION`).
8. Archivage : `POST /:id/archive` et `POST /:id/restore`. Les listes excluent les archivés sauf `archived=true` ou `archived=all`.
9. Une donnée financière validée n'est **jamais** supprimée par `DELETE` : elle est annulée par une action auditée (`FINANCE_RULES.md`).
10. Aucun endpoint générique de lecture de table, aucun paramètre `include`/`select` libre (§7.4 du cahier).
11. Toute réponse passe par un schéma de réponse Zod (champs non déclarés retirés) ; jamais d'entité Prisma brute (ADR-010).

---

## 2. Versionnement

- Version majeure dans le chemin (`/api/v1`). Le front et l'API sont déployés ensemble ; la version protège surtout les clients par clé d'API (n8n).
- **Changements compatibles** (sans nouvelle version) : ajout d'un endpoint, d'un champ de réponse, d'un paramètre facultatif, d'une valeur d'énumération **en sortie** (les clients doivent tolérer une valeur inconnue), d'un code d'erreur.
- **Changements cassants** (nouvelle version `/api/v2`) : suppression ou renommage de champ, changement de type, nouveau champ obligatoire, changement de sémantique, changement de code d'erreur existant.
- Dépréciation : en-têtes `Deprecation: @<epoch>` et `Sunset: <date HTTP>` pendant au moins 90 jours ; mention dans le rapport de phase.

---

## 3. Authentification

### 3.1 Navigateur (ADR-006)

- Cookie `__Host-orbit_sid` (HttpOnly, Secure, SameSite=Lax), posé par `POST /auth/login`. Le front n'a aucun jeton à manipuler. Requêtes `fetch` avec `credentials: 'same-origin'`.
- **En-tête obligatoire** sur toute requête `POST`, `PUT`, `PATCH`, `DELETE` : `X-Requested-With: orbit`. Le client HTTP du front l'ajoute sur **toutes** les requêtes. Absence ou `Origin` incorrect → `403 CSRF_REJECTED` (`SECURITY.md` §3.9).
- Pas de `/auth/refresh` : la session est glissante côté serveur.
- `401 UNAUTHENTICATED` signifie toujours « pas de session valide » : le front redirige vers la connexion. Tout autre refus utilise `403` ou `404`.

### 3.2 Clés d'API (PHASE-14)

- `Authorization: Bearer orbit_<prefix>_<secret>` ; aucun cookie ne doit accompagner la requête ; pas d'en-tête `X-Requested-With` requis.
- Portée vérifiée par route (`SECURITY.md` §6.4). Les routes accessibles par clé d'API sont marquées **K** dans le catalogue ; toutes les autres refusent une clé d'API (`403 API_KEY_SCOPE_DENIED`).

### 3.3 Exigences supplémentaires par route

Notées dans la colonne « Rôle » du catalogue :
- **R** : ré-authentification récente exigée (`403 REAUTH_REQUIRED`, `SECURITY.md` §4) ;
- **M** : MFA récente exigée (`403 MFA_REQUIRED`, à partir de PHASE-13) ;
- **K** : accessible par clé d'API avec la portée indiquée.

---

## 4. Enveloppe de réponse

**Ressource unique :**

```json
{ "data": { "id": "0192f1c2-…", "title": "Acheter un onduleur" } }
```

**Liste :**

```json
{
  "data": [ { "id": "…" } ],
  "meta": { "limit": 25, "nextCursor": "eyJrIjpb…", "hasMore": true }
}
```

- `data` est toujours présent dans une réponse `2xx` avec corps. `meta` n'apparaît que pour les listes et les réponses qui le documentent (par exemple `meta.replayed` n'existe pas : le rejeu est signalé par en-tête, §9).
- `204` : aucun corps.
- `202` : `data` contient la ressource de suivi (`{ id, status, … }`) et l'en-tête `Location` pointe vers elle.
- Aucune enveloppe supplémentaire (`success`, `status`) : le code HTTP fait foi.
- Pas de total par défaut (coûteux). Une liste qui en a besoin le documente via `meta.total` et le paramètre `withTotal=true`.

---

## 5. Erreurs

### 5.1 Format

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "La requête contient des champs invalides.",
    "details": [
      { "path": ["amountMinor"], "code": "invalid_string", "message": "Doit être une chaîne de chiffres." }
    ],
    "requestId": "0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f80"
  }
}
```

- `code` : identifiant **stable** (anglais, `SCREAMING_SNAKE_CASE`), défini dans `packages/contracts/errors.ts`. Le front décide sur `code`, jamais sur `message`.
- `message` : texte français destiné à l'utilisateur, sans détail interne.
- `details` : facultatif ; tableau pour `VALIDATION_FAILED`, objet documenté pour les autres codes (par exemple `{ "maxAgeSeconds": 600 }`).
- `requestId` : identique à l'en-tête `X-Request-Id` et aux logs serveur.
- **Jamais** : pile d'appel, message Prisma, SQL, nom de table, chemin de fichier, valeur secrète, indication d'existence d'une ressource d'autrui.

### 5.2 Catalogue des codes

| HTTP | `code` | Signification | `details` |
|---|---|---|---|
| 400 | `VALIDATION_FAILED` | Corps, query ou paramètre invalide ; clé inconnue (schéma `.strict()`). | Liste `{ path, code, message }` |
| 400 | `INVALID_JSON` | Corps non analysable. | — |
| 400 | `INVALID_CURSOR` | Curseur de pagination illisible ou incompatible avec le tri. | — |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | En-tête `Idempotency-Key` absent sur une route qui l'exige. | — |
| 401 | `UNAUTHENTICATED` | Pas de session ou de clé d'API valide (expirée, révoquée, absente). | — |
| 401 | `INVALID_CREDENTIALS` | Connexion refusée (message unique, `SECURITY.md` §3.8). | — |
| 401 | `WEBHOOK_SIGNATURE_INVALID` | Signature de webhook absente ou fausse. | — |
| 403 | `CSRF_REJECTED` | `X-Requested-With` ou `Origin` invalide. | — |
| 403 | `EMAIL_NOT_VERIFIED` | Mot de passe correct, e-mail non vérifié. | — |
| 403 | `REAUTH_REQUIRED` | Ré-authentification trop ancienne. | `{ maxAgeSeconds }` |
| 403 | `REAUTH_FAILED` | Mot de passe de ré-authentification incorrect. | — |
| 403 | `MFA_REQUIRED` | Vérification MFA exigée (connexion en attente ou action sensible). | `{ reason: "LOGIN" \| "STEP_UP" }` |
| 403 | `MFA_INVALID` | Code TOTP ou de secours incorrect. | — |
| 403 | `MODULE_DISABLED` | Module masqué par l'utilisateur (ADR-024). | `{ module }` |
| 403 | `API_KEY_SCOPE_DENIED` | Portée de clé d'API insuffisante ou route interdite aux clés. | `{ requiredScope }` |
| 403 | `QUOTA_EXCEEDED` | Quota de compte atteint (PHASE-17). | `{ quota, limit }` |
| 404 | `NOT_FOUND` | Ressource inexistante, appartenant à un autre utilisateur, ou route réservée à un rôle supérieur (`SECURITY.md` §6.2). | — |
| 405 | `METHOD_NOT_ALLOWED` | Verbe non supporté sur une route existante. | — |
| 409 | `CONFLICT` | Violation d'unicité métier (nom de compte, tag, numéro de contrat déjà utilisé). | `{ field }` |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | Requête avec la même clé encore en cours. | — |
| 409 | `INTEGRATION_REAUTH_REQUIRED` | Jeton du fournisseur révoqué ou expiré ; reconnecter l'intégration. | `{ integrationId }` |
| 410 | `GONE` | Jeton à usage unique déjà consommé ou expiré (vérification, reset), export expiré, proposition IA expirée. | — |
| 412 | `VERSION_CONFLICT` | `If-Match` ne correspond plus à la version courante. | `{ currentVersion }` |
| 413 | `PAYLOAD_TOO_LARGE` | Corps ou fichier trop volumineux. | `{ maxBytes }` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `Content-Type` non accepté par la route. | — |
| 415 | `FILE_TYPE_NOT_ALLOWED` | Type de fichier détecté hors liste blanche. | `{ detectedType }` |
| 422 | `IDEMPOTENCY_REPLAY` | Clé déjà utilisée avec une requête **différente** (méthode, route ou empreinte du corps). | — |
| 422 | `BUSINESS_RULE_VIOLATION` | Règle métier générique non couverte ci-dessous. | `{ rule }` |
| 422 | `INVALID_STATE_TRANSITION` | Transition interdite (facture émise modifiée, tâche déjà terminée…). | `{ from, to }` |
| 422 | `INSUFFICIENT_FUNDS` | Débit qui rendrait le solde négatif sur un compte sans découvert autorisé (H3). | `{ accountId, availableMinor, currency }` |
| 422 | `CURRENCY_MISMATCH` | Devises incompatibles sans conversion explicite. | `{ expected, received }` |
| 422 | `OVERPAYMENT` | Remboursement ou paiement supérieur au solde restant. | `{ remainingMinor, currency }` |
| 422 | `AMOUNT_OUT_OF_RANGE` | Montant saisi supérieur à 10^18 unités mineures (FINANCE_RULES §2.1). | — |
| 422 | `BALANCE_OUT_OF_RANGE` | Solde ou total hors de la plage BIGINT (FINANCE_RULES §2.1). | — |
| 422 | `CIRCULAR_DEPENDENCY` | Dépendance de tâche qui crée un cycle. | — |
| 422 | `REFERENCE_INVALID` | Référence vers une entité archivée ou d'un type incompatible (l'entité d'autrui reste `404`). | `{ field }` |
| 428 | `PRECONDITION_REQUIRED` | `If-Match` absent sur une route qui l'exige. | — |
| 429 | `RATE_LIMITED` | Limite de débit ou verrouillage. En-tête `Retry-After`. | `{ retryAfterSeconds }` |
| 500 | `INTERNAL_ERROR` | Erreur inattendue. | — |
| 502 | `UPSTREAM_ERROR` | Fournisseur externe en erreur (Google, Meta, Anthropic, stockage). | `{ provider }` |
| 503 | `SERVICE_UNAVAILABLE` | Maintenance, surcharge, coffre indisponible, IA désactivée globalement. | — |
| 504 | `UPSTREAM_TIMEOUT` | Délai dépassé chez un fournisseur externe. | `{ provider }` |

Ajouter un code = modifier `packages/contracts/errors.ts` **et** ce tableau dans la même PR.

### 5.3 Correspondances obligatoires

- Erreur Zod → `VALIDATION_FAILED`. Violation d'unicité Prisma (`P2002`) → `CONFLICT`. Violation de FK composite (`P2003`) → `NOT_FOUND`. Enregistrement absent (`P2025`) → `NOT_FOUND`. Toute autre erreur Prisma → `INTERNAL_ERROR` (détail en log seulement).

---

## 6. Types de données

### 6.1 Montants (ADR-008)

- Toujours un couple : `"<champ>Minor": "<chaîne de chiffres>"` + `"currency": "<ISO 4217>"`.

```json
{ "amountMinor": "150000", "currency": "XOF" }
{ "amountMinor": "1050", "currency": "EUR" }
```

- Le suffixe `Minor` est obligatoire dans les noms de champ (`amountMinor`, `openingBalanceMinor`, `balanceMinor`, `remainingMinor`, `unitPriceMinor`). `"1050"` en EUR vaut 10,50 €.
- Format : `^-?(0|[1-9][0-9]{0,18})$`, dans la plage `BIGINT`. Les montants saisis (transactions, dettes, paiements) sont **strictement positifs** et au plus 10^18 : `^[1-9][0-9]{0,18}$` (`PositiveMoneyStringSchema`). Les soldes calculés peuvent être négatifs.
- Interdits : `number` JSON, décimales, séparateurs, exposant. Le front convertit via `packages/money`.
- Taux et quantités (`NUMERIC`) : chaîne décimale à point (`"655.957"`, `"1.500"`), précision fixée par ADR-008.

### 6.2 Dates et heures (ADR-023)

| Type | Format | Exemple | Champs |
|---|---|---|---|
| Instant | ISO 8601 UTC, millisecondes, suffixe `Z` | `"2026-10-11T09:30:00.000Z"` | `createdAt`, `occurredAt` (instant), `startsAt`, `remindAt` |
| Date civile | `YYYY-MM-DD` | `"2026-10-11"` | `operationDate`, `dueDate`, `issueDate`, `journal.date` |
| Fuseau | Nom IANA | `"Africa/Dakar"` | `timezone` |
| Durée | Entier en minutes | `90` | `estimatedMinutes` |

- Un instant reçu avec un décalage (`+01:00`) est accepté et normalisé en UTC ; sans décalage → `400`.
- Les filtres de période sur dates civiles (`from`, `to`) sont **inclusifs** et interprétés dans le fuseau de l'utilisateur.

### 6.3 Autres conventions

- Booléens JSON natifs ; en query string : `true` / `false` uniquement.
- Chaînes : NFC, `trim` côté serveur ; longueurs maximales dans les schémas Zod.
- `null` explicite pour une valeur absente en réponse ; champs facultatifs non renvoyés seulement s'ils sont documentés comme tels.
- Champ `version` (entier) sur les ressources modifiables, reflété dans `ETag` (§10).

---

## 7. Pagination

- **Par curseur uniquement.** Pas d'`offset` ni de `page`.
- Paramètres : `limit` (défaut 25, **max 100** ; au-delà → `400`) et `cursor` (opaque, issu de `meta.nextCursor`).
- Curseur : base64url d'un JSON `{ "s": "<clé de tri>", "k": [<valeurs de tri>, "<id>"] }`. Le serveur rejette un curseur dont la clé de tri ne correspond pas au paramètre `sort` courant (`400 INVALID_CURSOR`). Le curseur ne contient aucune donnée sensible et reste filtré par `user_id`.
- Tri stable : la clé de tri est toujours complétée par `id` (UUIDv7, donc chronologique).
- `meta.nextCursor = null` et `meta.hasMore = false` en fin de liste.
- Les endpoints de plage temporelle (`/calendar/events`, `/finance/recurring/occurrences`, `/habits/:id/logs`) imposent `from` et `to` (fenêtre max 366 jours) et paginent quand même.

---

## 8. Filtres et tri

- Filtres en paramètres **nommés et plats** : `?status=OPEN&accountId=…&from=2026-10-01&to=2026-10-31`. Listes : valeurs séparées par des virgules (`status=OPEN,PARTIALLY_PAID`, 20 valeurs max).
- Recherche textuelle de liste : `q` (2 à 200 caractères).
- Tri : `sort=<champ>` ou `sort=-<champ>` (décroissant), **un seul champ**, choisi dans la liste blanche de l'endpoint.
- Tout paramètre de query non déclaré → `400 VALIDATION_FAILED` (schéma de query `.strict()`).
- Listes blanches par défaut (à préciser dans chaque schéma) :

| Ressource | Tri autorisé (défaut en gras) | Filtres principaux |
|---|---|---|
| `/ideas` | **`-capturedAt`**, `priority`, `updatedAt` | `status`, `tagId`, `source`, `archived`, `q` |
| `/tasks` | **`dueDate`**, `-priority`, `-createdAt` | `view` (`TODAY`, `OVERDUE`, `THIS_WEEK`, `NO_DUE_DATE`), `status`, `projectId`, `tagId`, `parentTaskId`, `q` |
| `/projects` | **`-updatedAt`**, `name`, `targetDate` | `status`, `type`, `clientId`, `archived`, `q` |
| `/notes` | **`-updatedAt`**, `title` | `type`, `tagId`, `archived`, `q` |
| `/finance/transactions` | **`-operationDate`**, `amountMinor`, `-createdAt` | `type`, `status`, `accountId`, `categoryId`, `counterpartyId`, `projectId`, `debtId`, `invoiceId`, `currency`, `from`, `to`, `q` |
| `/finance/debts` | **`dueDate`**, `-openedOn` | `kind` (`PAYABLE`, `RECEIVABLE`), `status`, `counterpartyId`, `overdue` |
| `/pro/invoices` | **`-issueDate`**, `dueDate`, `number` | `status`, `clientId`, `projectId`, `overdue`, `from`, `to` |
| `/documents` | **`-createdAt`**, `name`, `sizeBytes` | `mimeGroup`, `linkedTo*`, `deleted` |

---

## 9. Idempotence (`Idempotency-Key`)

### 9.1 Règles

- En-tête `Idempotency-Key` : 16 à 64 caractères `[A-Za-z0-9_-]` ; le front utilise un UUIDv7 généré **au moment de l'intention de l'utilisateur** (et conservé par la file hors ligne).
- Portée : `(user_id, key)`. Stockage : table `idempotency_keys` (M04) avec `method`, `route` (gabarit), `request_hash` (SHA-256 du corps JSON canonique), `status` (`IN_PROGRESS`, `COMPLETED`), `response_status`, `response_body`, `created_at`, `expires_at`.
- **Durée de rétention : 24 heures**, purge quotidienne.
- La ligne `IN_PROGRESS` est insérée **dans la même transaction SQL** que l'écriture métier quand c'est possible ; sinon avant, avec verrou.

### 9.2 Comportement

| Cas | Réponse |
|---|---|
| Clé nouvelle | Traitement normal ; réponse stockée si statut `2xx` ou `4xx` métier (`409`, `422`). |
| Même clé, même requête, terminée | Réponse **stockée** renvoyée à l'identique (statut et corps) avec l'en-tête `Idempotent-Replayed: true`. Aucun effet de bord. |
| Même clé, requête en cours | `409 IDEMPOTENCY_IN_PROGRESS`, `Retry-After: 1`. |
| Même clé, requête différente | `422 IDEMPOTENCY_REPLAY`. |
| Réponse `401`, `403`, `429`, `5xx` | Non stockée ; la clé est libérée et peut être réessayée. |
| Clé absente sur route « Obligatoire » | `400 IDEMPOTENCY_KEY_REQUIRED`. |

### 9.3 Routes concernées

- **Obligatoire** : toute création ou action à effet financier ou externe (colonne « Idem. » = **Oblig.** dans le catalogue) : transactions, transferts, validations et annulations financières, dettes et remboursements, confirmations d'occurrences récurrentes, factures (émission, paiement), exports, exécutions manuelles d'automatisations, confirmations de propositions IA, synchronisations d'intégrations, création de secret du coffre.
- **Facultative** : toute autre création `POST` (idées, tâches, notes, documents, rappels…) ; la file hors ligne du front l'envoie systématiquement.
- **Naturelle** : `PUT` et `DELETE` sont idempotents par construction ; l'en-tête est ignoré.

---

## 10. Concurrence optimiste (`ETag` / `If-Match`)

- Chaque ressource modifiable expose `version` (entier incrémenté à chaque écriture) et l'en-tête `ETag: W/"<version>"` sur `GET /:id` et sur les réponses de modification.
- **`If-Match` obligatoire** (`428 PRECONDITION_REQUIRED` s'il manque) sur `PATCH` et `DELETE` de : notes, entrées de journal, transactions `PENDING`, comptes financiers, dettes, récurrences, factures brouillon, contrats, automatisations, éléments du coffre. Ce sont les ressources éditées depuis plusieurs appareils ou à fort enjeu.
- **`If-Match` facultatif** ailleurs : vérifié s'il est fourni.
- Version différente → `412 VERSION_CONFLICT` avec `details.currentVersion` ; le front recharge et propose la fusion.
- Les actions `POST /:id/<verbe>` acceptent `If-Match` mais ne l'exigent pas ; la transition d'état est leur garde.

---

## 11. Limites

| Élément | Limite | Erreur |
|---|---|---|
| Corps JSON (par défaut) | 1 Mio | `413` |
| Corps JSON des routes `/auth/*` | 16 Kio | `413` |
| Contenu d'une note ou d'une entrée de journal | 200 000 caractères | `400` |
| Upload de document | 20 Mio, un fichier (`multipart/form-data`, champ `file`) | `413` / `415` |
| Audio de capture vocale (PHASE-16) | 10 Mio, 5 min | `413` |
| Corps de webhook | 256 Kio | `413` |
| Tableaux dans un corps | 100 éléments (lignes de facture : 200) | `400` |
| Query string | 4 Kio | `400` |
| `limit` de pagination | 100 | `400` |
| Fenêtre de dates | 366 jours | `400` |
| Secret du coffre | 64 Kio | `413` |
| Durée de traitement d'une requête | 30 s (sinon passer en `202` asynchrone) | `503` |

`Content-Type` accepté : `application/json` (UTF-8) ; `multipart/form-data` seulement sur les routes d'upload ; corps brut seulement sur `/webhooks/*`.

---

## 12. En-têtes standard

| En-tête | Sens | Usage |
|---|---|---|
| `X-Requested-With: orbit` | Requête | Obligatoire sur les mutations navigateur (§3.1). |
| `Idempotency-Key` | Requête | §9. |
| `If-Match` | Requête | §10. |
| `X-Request-Id` | Réponse | Toujours présent (UUIDv7) ; égal à `error.requestId`. Une valeur envoyée par le client n'est jamais réutilisée comme identifiant, seulement journalisée. |
| `ETag` | Réponse | §10. |
| `Location` | Réponse | `201`, `202`. |
| `Idempotent-Replayed: true` | Réponse | Rejeu (§9.2). |
| `Retry-After` | Réponse | `429`, `409 IDEMPOTENCY_IN_PROGRESS`, `503`. |
| `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` | Réponse | Sur les routes limitées (`SECURITY.md` §3.7). |
| `Cache-Control: no-store` | Réponse | Toutes les réponses `/api/v1` (sauf mention contraire). |

---

## 13. OpenAPI

- Généré depuis les schémas Zod de `packages/contracts` (ADR-010) via `nestjs-zod` ; chaque contrôleur déclare ses schémas de requête, de réponse et ses codes d'erreur possibles.
- Artefact `openapi.json` produit par la CI à chaque build ; un test compare le registre des routes Nest avec le catalogue §14 (route absente du catalogue = échec) et avec l'OpenAPI (route sans schéma = échec).
- UI Swagger : uniquement hors production et si `OPENAPI_UI_ENABLED=true` ; en staging, réservée à une session ADMIN. **Jamais servie en production** (`SECURITY.md` §3.11).
- Un client TypeScript n'est pas généré : le front importe directement `packages/contracts`.

---

## 14. Catalogue des endpoints

Légende des colonnes :
- **Rôle** : `Public` (sans session), `USER` (toute session, y compris ADMIN, sur ses propres données), `ADMIN` ; suffixes **R** (ré-auth), **M** (MFA récente), **K:<portée>** (clé d'API autorisée).
- **Idem.** : **Oblig.** (Idempotency-Key obligatoire), Opt. (facultative), Nat. (naturellement idempotent), — (lecture).
- Toutes les routes sont préfixées par `/api/v1`.

### 14.1 Routes publiques (liste fermée)

Seules ces routes portent `@Public()` ; le test de CI vérifie que la liste du code est identique : `GET /health/live`, `GET /health/ready`, `POST /auth/register`, `POST /auth/login`, `POST /auth/email/verify`, `POST /auth/email/verify/resend`, `POST /auth/email/change/confirm`, `POST /auth/password/forgot`, `POST /auth/password/reset`, `POST /webhooks/:provider`, `GET /webhooks/:provider` (défi de vérification). `POST /auth/mfa/verify` exige une session en état `mfa_pending`.

### 14.2 Socle (PHASE-00, PHASE-03)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/health/live` | Public | — | Vivacité : `{ "data": { "status": "ok" } }`, sans version ni détail interne. |
| `GET` | `/health/ready` | Public | — | Disponibilité : 200 si PostgreSQL (et Redis dès PHASE-08) répondent, 503 sinon. Aucun détail interne (ni nom d'hôte, ni message d'erreur). Utilisé par les smoke tests et Uptime Kuma. |

### 14.3 M01 Identité, sessions, préférences (PHASE-01 ; MFA en PHASE-13)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `POST` | `/auth/register` | Public | — | Inscription `{ email, password, displayName? }` → `202` uniforme `{ "data": { "status": "accepted" } }` (`SECURITY.md` §3.4). Mot de passe hors politique → `400 VALIDATION_FAILED`, `details[].path = ["password"]`. |
| `POST` | `/auth/email/verify` | Public | Nat. | Consomme `{ token }` ; `200` ou `410 GONE`. |
| `POST` | `/auth/email/verify/resend` | Public | — | `{ email }` → `202` uniforme. |
| `POST` | `/auth/login` | Public | — | `{ email, password }` → `200 { data: { user, mfaRequired } }` + cookie. |
| `POST` | `/auth/logout` | USER | Nat. | Révoque la session courante → `204`. |
| `POST` | `/auth/password/forgot` | Public | — | `{ email }` → `202` uniforme. |
| `POST` | `/auth/password/reset` | Public | Nat. | `{ token, newPassword, totpCode? \| recoveryCode? }` → `204` ; révoque toutes les sessions. |
| `POST` | `/auth/email/change/confirm` | Public | Nat. | Consomme le jeton envoyé à la nouvelle adresse → `204`. |
| `POST` | `/auth/reauth` | USER | — | `{ password, totpCode? }` → `204` ; met à jour `reauth_at` (et `mfa_verified_at`). |
| `POST` | `/auth/mfa/verify` | Session `mfa_pending` | — | PHASE-13. `{ totpCode \| recoveryCode }` → `200` ; rotation du cookie. |
| `GET` | `/me` | USER | — | Profil : `id`, `email`, `displayName`, `role`, `emailVerifiedAt`, `mfaEnabled`. |
| `PATCH` | `/me` | USER | — | `displayName`. |
| `GET` | `/me/preferences` | USER | — | Langue, fuseau, devise par défaut, format de date, `enabledModules`, `aiEnabled` (PHASE-16). |
| `PATCH` | `/me/preferences` | USER | — | Modification des préférences ; `enabledModules` ne peut pas contenir de module ADMIN (ADR-024). |
| `POST` | `/me/email` | USER R | — | `{ newEmail }` → `202` ; jeton envoyé à la nouvelle adresse. |
| `POST` | `/me/password` | USER | — | `{ currentPassword, newPassword }` → `204` ; rotation de session, révocation des autres. |
| `GET` | `/me/sessions` | USER | — | Sessions actives (appareil, IP tronquée, dernière activité, `current`). |
| `DELETE` | `/me/sessions/:id` | USER | Nat. | Révoque une session → `204`. |
| `POST` | `/me/sessions/revoke-others` | USER | Nat. | Révoque toutes les sessions sauf la courante → `204`. |
| `GET` | `/me/login-events` | USER | — | Historique de connexion de l'utilisateur (paginé). |
| `GET` | `/me/mfa` | USER | — | PHASE-13. État : facteurs actifs, codes de secours restants. |
| `POST` | `/me/mfa/totp/setup` | USER R | — | PHASE-13. Crée un facteur `PENDING` ; renvoie `otpauthUri` et `secret` une seule fois. |
| `POST` | `/me/mfa/totp/activate` | USER R | — | PHASE-13. `{ totpCode }` → active ; renvoie les 10 codes de secours une seule fois. |
| `DELETE` | `/me/mfa/totp` | USER R M | Nat. | PHASE-13. `{ totpCode }` dans le corps ; désactive la MFA → `204`. |
| `POST` | `/me/mfa/recovery-codes/regenerate` | USER R M | — | PHASE-13. Invalide les anciens codes, renvoie 10 nouveaux codes. |

### 14.4 M02 Shell (PHASE-02)

Aucun endpoint propre. Le shell consomme `/me`, `/me/preferences` et, pour la capture rapide, les créations de PHASE-04.

### 14.5 M03 Organisation (PHASE-04)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/ideas` | USER | — | Liste (récentes d'abord). |
| `POST` | `/ideas` | USER K:ideas:write | Opt. | Capture `{ title, description?, source?, priority?, tagIds? }`. |
| `GET` | `/ideas/:id` | USER | — | Détail. |
| `PATCH` | `/ideas/:id` | USER | — | Modification (statut inclus, transitions validées). |
| `DELETE` | `/ideas/:id` | USER | Nat. | Suppression logique. |
| `POST` | `/ideas/:id/archive` | USER | Nat. | Archive. |
| `POST` | `/ideas/:id/restore` | USER | Nat. | Désarchive. |
| `PUT` | `/ideas/:id/tags` | USER | Nat. | Remplace les tags `{ tagIds }`. |
| `POST` | `/ideas/:id/convert-to-project` | USER | **Oblig.** | Crée un projet lié, conserve l'idée (`SELECTED` → `IN_PROGRESS`). |
| `GET` | `/tasks` | USER | — | Liste, vues `TODAY`, `OVERDUE`, `THIS_WEEK`, `NO_DUE_DATE`. |
| `POST` | `/tasks` | USER K:tasks:write | Opt. | Création (sous-tâche via `parentTaskId`). |
| `GET` | `/tasks/:id` | USER | — | Détail avec sous-tâches et dépendances. |
| `PATCH` | `/tasks/:id` | USER | — | Modification ; changement d'échéance audité. |
| `DELETE` | `/tasks/:id` | USER | Nat. | Suppression logique. |
| `POST` | `/tasks/:id/complete` | USER | Nat. | Termine ; génère l'occurrence suivante si récurrente. |
| `POST` | `/tasks/:id/reopen` | USER | Nat. | Rouvre. |
| `PUT` | `/tasks/:id/tags` | USER | Nat. | Remplace les tags. |
| `POST` | `/tasks/:id/dependencies` | USER | — | `{ dependsOnTaskId }` ; `422 CIRCULAR_DEPENDENCY`. |
| `DELETE` | `/tasks/:id/dependencies/:dependsOnTaskId` | USER | Nat. | Retire une dépendance. |
| `GET` | `/projects` | USER | — | Liste. |
| `POST` | `/projects` | USER | Opt. | Création. |
| `GET` | `/projects/:id` | USER | — | Détail. |
| `PATCH` | `/projects/:id` | USER | — | Modification (`clientId` à partir de PHASE-10). |
| `DELETE` | `/projects/:id` | USER | Nat. | Suppression logique (refusée si transactions liées : `422`). |
| `POST` | `/projects/:id/archive` | USER | Nat. | Archive. |
| `POST` | `/projects/:id/restore` | USER | Nat. | Désarchive. |
| `PUT` | `/projects/:id/tags` | USER | Nat. | Remplace les tags. |
| `GET` | `/projects/:id/summary` | USER | — | Progression (règle documentée) ; à partir de PHASE-05, revenus et dépenses issus du registre. |
| `GET` | `/notes` | USER | — | Liste. |
| `POST` | `/notes` | USER K:notes:write | Opt. | Création. |
| `GET` | `/notes/:id` | USER | — | Détail (contenu brut ; rendu côté front par `SafeMarkdown`). |
| `PATCH` | `/notes/:id` | USER | — | Modification ; **If-Match obligatoire**. |
| `DELETE` | `/notes/:id` | USER | Nat. | Suppression logique ; **If-Match obligatoire**. |
| `POST` | `/notes/:id/archive` | USER | Nat. | Archive. |
| `POST` | `/notes/:id/restore` | USER | Nat. | Désarchive. |
| `PUT` | `/notes/:id/tags` | USER | Nat. | Remplace les tags. |
| `POST` | `/notes/:id/links` | USER | — | Lien explicite vers une entité (`{ taskId? \| projectId? \| ideaId? … }`, une seule cible, ADR-018). |
| `DELETE` | `/notes/:id/links/:linkId` | USER | Nat. | Retire un lien. |
| `GET` | `/tags` | USER | — | Liste. |
| `POST` | `/tags` | USER | Opt. | Création ; `409 CONFLICT` si nom existant. |
| `PATCH` | `/tags/:id` | USER | — | Renommage, couleur. |
| `DELETE` | `/tags/:id` | USER | Nat. | Suppression (détache des entités). |

### 14.6 M04 Finance, cœur (PHASE-05)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/finance/currencies` | USER | — | Devises supportées (`code`, `exponent`, `symbol`), table globale. |
| `GET` | `/finance/accounts` | USER | — | Comptes avec solde réalisé calculé (`balanceMinor`). |
| `POST` | `/finance/accounts` | USER | **Oblig.** | Création `{ name, type, provider?, currency, openingBalanceMinor, openedOn, allowOverdraft? }`. |
| `GET` | `/finance/accounts/:id` | USER | — | Détail et solde. |
| `PATCH` | `/finance/accounts/:id` | USER | — | Nom, fournisseur, notes, découvert ; devise et solde initial non modifiables après la première écriture. **If-Match obligatoire**. |
| `POST` | `/finance/accounts/:id/archive` | USER | Nat. | Archive (conservé dans l'historique). |
| `POST` | `/finance/accounts/:id/restore` | USER | Nat. | Désarchive. |
| `GET` | `/finance/accounts/:id/entries` | USER | — | Relevé : écritures `ledger_entries` avec solde courant. |
| `GET` | `/finance/categories` | USER | — | Catégories (initiales + personnalisées). |
| `POST` | `/finance/categories` | USER | Opt. | Création `{ name, kind: INCOME \| EXPENSE }`. |
| `PATCH` | `/finance/categories/:id` | USER | — | Renommage. |
| `POST` | `/finance/categories/:id/archive` | USER | Nat. | Archive (une catégorie utilisée n'est jamais supprimée). |
| `DELETE` | `/finance/categories/:id` | USER | Nat. | Suppression si jamais utilisée, sinon `422`. |
| `GET` | `/finance/counterparties` | USER | — | Liste. |
| `POST` | `/finance/counterparties` | USER | Opt. | Création. |
| `GET` | `/finance/counterparties/:id` | USER | — | Détail avec synthèse (transactions, dettes). |
| `PATCH` | `/finance/counterparties/:id` | USER | — | Modification. |
| `POST` | `/finance/counterparties/:id/archive` | USER | Nat. | Archive. |
| `GET` | `/finance/transactions` | USER | — | Liste filtrée. |
| `POST` | `/finance/transactions` | USER | **Oblig.** | Création `INCOME`, `EXPENSE` ou `ADJUSTMENT`, statut `PENDING` ou `VALIDATED`, frais facultatifs (`feeMinor`, crée l'EXPENSE liée). `422 INSUFFICIENT_FUNDS` / `CURRENCY_MISMATCH`. |
| `GET` | `/finance/transactions/:id` | USER | — | Détail, écritures, transactions liées (frais). |
| `PATCH` | `/finance/transactions/:id` | USER | — | `PENDING` : tous champs ; `VALIDATED` : description, catégorie, notes, contrepartie seulement (audité). **If-Match obligatoire**. |
| `POST` | `/finance/transactions/:id/validate` | USER | **Oblig.** | `PENDING` → `VALIDATED` (écritures prises en compte dans le solde). |
| `POST` | `/finance/transactions/:id/cancel` | USER | **Oblig.** | `{ reason }` ; annulation auditée sans falsifier l'historique (`FINANCE_RULES.md`). |
| `DELETE` | `/finance/transactions/:id` | USER | Nat. | Uniquement une transaction `PENDING` ; sinon `422 INVALID_STATE_TRANSITION`. **If-Match obligatoire**. |
| `POST` | `/finance/transfers` | USER | **Oblig.** | Transfert entre deux comptes distincts (2 écritures) ; conversion explicite `{ rate, rateDate, targetAmountMinor }` si devises différentes ; frais facultatifs. |
| `GET` | `/finance/transfers/:id` | USER | — | Détail d'un transfert (deux écritures, taux). |
| `GET` | `/finance/reports/summary` | USER | — | Revenus, dépenses, net par devise sur `from`/`to`. |
| `GET` | `/finance/reports/by-category` | USER | — | Répartition par catégorie et par devise. |
| `GET` | `/finance/reports/balances` | USER | — | Soldes par compte et total par devise, à une date (`asOf`). |

### 14.7 M05 Dettes, créances, récurrences, prévisions (PHASE-06)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/finance/debts` | USER | — | Liste, `overdue` dérivé (ADR-020). |
| `POST` | `/finance/debts` | USER | **Oblig.** | Création `PAYABLE` ou `RECEIVABLE` ; option `initialTransaction` (emprunt reçu, prêt accordé) liée à un compte. |
| `GET` | `/finance/debts/:id` | USER | — | Détail, solde restant dérivé, versements. |
| `PATCH` | `/finance/debts/:id` | USER | — | Titre, motif, échéance, notes. **If-Match obligatoire**. |
| `GET` | `/finance/debts/:id/repayments` | USER | — | Versements. |
| `POST` | `/finance/debts/:id/repayments` | USER | **Oblig.** | Versement relié à une transaction (créée ou existante `transactionId`) ; `422 OVERPAYMENT`. |
| `POST` | `/finance/debts/:id/cancel` | USER | **Oblig.** | Annulation `{ reason }`. |
| `POST` | `/finance/debts/:id/write-off` | USER | **Oblig.** | Radiation du solde restant `{ reason }`. |
| `GET` | `/finance/recurring` | USER | — | Récurrences. |
| `POST` | `/finance/recurring` | USER | Opt. | Création (périodicité, compte, montant, prochaine date, fin). |
| `GET` | `/finance/recurring/:id` | USER | — | Détail. |
| `PATCH` | `/finance/recurring/:id` | USER | — | Modification (s'applique aux occurrences futures non confirmées). **If-Match obligatoire**. |
| `POST` | `/finance/recurring/:id/pause` | USER | Nat. | Désactive. |
| `POST` | `/finance/recurring/:id/resume` | USER | Nat. | Réactive. |
| `DELETE` | `/finance/recurring/:id` | USER | Nat. | Termine la récurrence (historique conservé). **If-Match obligatoire**. |
| `GET` | `/finance/recurring/occurrences` | USER | — | Échéances prévisionnelles sur `from`/`to`, séparées du réalisé. |
| `POST` | `/finance/recurring/:id/occurrences/:occurrenceId/confirm` | USER | **Oblig.** | Crée la transaction réelle (une seule par occurrence). |
| `POST` | `/finance/recurring/:id/occurrences/:occurrenceId/skip` | USER | Nat. | Ignore l'occurrence. |
| `GET` | `/finance/reports/forecast` | USER | — | Trésorerie prévisionnelle par compte (réalisé + occurrences + dettes à échéance), horizon ≤ 366 jours. |

### 14.8 M06 Dashboard, recherche, exports (PHASE-07)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/dashboard` | USER | — | Widgets de l'utilisateur (`widgets=` liste blanche facultative), mêmes services de calcul que les pages ; étendu par chaque phase. Aucun contenu du coffre. |
| `GET` | `/search` | USER | — | `q` (2–200), `types` (liste blanche), pagination ; résultats réduits aux champs d'affichage ; coffre jamais indexé. |
| `GET` | `/exports` | USER | — | Exports de l'utilisateur (statut, expiration). |
| `POST` | `/exports` | USER R | **Oblig.** | `{ scope: FINANCE \| ORGANISATION \| … \| ACCOUNT (PHASE-17), format: CSV \| JSON, from?, to? }` → `202` ; synchrone en PHASE-07, en file à partir de PHASE-08 (même contrat). |
| `GET` | `/exports/:id` | USER | — | Suivi (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `EXPIRED`). |
| `GET` | `/exports/:id/download` | USER | — | Fichier (`Content-Disposition: attachment`) ou `410 GONE` après 24 h ; audité. |
| `DELETE` | `/exports/:id` | USER | Nat. | Supprime le fichier. |

### 14.9 M07 Rappels et notifications (PHASE-08)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/reminders` | USER | — | Liste. |
| `POST` | `/reminders` | USER | Opt. | `{ remindAt, channel, taskId? \| debtId? \| invoiceId? \| domainId? \| calendarEventId? … }` (une cible, ADR-018). |
| `GET` | `/reminders/:id` | USER | — | Détail, tentatives, résultat. |
| `PATCH` | `/reminders/:id` | USER | — | Modification (si non envoyé). |
| `DELETE` | `/reminders/:id` | USER | Nat. | Annule. |
| `POST` | `/reminders/:id/snooze` | USER | — | `{ until }`. |
| `GET` | `/notifications` | USER | — | Liste (`unread=true`). |
| `GET` | `/notifications/unread-count` | USER | — | `{ count }`. |
| `POST` | `/notifications/:id/read` | USER | Nat. | Marque lue. |
| `POST` | `/notifications/read-all` | USER | Nat. | Tout marquer lu. |
| `GET` | `/notifications/preferences` | USER | — | Canaux par type, heures silencieuses. |
| `PUT` | `/notifications/preferences` | USER | Nat. | Remplace les préférences. |
| `GET` | `/notifications/push-subscriptions/public-key` | USER | — | Clé publique VAPID. |
| `POST` | `/notifications/push-subscriptions` | USER | Opt. | Enregistre un abonnement Web Push de l'appareil. |
| `DELETE` | `/notifications/push-subscriptions/:id` | USER | Nat. | Supprime l'abonnement. |

### 14.10 M08 Calendrier interne et documents (PHASE-09)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/calendar/events` | USER K:calendar:read | — | Événements sur `from`/`to` (obligatoires), internes et externes (PHASE-14, `source`). |
| `POST` | `/calendar/events` | USER | Opt. | Création (instant + `timezone`). |
| `GET` | `/calendar/events/:id` | USER | — | Détail. |
| `PATCH` | `/calendar/events/:id` | USER | — | Modification (événements externes en lecture seule tant que la synchro est unidirectionnelle). |
| `DELETE` | `/calendar/events/:id` | USER | Nat. | Annulation. |
| `GET` | `/documents` | USER | — | Liste. |
| `POST` | `/documents` | USER | Opt. | Upload `multipart/form-data` (`SECURITY.md` §10) + liens facultatifs. |
| `GET` | `/documents/:id` | USER | — | Métadonnées. |
| `PATCH` | `/documents/:id` | USER | — | Renommage (nom normalisé côté serveur). |
| `DELETE` | `/documents/:id` | USER | Nat. | Suppression logique (purge à 30 jours). |
| `POST` | `/documents/:id/restore` | USER | Nat. | Restaure avant purge. |
| `POST` | `/documents/:id/download-url` | USER | — | `{ url, expiresAt }`, URL signée ≤ 5 min (ADR-013) ; `POST` car l'action est auditée. |
| `POST` | `/documents/:id/links` | USER | — | Lien explicite vers une entité (une cible). |
| `DELETE` | `/documents/:id/links/:linkId` | USER | Nat. | Retire un lien. |

### 14.11 M09 Pro : clients, contacts, contrats, factures (PHASE-10)

Module désactivable (ADR-024) : `403 MODULE_DISABLED` si masqué.

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/pro/clients` | USER | — | Liste. |
| `POST` | `/pro/clients` | USER | Opt. | Création (personne ou entreprise). |
| `GET` | `/pro/clients/:id` | USER | — | Fiche avec contacts et rôles. |
| `PATCH` | `/pro/clients/:id` | USER | — | Modification. |
| `POST` | `/pro/clients/:id/archive` | USER | Nat. | Archive (historique financier conservé). |
| `POST` | `/pro/clients/:id/restore` | USER | Nat. | Désarchive. |
| `GET` | `/pro/clients/:id/history` | USER | — | Projets, contrats, factures, transactions, notes liés (paginé, `type=`). |
| `POST` | `/pro/clients/:id/contacts` | USER | — | Associe un contact `{ contactId, role }`. |
| `DELETE` | `/pro/clients/:id/contacts/:contactId` | USER | Nat. | Dissocie. |
| `GET` | `/pro/contacts` | USER | — | Liste. |
| `POST` | `/pro/contacts` | USER | Opt. | Création. |
| `GET` | `/pro/contacts/:id` | USER | — | Détail et organisations. |
| `PATCH` | `/pro/contacts/:id` | USER | — | Modification. |
| `DELETE` | `/pro/contacts/:id` | USER | Nat. | Suppression logique. |
| `GET` | `/pro/contracts` | USER | — | Liste. |
| `POST` | `/pro/contracts` | USER | Opt. | Création (référence unique par utilisateur). |
| `GET` | `/pro/contracts/:id` | USER | — | Détail, historique de statut. |
| `PATCH` | `/pro/contracts/:id` | USER | — | Modification. **If-Match obligatoire**. |
| `POST` | `/pro/contracts/:id/transition` | USER | — | `{ to, reason? }` ; transitions validées par le domaine, historisées. |
| `GET` | `/pro/invoices` | USER | — | Liste, `overdue` dérivé. |
| `POST` | `/pro/invoices` | USER | Opt. | Brouillon avec lignes ; totaux calculés côté serveur. |
| `GET` | `/pro/invoices/:id` | USER | — | Détail, lignes, paiements, solde restant. |
| `PATCH` | `/pro/invoices/:id` | USER | — | Brouillon seulement ; lignes remplacées en bloc. **If-Match obligatoire**. |
| `DELETE` | `/pro/invoices/:id` | USER | Nat. | Brouillon seulement. **If-Match obligatoire**. |
| `POST` | `/pro/invoices/:id/issue` | USER | **Oblig.** | Émission : numéro attribué atomiquement (`invoice_sequences`), facture figée. |
| `POST` | `/pro/invoices/:id/cancel` | USER | **Oblig.** | Annulation `{ reason }`, traçable. |
| `GET` | `/pro/invoices/:id/payments` | USER | — | Paiements imputés. |
| `POST` | `/pro/invoices/:id/payments` | USER | **Oblig.** | Imputation d'un paiement : transaction `INCOME` créée ou existante (`transactionId`), répartition possible ; `422 OVERPAYMENT`. |
| `GET` | `/pro/invoices/:id/pdf` | USER | — | PDF généré (`Content-Disposition: attachment`). |

### 14.12 M10 Objectifs, habitudes, apprentissage, journal (PHASE-11)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/goals` | USER | — | Liste. |
| `POST` | `/goals` | USER | Opt. | Création. |
| `GET` | `/goals/:id` | USER | — | Détail, progression, liens. |
| `PATCH` | `/goals/:id` | USER | — | Modification (valeur courante, bilan). |
| `DELETE` | `/goals/:id` | USER | Nat. | Suppression logique. |
| `POST` | `/goals/:id/links` | USER | — | Lien vers un projet ou une tâche (`goal_links`). |
| `DELETE` | `/goals/:id/links/:linkId` | USER | Nat. | Retire le lien. |
| `GET` | `/habits` | USER | — | Liste avec indicateurs de régularité. |
| `POST` | `/habits` | USER | Opt. | Création. |
| `GET` | `/habits/:id` | USER | — | Détail. |
| `PATCH` | `/habits/:id` | USER | — | Modification. |
| `DELETE` | `/habits/:id` | USER | Nat. | Suppression logique. |
| `GET` | `/habits/:id/logs` | USER | — | Enregistrements sur `from`/`to`. |
| `PUT` | `/habits/:id/logs/:date` | USER | Nat. | Enregistre la journée (`date` civile). |
| `DELETE` | `/habits/:id/logs/:date` | USER | Nat. | Efface la journée. |
| `GET` | `/learning` | USER | — | Éléments d'apprentissage. |
| `POST` | `/learning` | USER | Opt. | Création (compétence, niveaux, ressources). |
| `GET` | `/learning/:id` | USER | — | Détail. |
| `PATCH` | `/learning/:id` | USER | — | Modification. |
| `DELETE` | `/learning/:id` | USER | Nat. | Suppression logique. |
| `GET` | `/learning/:id/sessions` | USER | — | Sessions. |
| `POST` | `/learning/:id/sessions` | USER | Opt. | Ajoute une session (durée, notes). |
| `DELETE` | `/learning/:id/sessions/:sessionId` | USER | Nat. | Supprime une session. |
| `GET` | `/journal` | USER | — | Entrées sur `from`/`to`. |
| `POST` | `/journal` | USER | Opt. | Création `{ date, content, mood? }`. |
| `GET` | `/journal/:id` | USER | — | Détail. |
| `PATCH` | `/journal/:id` | USER | — | Modification. **If-Match obligatoire**. |
| `DELETE` | `/journal/:id` | USER | Nat. | Suppression. **If-Match obligatoire**. |

### 14.13 M11 Zone Dev : inventaire technique (PHASE-12, ADMIN)

Tout rôle autre qu'`ADMIN` reçoit `404 NOT_FOUND` (`SECURITY.md` §6.2). Les URL stockées ne sont jamais appelées par le serveur.

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/dev/applications` | ADMIN | — | Liste. |
| `POST` | `/dev/applications` | ADMIN | Opt. | Création (projet ou client lié facultatif). |
| `GET` | `/dev/applications/:id` | ADMIN | — | Détail avec environnements. |
| `PATCH` | `/dev/applications/:id` | ADMIN | — | Modification. |
| `POST` | `/dev/applications/:id/archive` | ADMIN | Nat. | Archive. |
| `GET` | `/dev/environments` | ADMIN | — | Liste (`applicationId`). |
| `POST` | `/dev/environments` | ADMIN | Opt. | Création. |
| `GET` | `/dev/environments/:id` | ADMIN | — | Détail et ressources liées. |
| `PATCH` | `/dev/environments/:id` | ADMIN | — | Modification (statut, dernier déploiement). |
| `DELETE` | `/dev/environments/:id` | ADMIN | Nat. | Suppression logique (reste dans l'historique). |
| `PUT` | `/dev/environments/:id/domains` | ADMIN | Nat. | Remplace les domaines liés `{ domainIds }`. |
| `PUT` | `/dev/environments/:id/servers` | ADMIN | Nat. | Remplace les serveurs liés. |
| `PUT` | `/dev/environments/:id/services` | ADMIN | Nat. | Remplace les services liés (`environment_subscriptions`). |
| `GET` | `/dev/domains` | ADMIN | — | Liste (`expiringWithinDays`). |
| `POST` | `/dev/domains` | ADMIN | Opt. | Création. |
| `GET` | `/dev/domains/:id` | ADMIN | — | Détail. |
| `PATCH` | `/dev/domains/:id` | ADMIN | — | Modification. |
| `DELETE` | `/dev/domains/:id` | ADMIN | Nat. | Suppression logique. |
| `GET` | `/dev/servers` | ADMIN | — | Liste. |
| `POST` | `/dev/servers` | ADMIN | Opt. | Création. |
| `GET` | `/dev/servers/:id` | ADMIN | — | Détail. |
| `PATCH` | `/dev/servers/:id` | ADMIN | — | Modification. |
| `DELETE` | `/dev/servers/:id` | ADMIN | Nat. | Suppression logique. |
| `GET` | `/dev/services` | ADMIN | — | Services et abonnements (`service_subscriptions`). |
| `POST` | `/dev/services` | ADMIN | Opt. | Création (coût prévu distinct du payé). |
| `GET` | `/dev/services/:id` | ADMIN | — | Détail. |
| `PATCH` | `/dev/services/:id` | ADMIN | — | Modification. |
| `DELETE` | `/dev/services/:id` | ADMIN | Nat. | Suppression logique. |
| `GET` | `/dev/technical-events` | ADMIN | — | Historique (filtres par application, serveur, domaine, type). |
| `POST` | `/dev/technical-events` | ADMIN | Opt. | Déploiement, migration, incident, renouvellement, sauvegarde vérifiée… |
| `GET` | `/dev/technical-events/:id` | ADMIN | — | Détail. |
| `PATCH` | `/dev/technical-events/:id` | ADMIN | — | Complète le résultat d'une intervention. |

### 14.14 M12 Coffre-fort (PHASE-13, ADMIN)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/dev/vault/items` | ADMIN | — | Métadonnées seulement, jamais de valeur. |
| `POST` | `/dev/vault/items` | ADMIN R M | **Oblig.** | Création `{ title, type, username?, value, resource*, expiresOn?, notes? }` ; `value` chiffrée immédiatement, jamais renvoyée. |
| `GET` | `/dev/vault/items/:id` | ADMIN | — | Métadonnées (dates de rotation, version de clé). |
| `PATCH` | `/dev/vault/items/:id` | ADMIN | — | Métadonnées seulement. **If-Match obligatoire**. |
| `POST` | `/dev/vault/items/:id/reveal` | ADMIN R M | — | Ré-auth et MFA ≤ 5 min ; `{ data: { value } }`, `Cache-Control: no-store` ; rate limit ; audité. |
| `POST` | `/dev/vault/items/:id/rotate` | ADMIN R M | **Oblig.** | Nouvelle valeur → nouvelle version ; ancienne détruite à 30 jours. |
| `DELETE` | `/dev/vault/items/:id` | ADMIN R M | Nat. | Crypto-shredding de toutes les versions. **If-Match obligatoire**. |
| `GET` | `/dev/vault/items/:id/audit` | ADMIN | — | Événements d'audit de l'élément (création, révélations, rotations). |

La rotation de la KEK n'a **pas** de route HTTP (commande CLI, `SECURITY.md` §8.3).

### 14.15 M13 Intégrations, webhooks, clés d'API (PHASE-14)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/integrations` | USER | — | Intégrations disponibles et connectées (état, scopes, dernière synchro, dernière erreur). |
| `POST` | `/integrations/:provider/connect` | USER R | — | `provider` ∈ liste blanche (`google`, `whatsapp` en PHASE-16) ; renvoie `{ authorizationUrl }` (PKCE + `state` lié à la session). |
| `GET` | `/integrations/:provider/callback` | USER | Nat. | Retour OAuth : vérifie `state`, échange le code, stocke les jetons chiffrés, redirige `302` vers le front. Seul `GET` à effet de bord, protégé par `state`. |
| `GET` | `/integrations/:id` | USER | — | Détail. |
| `PATCH` | `/integrations/:id` | USER | — | Réglages (agendas synchronisés, sens). |
| `POST` | `/integrations/:id/sync` | USER | **Oblig.** | Synchronisation manuelle → `202`. |
| `DELETE` | `/integrations/:id` | USER R | Nat. | Révocation chez le fournisseur puis destruction des jetons. |
| `GET` | `/integrations/:id/gmail/messages` | USER | — | Recherche ciblée `q` (scopes autorisés), métadonnées seulement ; corps traités comme non fiables. |
| `POST` | `/integrations/:id/gmail/messages/:messageId/convert` | USER | **Oblig.** | `{ target: TASK \| NOTE \| IDEA }`. |
| `POST` | `/integrations/:id/gmail/drafts` | USER | Opt. | Crée un **brouillon** ; aucun envoi. |
| `GET` | `/api-keys` | ADMIN | — | Clés (préfixe, portées, expiration, dernier usage). |
| `POST` | `/api-keys` | ADMIN R M | — | `{ name, scopes, expiresInDays, allowedIps? }` ; secret renvoyé une seule fois. |
| `DELETE` | `/api-keys/:id` | ADMIN | Nat. | Révocation immédiate. |
| `GET` | `/webhooks/:provider` | Public | — | Défi de vérification d'abonnement (WhatsApp `hub.challenge` avec `hub.verify_token`). |
| `POST` | `/webhooks/:provider` | Public (signature) | Nat. | Réception (§15). `provider` ∈ { `google-calendar`, `whatsapp` }. |

### 14.16 M14 Automatisations (PHASE-15)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/automations/catalog` | USER | — | Déclencheurs, conditions et actions disponibles avec leurs schémas. |
| `GET` | `/automations` | USER | — | Règles. |
| `POST` | `/automations` | USER | Opt. | Création (inactive par défaut), validée contre le catalogue. |
| `GET` | `/automations/:id` | USER | — | Détail, version. |
| `PATCH` | `/automations/:id` | USER | — | Modification → nouvelle version. **If-Match obligatoire**. |
| `DELETE` | `/automations/:id` | USER | Nat. | Suppression logique (exécutions conservées). **If-Match obligatoire**. |
| `POST` | `/automations/:id/enable` | USER | Nat. | Active. |
| `POST` | `/automations/:id/disable` | USER | Nat. | Désactive (aucune nouvelle exécution). |
| `POST` | `/automations/:id/test` | USER | — | Simulation sans effet de bord ; renvoie les actions qui seraient exécutées. |
| `POST` | `/automations/:id/run` | USER K:automations:run | **Oblig.** | Déclenchement manuel ou par n8n → `202` avec l'exécution. |
| `GET` | `/automations/:id/runs` | USER | — | Exécutions de la règle. |
| `GET` | `/automations/runs/:runId` | USER | — | Détail (statut, actions, erreurs sans secret). |
| `POST` | `/automations/runs/:runId/cancel` | USER | Nat. | Arrête avant l'action suivante. |

### 14.17 M15 IA et capture multicanale (PHASE-16)

Toutes les routes `/ai/*` renvoient `403 MODULE_DISABLED` si `aiEnabled = false`.

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `POST` | `/ai/requests` | USER | Opt. | `{ prompt, contextScopes? }` → réponse et propositions éventuelles ; rate limit et budget. |
| `GET` | `/ai/requests` | USER | — | Historique (contenu conservé 30 jours). |
| `GET` | `/ai/requests/:id` | USER | — | Détail. |
| `DELETE` | `/ai/requests/:id` | USER | Nat. | Supprime le contenu. |
| `GET` | `/ai/proposals` | USER | — | Propositions (`status=PENDING`). |
| `GET` | `/ai/proposals/:id` | USER | — | Détail avec payload proposé. |
| `POST` | `/ai/proposals/:id/confirm` | USER | **Oblig.** | `{ overrides? }` revalidés ; exécute l'action via le service métier ; `410 GONE` si expirée. |
| `POST` | `/ai/proposals/:id/reject` | USER | Nat. | Rejette. |
| `POST` | `/ai/transcriptions` | USER | Opt. | Audio `multipart/form-data` → texte ; audio supprimé après traitement. |
| `GET` | `/ai/inbound-messages` | USER | — | Messages entrants (WhatsApp) et leur traitement. |
| `POST` | `/ai/inbound-messages/:id/process` | USER | **Oblig.** | Retraite un message en capture ou proposition. |

La liaison du numéro WhatsApp passe par `POST /integrations/whatsapp/connect` (vérification par code).

### 14.18 M16 Administration SaaS, quotas, suppression et export de compte (PHASE-17)

| Méthode | Route | Rôle | Idem. | Description |
|---|---|---|---|---|
| `GET` | `/me/usage` | USER | — | Consommation et quotas de l'utilisateur. |
| `GET` | `/me/deletion-request` | USER | — | État de la demande de suppression. |
| `POST` | `/me/deletion-request` | USER R | **Oblig.** | Demande → `202` ; délai de grâce 7 jours ; e-mail de confirmation. |
| `DELETE` | `/me/deletion-request` | USER | Nat. | Annule pendant le délai de grâce. |
| `GET` | `/admin/users` | ADMIN | — | Métadonnées de comptes seulement : e-mail, inscription, statut, rôle, dernière connexion (ADR-002). |
| `GET` | `/admin/users/:id` | ADMIN | — | Métadonnées + volumétrie agrégée (`usage_counters`). Aucun contenu. |
| `POST` | `/admin/users/:id/suspend` | ADMIN R M | Nat. | Suspension `{ reason }` ; révoque les sessions. |
| `POST` | `/admin/users/:id/reactivate` | ADMIN R M | Nat. | Réactivation. |
| `POST` | `/admin/users/:id/revoke-sessions` | ADMIN R M | Nat. | Révocation de toutes les sessions d'un compte (incident). |
| `GET` | `/admin/metrics` | ADMIN | — | Indicateurs agrégés de plateforme (inscriptions, actifs, volumes, erreurs, files). |
| `GET` | `/admin/feature-flags` | ADMIN | — | Drapeaux (`feature_flags`). |
| `PATCH` | `/admin/feature-flags/:key` | ADMIN R | — | Active ou désactive un drapeau (coupure IA, inscriptions). |

L'export complet du compte utilise `POST /exports` avec `scope: ACCOUNT`. **Aucune** route d'usurpation d'identité ni de lecture de données d'un autre utilisateur n'existe ou ne doit être ajoutée (`SECURITY.md` §7.2).

---

## 15. Webhooks entrants

Règles de sécurité complètes : `SECURITY.md` §12. Contrat HTTP :

1. Route unique `POST /api/v1/webhooks/:provider` ; `provider` en liste blanche (`google-calendar` en PHASE-14, `whatsapp` en PHASE-16) ; inconnu → `404`.
2. Corps **brut** (`express.raw`, 256 Kio max) : la signature est vérifiée avant toute analyse JSON.
3. Pas de session, pas de cookie, pas de `X-Requested-With`, pas d'`Idempotency-Key` : l'idempotence repose sur `(provider, external_event_id)` dans `webhook_events`.
4. Réponses :

| Situation | Réponse |
|---|---|
| Signature absente ou invalide | `401 WEBHOOK_SIGNATURE_INVALID` (corps d'erreur standard, sans détail). |
| Horodatage hors tolérance | `401 WEBHOOK_SIGNATURE_INVALID`. |
| Événement déjà reçu | `200` sans retraitement. |
| Destinataire inconnu (canal ou numéro non lié) | `200` ; abandon journalisé. |
| Événement accepté | `200` (corps vide) en moins de 2 s ; traitement asynchrone en job portant `userId`. |
| Corps trop gros | `413`. |
| Surcharge | `429` ou `503` : le fournisseur réessaie. |

5. `GET /api/v1/webhooks/:provider` ne sert qu'au défi de vérification du fournisseur (WhatsApp : renvoie `hub.challenge` si `hub.verify_token` correspond, comparaison à temps constant) ; sinon `403`.
6. Google Calendar : le corps est vide par conception ; seul l'en-tête `X-Goog-Resource-State` déclenche une resynchronisation incrémentale via l'API Google (`syncToken`).
7. Les automatisations ne sont **pas** déclenchées par webhook public arbitraire : un système externe (n8n) appelle `POST /automations/:id/run` avec une clé d'API de portée `automations:run`.

---

## 16. Écarts par rapport à `PRODUCT_SPEC.md` §16 et points à arbitrer

| # | Cahier §16 | Ce document | Motif |
|---|---|---|---|
| A1 | `POST /auth/refresh` | Supprimé | ADR-006. |
| A2 | `/workspaces/*` | Supprimé | ADR-001. |
| A3 | `GET /users/me` | `GET /me` | Convention imposée. |
| A4 | `/clients`, `/invoices` | `/pro/clients`, `/pro/invoices` | Module M09 désactivable. |
| A5 | `/applications`, `/domains`, `/servers`, `/service-subscriptions` | `/dev/*`, `/dev/services` | Zone Dev ADMIN (ADR-002). |
| A6 | `/vault/items` | `/dev/vault/items` | Coffre en zone Dev (ADR-002, ADR-019). |
| A7 | `GET /finance/summary` | `GET /finance/reports/summary` | Convention imposée (`/finance/reports`). |
| A8 | `POST /integrations/:provider/connect` | Conservé, + `GET …/callback` | Flux OAuth complet. |

**Extensions à valider** (hors liste de préfixes imposée, sous un préfixe existant ou indispensables) : `GET /health/live`, `GET /health/ready` ; `GET /finance/currencies` ; `/admin/feature-flags` ; `/ai/inbound-messages` et `/ai/transcriptions` (M15 sous `/ai`) ; `/me/usage`, `/me/deletion-request`.

**Points ouverts :** l'import de données (§4.25 du cahier) n'a ni module ni phase dans `PRODUCT_SCOPE.md` et n'a donc aucun endpoint ici ; la portée des clés d'API (ADMIN seul selon M13) empêche un `USER` de connecter n8n (voir `SECURITY.md` §22).
