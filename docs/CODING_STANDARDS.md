# ORBIT : normes de code

- **Statut :** référence. Subordonné à `DECISIONS.md` ; les règles marquées **[lint]** sont vérifiées automatiquement et bloquent la CI.
- **Responsabilité :** à quoi doit ressembler le code : TypeScript, nommage, tailles, immutabilité, erreurs, logs, commentaires, imports, outillage, Git, revue.
- **Documents liés :** `ARCHITECTURE.md` (emplacements, dépendances), `DESIGN_PATTERNS.md` (patrons), `TESTING.md` (tests et couverture), `API.md` (format HTTP), `DATA_MODEL.md` (schéma), `DEVELOPMENT_METHOD.md` (déroulé d'une phase), `SECURITY.md`.

> Une règle de ce document ne se contourne pas par un commentaire `eslint-disable`. Toute exception passe par une ligne d'override dans `packages/config/eslint/` avec justification, relue en revue.

---

## 1. Langues (ADR-022)

| Élément | Langue |
|---|---|
| Identifiants, noms de fichiers, tables, colonnes, enums, codes d'erreur, clés i18n, messages de commit | Anglais |
| Commentaires de code, TSDoc, documentation `docs/`, textes d'interface | Français |
| Messages de log (`msg`) | Anglais, sous forme d'événement (`transfer.created`) |

---

## 2. TypeScript

### 2.1 Configuration commune (`packages/config/tsconfig/base.json`)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true
  }
}
```

### 2.2 Variantes

| Fichier | Étend `base.json` avec | Utilisé par |
|---|---|---|
| `node.json` | `"module": "Node16"`, `"moduleResolution": "Node16"`, `"experimentalDecorators": true`, `"emitDecoratorMetadata": true`, `"exactOptionalPropertyTypes": false` (types générés par Prisma incompatibles), `"outDir": "dist"` | `apps/api` |
| `react.json` | `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"jsx": "react-jsx"`, `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, `"verbatimModuleSyntax": true`, `"noEmit": true` | `apps/web` |
| `library.json` | `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"declaration": true`, `"verbatimModuleSyntax": true` | `packages/contracts`, `packages/money` (build tsup ESM + CJS) |

### 2.3 Règles d'usage

- **Faire :** typer explicitement le retour des fonctions exportées, des méthodes publiques de services, repositories, façades et ports.
- **Faire :** `unknown` pour toute donnée externe, puis `Schema.parse()` (Zod) avant usage.
- **Faire :** `satisfies` pour vérifier une constante sans élargir son type (`as const satisfies Record<…>`).
- **Faire :** exhaustivité des `switch` sur une union, terminée par `assertNever(x)` **[lint `switch-exhaustiveness-check`]**.
- **Faire :** types de marque pour les identifiants sensibles aux confusions quand utile (`StorageKey`, `CivilDate`).
- **Ne pas faire :** `any` **[lint]**, `as` vers un type non lié (`as unknown as T`) hors adaptateur de test, `!` (non-null assertion) hors cas prouvé localement et commenté, `@ts-ignore` **[lint]** (seul `@ts-expect-error` avec description est toléré dans les tests), `enum` TypeScript **[lint]** (utiliser `z.enum` ou un objet `as const`), `namespace`.

---

## 3. Nommage

### 3.1 Code TypeScript

| Élément | Convention | Exemple |
|---|---|---|
| Fichier | kebab-case + suffixe de rôle | `transfers.service.ts`, `idea-card.tsx`, `tenant-scope.extension.ts` |
| Suffixes de rôle (API) | `.module`, `.controller`, `.service`, `.repository`, `.query-service`, `.policy`, `.facade`, `.dto`, `.port`, `.adapter`, `.processor`, `.guard`, `.interceptor`, `.filter`, `.decorator`, `.extension` | `vault-items.policy.ts` |
| Suffixes de rôle (contrats / front) | `.schema.ts` ; `.keys.ts`, `.queries.ts` ; composants sans suffixe | `transfers.schema.ts`, `ideas.keys.ts` |
| Tests | `.spec.ts` (unitaire), `.int-spec.ts` (intégration), `.e2e.ts` (Playwright) | `ledger.spec.ts` |
| Classe | PascalCase, suffixe du rôle | `TransfersService`, `S3StorageAdapter` |
| Interface / type | PascalCase, **sans** préfixe `I` ; ports suffixés `Port` | `StoragePort`, `TransferView` |
| Schéma Zod | PascalCase + `Schema` ; type dérivé sans suffixe | `CreateTransferInputSchema` → `CreateTransferInput` |
| Entrées / sorties | `Create<X>Input`, `Update<X>Input`, `<X>ListQuery`, `<X>View`, `<X>ListResponse` | `IdeaView` |
| Fonction, variable, méthode | camelCase, verbe pour les fonctions | `buildTransfer`, `toTransferView` |
| Booléen | préfixe `is`, `has`, `can`, `should` | `isOverdue`, `canReveal` |
| Constante de module | SCREAMING_SNAKE_CASE | `REAUTH_WINDOW_MS`, `IDEA_SELECT` |
| Token d'injection | SCREAMING_SNAKE_CASE, `Symbol` | `STORAGE`, `CLOCK` |
| Valeur d'enum | SCREAMING_SNAKE_CASE | `MOBILE_MONEY`, `PARTIALLY_PAID` |
| Composant React | PascalCase dans un fichier kebab-case, export nommé | `export function IdeaCard()` dans `idea-card.tsx` |
| Hook React | `use` + PascalCase | `useCreateIdea` |
| Unités dans les noms | suffixe explicite | `amountMinor`, `timeoutMs`, `sizeBytes`, `expiresInSeconds` |

### 3.2 Base de données (Prisma + PostgreSQL)

| Élément | Convention | Exemple |
|---|---|---|
| Table | snake_case, **pluriel** (nom canonique de `PRODUCT_SCOPE.md` §4) | `ledger_entries` |
| Modèle Prisma | PascalCase singulier + `@@map` | `model LedgerEntry { … @@map("ledger_entries") }` |
| Colonne | snake_case ; champ Prisma camelCase + `@map` | `amountMinor BigInt @map("amount_minor")` |
| Clé primaire | `id` UUID (v7, généré par l'application) | `id String @id @db.Uuid` |
| Clé étrangère | `<entité_singulier>_id` | `account_id`, `parent_transaction_id` |
| Propriétaire | `user_id`, présent sur toute table métier | — |
| Instant | `<verbe>_at`, `timestamptz` | `created_at`, `validated_at`, `archived_at` |
| Date civile | `<nom>_on` ou `<nom>_date`, type `date` | `occurred_on`, `due_date` |
| Montant | `<nom>_minor` `BIGINT` + `currency CHAR(3)` | `amount_minor`, `opening_balance_minor` |
| Booléen | `is_` / `has_` | `is_archived` |
| Type enum PostgreSQL | snake_case singulier ; type Prisma PascalCase ; valeurs SCREAMING_SNAKE_CASE | `transaction_status` / `TransactionStatus` / `VALIDATED` |
| Index | `<table>_<colonnes>_idx` | `tasks_user_id_due_date_idx` |
| Unique | `<table>_<colonnes>_key` | `idempotency_keys_user_id_key_key` |
| Check | `<table>_<règle>_chk` | `reminders_single_target_chk` |
| FK | `<table>_<colonnes>_fkey` | `ledger_entries_user_id_account_id_fkey` |
| Migration | `prisma migrate dev --name phaseXX_<slug>` | `20261020093000_phase05_finance_core` |

### 3.3 API et messages

| Élément | Convention | Exemple |
|---|---|---|
| Route | `/api/v1/<module>/<ressource>` au pluriel kebab-case ; action non-CRUD en sous-ressource verbale | `/finance/recurring`, `/ideas/:id/convert-to-project` |
| Paramètres de requête et champs JSON | camelCase | `?dueBefore=2026-11-01`, `amountMinor` |
| Code d'erreur | `<DOMAINE>_<RAISON>` SCREAMING_SNAKE_CASE (§6) | `FINANCE_INSUFFICIENT_FUNDS` |
| Action d'audit | `<module>.<entité>.<verbe_au_passé>` | `finance.transfer.created` |
| Type de job / événement d'outbox | `<module>.<entité>.<verbe>` | `reminders.reminder.fire` |
| Variable d'environnement | SCREAMING_SNAKE_CASE, préfixe de groupe | `S3_BUCKET`, `MAIL_FROM` |
| Clé i18n | `<feature>.<écran>.<élément>` | `finance.transfer.submit` |

---

## 4. Tailles et complexité

| Mesure | Cible | Plafond bloquant | Règle |
|---|---|---|---|
| Lignes par fichier source | ≤ 400 | 800 | **[lint]** `max-lines` : warn 400, error 800 (lignes vides et commentaires exclus) |
| Lignes par fonction | ≤ 30 | 50 | **[lint]** `max-lines-per-function` : error 50 (tests exclus) |
| Paramètres | ≤ 3 | 4 | **[lint]** `max-params` : 4 ; au-delà, un objet nommé (constructeurs Nest exclus) |
| Imbrication | ≤ 3 | 4 | **[lint]** `max-depth` : 4 |
| Complexité cyclomatique | ≤ 8 | 12 | **[lint]** `complexity` : 12 |
| Méthodes publiques par service | ≤ 8 | — | Au-delà, découper par cas d'usage (revue) |

- **Faire :** retours anticipés (`if (!x) throw …`) plutôt qu'imbrication.
- **Faire :** extraire une fonction de domaine dès qu'un calcul dépasse 10 lignes dans un service.
- **Ne pas faire :** contourner la taille en tassant le code ; Prettier formate tout.

---

## 5. Immutabilité

- **Faire :** `const` partout **[lint `prefer-const`]** ; `readonly` sur les propriétés de classe injectées et les champs des types de domaine **[lint `prefer-readonly`]** ; `ReadonlyArray<T>` / `readonly T[]` en paramètre.
- **Faire :** produire de nouveaux objets (`{ ...task, status }`, `[...items, item]`, `map`, `filter`, `toSorted`).
- **Faire :** les value objects (`Money`) sont gelés (`Object.freeze`).
- **Ne pas faire :** réassigner ou muter un paramètre **[lint `no-param-reassign` avec `props: true`]** ; `push`/`splice`/`sort` sur un tableau reçu ; muter un objet renvoyé par TanStack Query ou par un repository.
- **Toléré :** accumulateur local dans une boucle d'une fonction pure (ex. `Map` construite puis renvoyée), jamais exposé avant la fin de la construction.

---

## 6. Gestion des erreurs

### 6.1 Codes d'erreur stables

- **Source unique :** `packages/contracts/src/errors/error-codes.ts`.

```ts
export const ErrorCode = {
  // génériques
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  CSRF_REJECTED: 'CSRF_REJECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  MODULE_DISABLED: 'MODULE_DISABLED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  IDEMPOTENCY_IN_PROGRESS: 'IDEMPOTENCY_IN_PROGRESS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // auth
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_REAUTH_REQUIRED: 'AUTH_REAUTH_REQUIRED',
  // finance
  FINANCE_ACCOUNT_NOT_FOUND: 'FINANCE_ACCOUNT_NOT_FOUND',
  FINANCE_INSUFFICIENT_FUNDS: 'FINANCE_INSUFFICIENT_FUNDS',
  // … un bloc par module, ajouté par la phase qui crée le module
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
```

- **Faire :** un code par **cause** que le client peut traiter différemment ; préfixe = domaine (`AUTH`, `FINANCE`, `PRO`, `TASK`, `VAULT`…).
- **Faire :** chaque code a une traduction dans `apps/web/src/i18n/fr/errors.json` **[test de contrat : aucune clé manquante]**.
- **Ne pas faire :** renommer ou réutiliser un code publié. Un code obsolète reste et se marque `/** @deprecated depuis PHASE-XX */`.

### 6.2 Où et comment

| Couche | Règle |
|---|---|
| Domaine | Renvoie `Result` pour une règle violée ; lève uniquement pour un invariant de programmation (`assertNever`). |
| Service | Lève une `DomainError` (`NotFoundError`, `RuleViolationError`, `ConflictError`, `ForbiddenError`). Jamais `HttpException`. |
| Repository | Laisse remonter les erreurs Prisma ; le mapping est central (`prisma-error.mapper.ts`). |
| Contrôleur | Aucun `try/catch`. |
| Adaptateur externe | Convertit l'erreur du fournisseur en erreur de plateforme (`ExternalServiceError` avec `provider`, `retryable`), avec `cause`. Timeout explicite sur chaque appel réseau (10 s par défaut). |
| Processor | Erreur `retryable` ⇒ relancée (retry BullMQ) ; sinon job marqué en échec définitif et journalisé en `error`. |
| Front | Affiche le message traduit du `code` ; jamais le texte brut du serveur. |

- **Faire :** `catch (error: unknown)` puis affinage ; relancer avec `{ cause: error }`.
- **Ne pas faire :** `catch` vide ou qui journalise sans relancer ni traiter **[lint `no-empty`, revue]** ; erreur transformée en `null` silencieux ; message interne (SQL, pile, nom de table) dans une réponse HTTP.

---

## 7. Logs

- **Outil :** `PinoLogger` injecté (`nestjs-pino`). **[lint `no-console`]** partout, sauf scripts de `infra/scripts/`.
- **Format :** `this.logger.info({ transferId, durationMs }, 'transfer.created')` : objet de contexte d'abord, puis nom d'événement stable en anglais.

| Niveau | Usage | Production |
|---|---|---|
| `fatal` | Le processus va s'arrêter (configuration invalide, base injoignable au démarrage) | oui |
| `error` | Échec inattendu : réponse 5xx, job en échec définitif, adaptateur externe hors service | oui |
| `warn` | Anomalie gérée : retry de job, rate limit atteint, accès croisé détecté (404), signature de webhook invalide | oui |
| `info` | Cycle de vie : démarrage, requête terminée (pino-http), job terminé, migration appliquée | oui |
| `debug` | Diagnostic de développement | non |
| `trace` | Jamais dans un commit | non |

**Ne jamais journaliser** (ni en message, ni en contexte, ni dans une erreur sérialisée) : mots de passe, jetons de session, jetons OAuth, clés d'API, codes TOTP et de récupération, secrets du coffre (chiffrés ou non), clés DEK/KEK, cookies, e-mails, numéros de téléphone, noms de clients, contenus de notes, de journal, de documents ou de messages, libellés et montants de transactions. Journaliser des **identifiants** (`userId`, `transactionId`), jamais les valeurs.

Redaction centrale (`platform/observability/redaction.ts`), configurée une fois, testée par un test unitaire :

```ts
export const REDACT_PATHS = [
  'req.headers.cookie', 'req.headers.authorization', 'req.headers["x-api-key"]', 'res.headers["set-cookie"]',
  '*.password', '*.currentPassword', '*.newPassword', '*.token', '*.accessToken', '*.refreshToken',
  '*.apiKey', '*.secret', '*.totpCode', '*.recoveryCode', '*.ciphertext', '*.dek', '*.kek', '*.email', '*.phone',
] as const;
```

La redaction est un filet de sécurité, pas une autorisation : un objet métier complet ne se passe jamais au logger. Les corps de requête et de réponse ne sont **pas** journalisés.

---

## 8. Commentaires

- **Faire :** expliquer le **pourquoi** (règle métier, ADR, contrainte externe) : `// Retard dérivé, jamais stocké (ADR-020).`
- **Faire :** TSDoc sur chaque port, façade et fonction exportée de `packages/money` et de `domain/` : contrat, unités, erreurs possibles.
- **Faire :** `// TODO(PHASE-XX): <action>` uniquement pour un élément planifié dans la fiche de cette phase **[lint : regex de format]**.
- **Ne pas faire :** paraphraser le code ; laisser du code commenté **[revue]** ; `FIXME`/`HACK` sans ticket de phase ; commentaire qui contredit une ADR.

---

## 9. Imports et alias

| Alias | Cible | Disponible dans |
|---|---|---|
| `@orbit/contracts`, `@orbit/contracts/<module>` | `packages/contracts` | api, web |
| `@orbit/money` | `packages/money` | api, web, contracts (types uniquement) |
| `@platform/*` | `apps/api/src/platform/*` | api |
| `@modules/<module>` | `apps/api/src/modules/<module>/index.ts` **uniquement** | api |
| `@test/*` | `apps/api/test/*` | tests api |
| `@/*` | `apps/web/src/*` | web |

Règles :
- **Faire :** ordre des groupes, séparés par une ligne vide **[lint `import/order`]** : modules Node (`node:`), dépendances externes, `@orbit/*`, `@platform/*`, `@modules/*`, `@/*`, relatifs.
- **Faire :** `import type` pour un import de type pur **[lint `consistent-type-imports`]**. Exception dans `apps/api` : les classes injectées par constructeur s'importent en valeur (métadonnées de décorateurs).
- **Faire :** exports nommés uniquement **[lint `import/no-default-export`]**, sauf fichiers de configuration d'outils (`vite.config.ts`, `eslint.config.mjs`) et pages React chargées par `lazy()`.
- **Ne pas faire :** importer `@modules/<m>/<chemin interne>` **[lint + dependency-cruiser]** ; relatif remontant de plus de deux niveaux (`../../../`) **[lint]** ; fichier barrel `index.ts` ailleurs qu'à la racine d'un module, d'une feature ou d'un package ; dépendance circulaire **[dependency-cruiser]**.

---

## 10. ESLint et Prettier

### 10.1 Prettier (`packages/config/prettier`)

```js
export default { printWidth: 110, singleQuote: true, trailingComma: 'all', semi: true, arrowParens: 'always', endOfLine: 'lf' };
```

Formatage non négociable, appliqué par `pnpm format` et vérifié en CI (`prettier --check`).

### 10.2 Règles clés (`packages/config/eslint/rules-orbit.mjs`)

Base : `@typescript-eslint/strict-type-checked` + `stylistic-type-checked`, `eslint-plugin-import`, `eslint-plugin-react-hooks` et `jsx-a11y` (web).

| Règle | Configuration | Portée |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | error | tout |
| `@typescript-eslint/no-floating-promises`, `no-misused-promises` | error | tout |
| `@typescript-eslint/switch-exhaustiveness-check` | error | tout |
| `@typescript-eslint/consistent-type-imports` | error | tout (voir §9 pour l'API) |
| `@typescript-eslint/prefer-readonly` | error | tout |
| `@typescript-eslint/ban-ts-comment` | `ts-ignore` interdit, `ts-expect-error` avec description | tout |
| `no-restricted-syntax` : `TSEnumDeclaration` | error | tout |
| `no-console` | error | tout sauf `infra/scripts` |
| `no-param-reassign` | `{ props: true }` | tout |
| `max-lines`, `max-lines-per-function`, `max-params`, `max-depth`, `complexity` | §4 | tout sauf tests |
| **SQL brut** : `no-restricted-syntax` sur `MemberExpression[property.name=/^\$(queryRaw\|executeRaw)$/]` | error | tout **sauf** `apps/api/src/platform/database/raw/**` (ADR-007-5) |
| **SQL non sûr** : `MemberExpression[property.name=/^\$(queryRawUnsafe\|executeRawUnsafe)$/]` et `Prisma.raw` | error | **partout, sans exception** |
| **findUnique** : `CallExpression[callee.property.name=/^findUnique(OrThrow)?$/]` | error | `apps/api/src/modules/**` (ADR-007-3) |
| **Client non scopé** : `MemberExpression[property.name='unscoped']` | error | tout sauf `platform/auth`, `modules/auth`, `modules/users`, `modules/admin`, `platform/database` |
| **Montants** : `CallExpression[callee.name=/^(Number\|parseFloat\|parseInt)$/]` dont l'argument (identifiant ou propriété) correspond à `/amount\|minor\|total\|balance\|price\|fee\|cost/i` | error | tout (ADR-008) |
| **Montants (strict)** : `Number`, `parseFloat`, `parseInt`, `.toFixed()`, `Math.round` interdits sans condition | error | `packages/money/**`, `modules/finance/**`, `modules/pro/**`, `contracts/src/finance/**`, `contracts/src/pro/**`, `web/src/features/finance/**`, `web/src/features/pro/**` |
| **Horloge et identifiants** : `new Date()` sans argument, `Date.now()`, `crypto.randomUUID()`, import de `uuid` | error | `apps/api/src/modules/**` (utiliser `ClockPort`, `IdGeneratorPort`) |
| **Environnement** : `no-restricted-properties` sur `process.env` | error | tout sauf `apps/api/src/platform/config/**`, fichiers de configuration d'outils |
| `no-restricted-imports` : `@prisma/client`, `@prisma/*`, `@nestjs/*`, `react`, `apps/*` | error | `packages/contracts/**` |
| `no-restricted-imports` : toute dépendance externe | error | `packages/money/**` |
| `no-restricted-imports` : `@prisma/client` | error | `apps/api/src/modules/**` sauf `*.repository.ts`, `*.query-service.ts` (types `Prisma.*Select` tolérés dans ces fichiers seulement) |
| `no-restricted-imports` : `@nestjs/*`, `@prisma/*`, `@platform/*` sauf `@platform/errors` | error | `apps/api/src/modules/**/domain/**` |
| `no-restricted-imports` : `bullmq`, `@aws-sdk/*`, `nodemailer`, `googleapis`, `@anthropic-ai/sdk`, `libsodium-wrappers*` | error | tout sauf l'adaptateur correspondant dans `platform/` ou `modules/<m>/adapters/` |
| `no-restricted-imports` : `class-validator`, `class-transformer`, `moment` | error | tout |
| `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps` | error | web |
| `jsx-a11y/recommended` | error | web |

Toute règle `no-restricted-*` porte un `message` qui cite l'ADR ou la section concernée, pour que l'IA corrige au bon endroit.

### 10.3 Autres contrôles automatiques

| Outil | Commande | Bloquant |
|---|---|---|
| TypeScript | `pnpm typecheck` (`tsc --noEmit` par projet) | oui |
| dependency-cruiser | `pnpm depcruise` (règles `ARCHITECTURE.md` §5) | oui |
| Prisma | `prisma validate` + `prisma migrate diff` (aucune dérive entre schéma et migrations) | oui |
| OpenAPI | génération + diff avec le fichier versionné | oui (changement non annoncé) |
| Audit des dépendances | `pnpm audit --prod` (sévérité haute) | oui |

---

## 11. Prisma, migrations et SQL

- **Faire :** une migration par phase au minimum, nommée `phaseXX_<slug>` ; plusieurs si la phase comporte des étapes indépendantes.
- **Faire :** compléter à la main les éléments que Prisma ne génère pas (`CHECK`, index partiels, extensions `unaccent`/`pg_trgm`, index GIN) via `--create-only`, avec un commentaire SQL citant l'ADR.
- **Faire :** chaque fonction de `platform/database/raw/` est typée en entrée et en sortie, utilise exclusivement le tag `Prisma.sql` paramétré, filtre explicitement par `user_id` (passé depuis `TenantContext`, jamais depuis le client) et possède un test d'intégration d'isolation.
- **Ne pas faire :** modifier une migration déjà appliquée sur un environnement partagé ; `prisma db push` hors prototype local jetable ; `onDelete: Cascade` sur une table financière (`Restrict`) ; concaténer une chaîne dans du SQL.

---

## 12. Tests (rappel minimal)

Stratégie complète : `TESTING.md`. Conventions de code :
- nom de test descriptif au présent : `it('rejects a transfer between the same account')` ;
- structure Arrange / Act / Assert, une intention par test ;
- pas de `sleep` : `FixedClock`, `InMemoryJobQueue`, attentes explicites ;
- fabriques (`test/factories/`) plutôt que littéraux répétés ;
- chaque route a son test d'isolation généré (ADR-021) ; une route ajoutée sans ce test fait échouer la CI.

---

## 13. Git

### 13.1 Branches

- `main` : toujours déployable ; protégée (CI verte obligatoire, pas de push direct).
- Une branche par phase : `phase-XX/<slug>` (ex. `phase-05/finance-coeur`), créée depuis `main` à jour.
- Correctif hors phase : `fix/<slug>`.

### 13.2 Commits (Conventional Commits)

```
<type>(<scope>): <description impérative en anglais, ≤ 72 caractères>

<corps facultatif : pourquoi, ADR concernée>

Refs: PHASE-05/T3
```

- **Types :** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `build`.
- **Scopes :** nom de module API (`finance`, `ideas`, `auth`…), `platform`, `web`, `contracts`, `money`, `infra`, `docs`, `deps`.
- **Un commit par tâche** du découpage de la fiche de phase (T1, T2…), contenant le code, ses tests et la documentation touchée. Le pied `Refs: PHASE-XX/Tn` est obligatoire.
- Les commits sont faits sous l'identité du propriétaire du dépôt, **sans** trailer `Co-Authored-By`.
- **Ne pas faire :** commit « WIP », commit mêlant deux tâches, commit qui casse la compilation ou les tests, secret ou `.env` commité (hook `gitleaks` en pre-commit et en CI).

### 13.3 Fusion

- Une pull request par phase, titrée `PHASE-XX: <titre>`, décrivant le périmètre, les écarts éventuels et le lien vers `docs/progress/PHASE-XX-REPORT.md`.
- Fusion par **rebase** (historique linéaire, commits de tâche conservés). Pas de squash d'une phase entière.

---

## 14. Revue de code obligatoire

Aucune tâche n'est terminée sans revue. Ordre :

1. **Auto-vérification** : `pnpm lint && pnpm typecheck && pnpm depcruise && pnpm test` verts en local.
2. **Agents de revue** (cf. section 10 de la fiche de phase) :

| Changement | Agent obligatoire |
|---|---|
| Tout code TypeScript | `typescript-reviewer` (ou `code-reviewer`) |
| Composants React | `react-reviewer` |
| Auth, sessions, coffre, crypto, webhooks, upload, intégrations, IA | `security-reviewer` |
| Migration, index, requête de `platform/database/raw/` | `database-reviewer` |
| Domaine finance, `packages/money` | `tdd-guide` (invariants fast-check, couverture 100 %) |

3. **Correction** des constats CRITICAL et HIGH avant commit ; MEDIUM corrigés ou consignés dans le rapport de phase.

### Liste de contrôle de revue

- [ ] Aucun `user_id` venant du client ; ressource d'autrui ⇒ 404 ; test d'isolation présent.
- [ ] Entrées et sorties validées par un schéma de `@orbit/contracts` ; aucune entité Prisma exposée.
- [ ] Montants en `bigint` / chaîne ; arithmétique via `@orbit/money` ; aucun flottant.
- [ ] Écritures multiples dans une `@Transactional()` ; aucun appel externe dans la transaction.
- [ ] Changement de statut via la machine à états ; action critique auditée.
- [ ] Route de création financière marquée `@Idempotent()`.
- [ ] Aucun secret, PII ou contenu privé dans les logs, jobs, erreurs ou fixtures.
- [ ] Ports utilisés pour horloge, identifiants, stockage, mail, file de jobs.
- [ ] Fichiers ≤ 800 lignes, fonctions ≤ 50 lignes, imbrication ≤ 4.
- [ ] Nouvelle arête inter-modules déclarée dans `ARCHITECTURE.md` §5.2 et dependency-cruiser.
- [ ] Codes d'erreur ajoutés dans `contracts` et traduits en français.
- [ ] Documentation impactée mise à jour dans le même commit.
