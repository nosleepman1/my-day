# ORBIT : architecture frontend

- **Statut :** référence. Applique ADR-004, ADR-006, ADR-008, ADR-010, ADR-016, ADR-022, ADR-023 et ADR-024 de `DECISIONS.md`.
- **Responsabilité :** structure du code de `apps/web`, client HTTP, état serveur, formulaires, montants, dates, routage, PWA, hors ligne, performance, tests et conventions du front.
- **Ne couvre pas :** l'identité visuelle, les composants et les parcours UX (`DESIGN_SYSTEM.md`), les endpoints et le format des erreurs (`API.md`, qui fait foi en cas d'écart), les règles de calcul (`FINANCE_RULES.md`).
- **Documents liés :** `DECISIONS.md`, `PRODUCT_SCOPE.md`, `ARCHITECTURE.md`, `CODING_STANDARDS.md`, `API.md`, `DESIGN_SYSTEM.md`, `SECURITY.md`, `TESTING.md`.
- **Ordre de priorité :** `DECISIONS.md` > `PRODUCT_SCOPE.md` > ce document > `PRODUCT_SPEC.md` (§7.3 est remplacé par la section 2 ci-dessous).

Les mots **DOIT**, **NE DOIT PAS** et **PEUT** sont prescriptifs. Tout écart exige une nouvelle ADR.

---

## 1. Stack

| Rôle | Choix imposé | Remarques |
|---|---|---|
| Langage | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true` | `any` interdit (lint). `unknown` + garde de type à la place. |
| UI | React 18+ (fonctionnel uniquement) | Pas de composant classe, sauf l'`ErrorBoundary` racine si nécessaire. |
| Build | Vite | Alias `@/` → `apps/web/src`. |
| Styles | Tailwind CSS, tokens CSS de `DESIGN_SYSTEM.md` | Pas de CSS-in-JS. Pas de couleur en dur dans les classes (`bg-[#...]` interdit par lint). |
| Composants | shadcn/ui (sources copiées dans `components/ui`), Radix UI | On modifie les sources shadcn copiées ; on n'ajoute pas une seconde librairie de composants. |
| État serveur | TanStack Query v5 | Seule source de vérité des données de l'API. |
| Routage | React Router (data router, `createBrowserRouter`) | Routes paresseuses (`lazy`). |
| Formulaires | React Hook Form + `@hookform/resolvers/zod` | Schémas importés de `@orbit/contracts` (ADR-010). |
| Montants | `@orbit/money` | Seul module autorisé à parser, calculer et formater un montant (ADR-008). |
| Dates | `date-fns` v4 + `@date-fns/tz` | Fuseau de l'utilisateur, jamais celui de l'appareil (section 8). |
| PWA | `vite-plugin-pwa` (Workbox, stratégie `injectManifest`) | Service worker écrit en TS dans `src/sw.ts`. |
| Hors ligne | `idb` (IndexedDB) | File de capture uniquement (section 11). |
| i18n | `i18next` + `react-i18next` | `fr` par défaut et seule langue livrée ; aucune chaîne d'interface en dur dans le JSX (lint `i18next/no-literal-string` sur `features/` et `components/`). |
| Icônes | `lucide-react` | Import nommé, jamais l'objet complet. |
| Notifications d'écran | `sonner` (toasts, via shadcn) | Voir `DESIGN_SYSTEM.md` §7. |
| Tests | Vitest, Testing Library, MSW, Playwright, `@axe-core/playwright` | Voir section 15. |

Interdits : Redux, Zustand pour des données serveur, Axios, Moment.js, Lodash complet, toute librairie de formatage monétaire autre que `@orbit/money`, `localStorage` pour des données métier.

Un état client global léger (préférence « masquer les soldes », ouverture de la feuille de capture) PEUT utiliser un contexte React ou un store Zustand **sans persistance de données métier**.

## 2. Arborescence de `apps/web/src`

```text
apps/web/src/
├── main.tsx                     # point d'entrée : providers + router
├── sw.ts                        # service worker (injectManifest)
├── app/
│   ├── providers.tsx            # QueryClientProvider, I18nextProvider, ThemeProvider, Toaster
│   ├── query-client.ts          # configuration TanStack Query (section 4)
│   ├── router.tsx               # createBrowserRouter, assemble routes/*
│   ├── session/                 # SessionProvider, useSession(), useMe()
│   ├── guards/                  # RequireAuth, RequireRole, RequireModule, RequireOnboarding
│   └── error-boundary.tsx
├── routes/                      # déclarations de routes uniquement (aucune logique métier)
│   ├── public.routes.tsx        # /login, /register, /verify-email, /forgot-password, /reset-password
│   ├── app.routes.tsx           # routes authentifiées, shell
│   ├── dev.routes.tsx           # /dev/*  (ADMIN)
│   └── admin.routes.tsx         # /admin/* (ADMIN)
├── features/
│   ├── auth/
│   ├── onboarding/
│   ├── dashboard/
│   ├── capture/                 # QuickCaptureSheet, parseur local, file hors ligne
│   ├── ideas/
│   ├── tasks/
│   ├── projects/
│   ├── notes/
│   ├── finance/                 # comptes, transactions, transferts, rapprochement
│   ├── debts/
│   ├── calendar/
│   ├── goals/
│   ├── pro/                     # clients, contrats, factures (module désactivable)
│   ├── automations/
│   ├── integrations/
│   ├── search/
│   ├── settings/
│   ├── dev/                     # zone Dev : inventaire, coffre (ADMIN)
│   └── admin/                   # console d'administration (ADMIN)
├── components/
│   ├── ui/                      # primitives shadcn/Radix (Button, Dialog, Sheet, Input…)
│   ├── layout/                  # AppShell, BottomNav, Sidebar, PageHeader, MoreMenu
│   ├── data-display/            # MoneyAmount, StatusBadge, EmptyState, ErrorState, DataList, DataTable
│   └── forms/                   # MoneyInput, DateInput, AccountPicker, CategoryPicker, FormField
├── lib/
│   ├── http/                    # client HTTP, ApiError, mapping des erreurs (section 3)
│   ├── query-keys.ts            # ré-export des factories de clés
│   ├── dates.ts                 # helpers fuseau / date civile (section 8)
│   ├── ids.ts                   # uuidv7() côté client
│   ├── offline/                 # base IndexedDB, file de capture, rejeu
│   └── i18n/                    # init i18next, fichiers fr/*.json
├── hooks/                       # hooks transverses : useOnlineStatus, useMediaQuery, useInstallPrompt
└── styles/
    ├── tokens.css               # variables CSS clair/sombre (DESIGN_SYSTEM.md §3)
    └── globals.css              # @tailwind, base, utilitaires
```

### 2.1 Structure d'un module `features/<module>/`

```text
features/finance/
├── api/          # fonctions d'appel HTTP + query key factory + hooks useQuery/useMutation
│   ├── finance.keys.ts
│   ├── accounts.api.ts
│   └── transactions.api.ts
├── components/   # composants propres au module
├── hooks/        # hooks propres au module (logique UI, pas d'appel HTTP direct)
├── pages/        # un fichier par écran routé, exporté pour React Router `lazy`
├── schemas/      # schémas Zod de formulaire DÉRIVÉS de @orbit/contracts (jamais redéfinis)
└── index.ts      # API publique du module
```

Règles :
- Un module **NE DOIT PAS** importer les fichiers internes d'un autre module ; il passe par son `index.ts`. Règle `import/no-restricted-paths` en CI.
- `components/` (racine) **NE DOIT PAS** importer depuis `features/`.
- Un appel HTTP n'existe que dans `features/*/api/` ou `lib/http/`. Un composant n'appelle jamais `fetch`.
- `routes/` ne contient que des objets de route et des `lazy(() => import(...))`.

## 3. Client HTTP

### 3.1 Principes

- Même origine (ADR-006) : base `/api/v1`. Aucune URL absolue d'API dans le code.
- Le cookie `__Host-orbit_sid` est HttpOnly : **le front ne le lit jamais** et ne stocke aucun jeton.
- `credentials: 'include'` sur toutes les requêtes.
- En-tête `X-Requested-With: orbit` sur **toutes** les requêtes (obligatoire pour les mutations ; on l'envoie partout pour simplifier).
- `Idempotency-Key` (UUIDv7 client) sur toute création financière et sur tout rejeu de la file hors ligne.
- Délai maximal : 15 s (`AbortSignal.timeout`), 60 s pour les uploads.
- Les réponses sont validées par le schéma de réponse de `@orbit/contracts` (`.parse`) en développement et en test ; en production, `.safeParse` + rapport d'erreur, sans bloquer l'affichage.

### 3.2 Format d'erreur attendu

Format défini par `API.md` :

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "details": [{ "path": ["amount"], "code": "too_small" }], "requestId": "…" } }
```

Le front s'appuie **uniquement sur `code`**. `message` sert au journal, jamais à l'affichage (le texte vient de `i18n` : clé `errors.<CODE>`).

### 3.3 Implémentation de référence

```ts
// lib/http/client.ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,          // enum importé de @orbit/contracts
    readonly details: readonly FieldIssue[] = [],
    readonly requestId?: string,
  ) { super(code); }
}
export class NetworkError extends Error {}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  skipAuthRedirect?: boolean;   // routes /auth/* : un 401 = identifiants invalides
};

export async function http<T>(path: string, schema: ZodType<T>, opts: RequestOptions = {}): Promise<T> {
  const res = await rawFetch(path, opts);                     // gère NetworkError + timeout
  if (res.ok) return parseBody(res, schema);

  const err = await toApiError(res);                          // lit { error: { code } }, code inconnu → 'UNKNOWN'
  if (err.status === 401 && !opts.skipAuthRedirect) {
    sessionEvents.emit('unauthenticated');                    // vide le cache, redirige /login?next=
    throw err;
  }
  if (err.code === 'REAUTH_REQUIRED') {
    await reauthGate.request();                               // ouvre la modale, résout après POST /auth/reauth réussi
    return http(path, schema, opts);                          // UN seul nouvel essai, même Idempotency-Key
  }
  throw err;
}
```

### 3.4 Traitement par statut

| Cas | Comportement |
|---|---|
| Réseau coupé, DNS, timeout | `NetworkError`. Lecture : `ErrorState` « Pas de connexion » + Réessayer. Mutation organisation : proposée à la file hors ligne si éligible (section 11). Mutation finance : erreur, formulaire conservé, **jamais** mise en file. |
| `401` | Hors `/auth/*` : `queryClient.clear()`, purge du cache IndexedDB de lecture, redirection `/login?next=<chemin courant encodé>`. `next` n'accepte qu'un chemin relatif commençant par `/` (anti open-redirect). |
| `403` + `REAUTH_REQUIRED` | Modale `ReauthDialog` (mot de passe), `POST /api/v1/auth/reauth`, puis rejeu unique. Annulation de la modale → la mutation échoue avec `REAUTH_CANCELLED` (code client), sans toast d'erreur. Une seule modale à la fois : les requêtes concurrentes attendent la même promesse. |
| `403` autre | `ErrorState` variante « accès refusé ». |
| `404` | État « introuvable ». Aucun détail sur l'existence de la ressource (ADR-007). |
| `409` | Conflit (`CONFLICT_STALE_VERSION`, `DUPLICATE_EXTERNAL_REFERENCE`, `IDEMPOTENCY_KEY_REUSED`…) : traitement spécifique par écran, voir `DESIGN_SYSTEM.md` §6. |
| `422` / `400` + `VALIDATION_FAILED` | `details[].path` → `form.setError(path.join('.'), …)`. Champ inconnu → erreur générale du formulaire. |
| `429` | Toast « Trop de tentatives, réessayez dans N s » (en-tête `Retry-After`). Pas de rejeu automatique d'une mutation. |
| `5xx` | `ErrorState` avec `requestId` affiché en petit (« Référence : … ») pour le support. Les requêtes GET sont relancées 2 fois par TanStack Query ; les mutations jamais. |

### 3.5 Codes d'erreur

Les codes viennent de l'enum `ErrorCode` de `@orbit/contracts`. Tout code doit avoir une clé `errors.<CODE>` dans `lib/i18n/fr/errors.json` ; un test unitaire compare l'enum et le fichier de traduction et échoue s'il en manque une.

## 4. État serveur (TanStack Query)

### 4.1 Configuration globale

```ts
new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: (n, e) => isRetryable(e) && n < 2, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
```

- Données financières (soldes, transactions, dettes, bloc Argent du dashboard) : `staleTime: 0`, refetch au montage et au retour au premier plan.
- `GET /api/v1/me` : `staleTime: 5 min`, invalidé après toute modification de préférences.

### 4.2 Query key factories

Une factory par module, dans `features/<module>/api/<module>.keys.ts`. Aucune clé écrite à la main ailleurs.

```ts
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskListFilters) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

export const financeKeys = {
  all: ['finance'] as const,
  accounts: () => [...financeKeys.all, 'accounts'] as const,
  account: (id: string) => [...financeKeys.accounts(), id] as const,
  transactions: (filters: TransactionFilters) => [...financeKeys.all, 'transactions', filters] as const,
  transaction: (id: string) => [...financeKeys.all, 'transaction', id] as const,
  debts: (filters: DebtFilters) => [...financeKeys.all, 'debts', filters] as const,
};

export const dashboardKeys = { all: ['dashboard'] as const };
```

Les filtres placés dans une clé sont des objets sérialisables et normalisés (clés triées, valeurs par défaut retirées) par `normalizeFilters()`.

### 4.3 Invalidation

Après une mutation réussie, on invalide **par préfixe** :

| Mutation | Invalidation |
|---|---|
| Transaction, transfert, frais, ajustement, annulation | `financeKeys.all`, `dashboardKeys.all` (et `debtKeys` si la transaction est liée à une dette) |
| Remboursement de dette | `financeKeys.all`, `dashboardKeys.all` |
| Tâche, idée, projet, note | clé du module + `dashboardKeys.all` |
| Préférences (`PATCH /me/preferences`) | `['me']` |

`setQueryData` après une réponse serveur est autorisé pour mettre à jour un détail **avec les données renvoyées par le serveur**.

### 4.4 Mises à jour optimistes

- **Autorisées** hors finance : cocher une tâche, changer le statut d'une idée, renommer, réordonner, archiver une note. Pattern obligatoire : `onMutate` (snapshot + `setQueryData`), `onError` (restauration + toast), `onSettled` (invalidation).
- **Interdites** pour tout ce qui touche à l'argent : transaction, transfert, dette, remboursement, ajustement, solde, bloc Argent. Le solde affiché est **toujours** celui que renvoie le serveur ; le front ne recalcule jamais un solde en additionnant des montants. Pendant la mutation, `MoneyAmount` affiche son état `pending` (voir `DESIGN_SYSTEM.md` §5.2).
- Un test lint (`no-restricted-syntax`) refuse `onMutate` dans `features/finance/**` et `features/debts/**`.

## 5. Session, utilisateur et préférences

- `SessionProvider` charge `GET /api/v1/me` au démarrage. Réponse attendue (schéma `MeResponse` de `@orbit/contracts`) : `id`, `email`, `role` (`USER` | `ADMIN`), `preferences` (`timezone`, `defaultCurrency`, `locale`, `theme`, `enabledModules`, `defaultAccountId`, `onboardingCompletedAt`).
- Pendant ce chargement : écran de démarrage (logo + barre de progression), jamais un flash de la page de connexion.
- Déconnexion (`POST /api/v1/auth/logout`) : `queryClient.clear()`, suppression du cache de lecture IndexedDB, retour `/login`. Si la file de capture contient des éléments non synchronisés, `ConfirmDialog` préalable : « 3 captures ne sont pas encore envoyées. Elles seront perdues si vous vous déconnectez. »

## 6. Formulaires

- `useForm({ resolver: zodResolver(schema), mode: 'onTouched' })`.
- Le schéma vient de `@orbit/contracts` (ex. `CreateTransactionRequest`). Un schéma de formulaire dans `features/*/schemas/` PEUT l'étendre (`.extend`, `.superRefine`) pour des champs d'interface, mais **NE DOIT PAS** affaiblir une règle (pas de `.partial()` sur un schéma de création, pas de `.optional()` sur un champ obligatoire).
- Composants de champ : toujours via `FormField` (`components/forms`) qui relie `label`, `aria-describedby`, `aria-invalid` et message d'erreur.
- Soumission : bouton désactivé + spinner tant que `isPending` ; `Enter` sur mobile ne soumet qu'une fois.
- `Idempotency-Key` des formulaires financiers : générée par `useIdempotencyKey()` à l'ouverture du formulaire, **réutilisée** si l'utilisateur renvoie après une erreur réseau, régénérée après un succès.
- Erreurs serveur : section 3.4. Le premier champ en erreur reçoit le focus.
- Brouillon : un formulaire long (note, description de projet) PEUT sauvegarder un brouillon en `sessionStorage` sous la clé `draft:<userId>:<form>` ; jamais pour un formulaire financier.

## 7. Montants

Règles dérivées d'ADR-008 :

1. Un montant venant de l'API est une **chaîne de chiffres** en unités mineures (`"150000"`). Le front le convertit en `Money` via `Money.fromMinorString(value, currency)` de `@orbit/money` (qui utilise `bigint`).
2. **Interdits** : `Number(amount)`, `parseFloat`, `parseInt` sur un montant, `+amount`, opérateurs arithmétiques sur un montant hors de `@orbit/money`, `Intl.NumberFormat` direct pour un montant. Règle ESLint locale `orbit/no-float-money` (identifiants contenant `amount`, `balance`, `minor`, `fee`, `total`).
3. **Affichage** : uniquement via `<MoneyAmount>` qui appelle `formatMoney(money, { sign, hidden })` de `@orbit/money`. Format : `DESIGN_SYSTEM.md` §8.
4. **Saisie** : uniquement via `<MoneyInput>`. La valeur du champ est une **chaîne** ; le composant ne garde que les chiffres (et, pour les devises à exposant 2, un séparateur décimal `,` ou `.` suivi d'au plus 2 chiffres). La conversion en unités mineures se fait par `parseMajorToMinor(input, currency)` avant l'envoi. Pour XOF (exposant 0), toute décimale est refusée avec le message « Le FCFA n'a pas de centimes ».
5. **Validation** : schéma `MinorAmountString` de `@orbit/contracts` (`/^[1-9][0-9]{0,17}$/` pour un montant strictement positif).
6. **Totaux et sommes** affichés : fournis par l'API. Le front ne calcule que des prévisualisations explicitement étiquetées (ex. « Wave −20 200 FCFA » avant un transfert), toujours avec `@orbit/money`, jamais présentées comme un solde.

## 8. Dates et fuseaux

- Fuseau de référence : `me.preferences.timezone` (défaut `Africa/Dakar`, ADR-023), **pas** celui de l'appareil. Si les deux diffèrent, `Paramètres > Région` affiche un bandeau « Votre appareil est sur Europe/Paris, ORBIT utilise Africa/Dakar ».
- **Date civile** (échéance, date d'opération) : type `CivilDate` = chaîne `YYYY-MM-DD`, transmise telle quelle. Interdit : `new Date('2026-10-11')` (interprété en UTC) ; utiliser `parseCivilDate()` de `lib/dates.ts`.
- **Instant** (création, rappel, rendez-vous) : chaîne ISO 8601 UTC venant de l'API, affichée avec `formatInstant(iso, tz)` via `@date-fns/tz` (`TZDate`).
- « Aujourd'hui » = `todayInZone(tz)`, utilisé pour les retards (ADR-020), les blocs du dashboard et la valeur par défaut des dates d'opération.
- Format d'affichage : `DESIGN_SYSTEM.md` §8 (jj/mm/aaaa, heures sur 24 h).
- Les tests de `lib/dates.ts` tournent avec `TZ=Africa/Dakar`, `TZ=Europe/Paris` et `TZ=America/New_York` (ADR-023).

## 9. Routage et gardes

### 9.1 Carte des routes

| Route | Écran | Garde | Phase |
|---|---|---|---|
| `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` | Authentification | publique (redirige vers `/` si connecté) | 01 |
| `/onboarding/*` | Premier lancement | `RequireAuth` | 02/05 |
| `/` | Dashboard « centre d'attention » | `RequireAuth`, `RequireOnboarding` | 02 puis 07 |
| `/capture` | Feuille de capture plein écran (cible des raccourcis et du Share Target) | `RequireAuth` | 02 |
| `/ideas`, `/ideas/inbox`, `/ideas/:id` | Idées, tri de l'INBOX | `RequireModule('ideas')` | 04 |
| `/tasks`, `/tasks/:id` | Tâches | `RequireModule('tasks')` | 04 |
| `/projects`, `/projects/:id` | Projets | `RequireModule('projects')` | 04 |
| `/notes`, `/notes/:id` | Notes et documents | `RequireModule('notes')` | 04/09 |
| `/finance` | Vue Finances (comptes + dernières opérations) | `RequireModule('finance')` | 05 |
| `/finance/accounts/:id`, `/finance/accounts/:id/reconcile` | Compte, rapprochement | idem | 05 |
| `/finance/transactions`, `/finance/transactions/new`, `/finance/transactions/:id` | Opérations | idem | 05 |
| `/finance/transfers/new` | Transfert | idem | 05 |
| `/finance/debts`, `/finance/debts/:id` | Dettes et créances | idem | 06 |
| `/calendar` | Calendrier | `RequireModule('calendar')` | 09 |
| `/pro/*` | Clients, contrats, factures | `RequireModule('pro')` | 10 |
| `/goals/*` | Objectifs, habitudes, journal | `RequireModule('goals')` | 11 |
| `/automations/*`, `/integrations/*` | | `RequireAuth` | 14/15 |
| `/search` | Recherche globale | `RequireAuth` | 07 |
| `/settings/*` | Profil, sécurité, région, modules, apparence, export | `RequireAuth` | 01+ |
| `/more` | Menu « Plus » (mobile uniquement ; redirige vers `/` sur desktop) | `RequireAuth` | 02 |
| `/dev/*` | Zone Dev (inventaire, coffre) | `RequireRole('ADMIN')` | 12/13 |
| `/admin/*` | Console d'administration | `RequireRole('ADMIN')` | 17 |
| `*` | Introuvable | — | 02 |

Les identifiants de module (`ideas`, `tasks`, `finance`, `pro`…) sont l'enum `ModuleKey` de `@orbit/contracts`.

### 9.2 Règles des gardes

- `RequireAuth` : sans session → `/login?next=…`.
- `RequireOnboarding` : `onboardingCompletedAt === null` → `/onboarding`.
- `RequireModule(key)` : module désactivé (ADR-024) → écran « Ce module est désactivé » avec lien vers `Paramètres > Modules`. Le module disparaît aussi de la navigation.
- `RequireRole('ADMIN')` : rôle différent → écran **Introuvable** (comme un 404, sans indice sur l'existence de la zone). L'API reste l'autorité : la garde front n'est qu'un confort.
- Les routes `/dev/*` et `/admin/*` sont dans des chunks séparés, importés **uniquement** si `role === 'ADMIN'` ; leurs entrées de menu ne sont pas rendues pour un `USER`.

## 10. PWA

- `vite-plugin-pwa`, `registerType: 'prompt'` : quand une nouvelle version est prête, toast « Nouvelle version disponible — Recharger ». Pas de rechargement forcé (risque de perdre une saisie).
- **Precache** : coquille de l'application (HTML, JS, CSS, polices, icônes).
- **Runtime** : `/api/*` en `NetworkOnly` dans le service worker. Le SW **NE DOIT PAS** mettre en cache une réponse d'API (confidentialité, fraîcheur des soldes).
- Navigation hors ligne : fallback sur `index.html` ; l'application affiche un bandeau « Hors ligne » et ce qui est en cache de lecture (section 11.4).
- **Hébergement** (ADR-038) : le build est servi par Vercel. `sw.js`, `manifest.webmanifest` et `index.html` sont servis en `Cache-Control: no-cache` et les fichiers `/assets/*` (noms hachés) en `immutable`, sinon le CDN bloquerait la détection d'une nouvelle version. Une route inconnue retombe sur `index.html` par réécriture (`INFRASTRUCTURE.md` §4.3).

### 10.1 Manifest

```json
{
  "name": "ORBIT",
  "short_name": "ORBIT",
  "lang": "fr",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F6F7F9",
  "theme_color": "#2B4BC0",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Dépense", "short_name": "Dépense", "url": "/capture?type=expense&source=shortcut", "icons": [{ "src": "/icons/shortcut-expense.png", "sizes": "96x96" }] },
    { "name": "Idée", "short_name": "Idée", "url": "/capture?type=idea&source=shortcut", "icons": [{ "src": "/icons/shortcut-idea.png", "sizes": "96x96" }] }
  ],
  "share_target": {
    "action": "/capture",
    "method": "GET",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
}
```

- Share Target en `GET` (texte et liens uniquement) : `/capture` pré-remplit une **idée** (`source: SHARE`) avec `title`, `text` et `url`. Le partage de fichiers (POST multipart) est hors périmètre jusqu'à PHASE-09 (documents).
- Le texte partagé est traité comme une donnée : il passe par le même parseur que la capture, mais un partage **ne crée jamais directement** une transaction ; si un montant est détecté, la feuille s'ouvre en mode « Dépense » à confirmer.
- Installation : `hooks/useInstallPrompt` capture `beforeinstallprompt` (Android/Chrome) ; sur iOS, instructions « Partager → Sur l'écran d'accueil ». Proposée pendant l'onboarding et dans `Paramètres > Application`.

## 11. Capture hors ligne

### 11.1 Périmètre

- **Éligibles** : création d'**idée**, de **note** et de **tâche** (`POST /api/v1/ideas`, `/notes`, `/tasks`).
- **Jamais** : toute route `/finance/*`, dettes, préférences, suppression, modification d'une ressource existante. Un test unitaire vérifie que `enqueue()` refuse tout chemin hors liste blanche.
- Hors ligne, une saisie détectée comme dépense propose **uniquement** : « Garder comme idée à traiter » (crée une idée INBOX contenant le texte brut, à reconvertir en ligne) ou « Annuler ». Voir `DESIGN_SYSTEM.md` §11.1.

### 11.2 Stockage

Base IndexedDB `orbit` (via `idb`), version de schéma explicite :

| Store | Clé | Contenu |
|---|---|---|
| `capture_queue` | `id` (UUIDv7) | `{ id, userId, kind: 'idea' \| 'note' \| 'task', path, body, idempotencyKey, createdAt, attempts, lastError, status: 'pending' \| 'sending' \| 'failed' }` |
| `read_cache` | clé de requête sérialisée | Cache de lecture persistant (section 11.4) |

- `idempotencyKey` = UUIDv7 généré **à la création** de l'élément, envoyé dans `Idempotency-Key` à chaque tentative. Le serveur garantit qu'un rejeu ne crée pas de doublon.
- `userId` est celui de la session au moment de la capture. Le rejeu n'envoie que les éléments dont `userId` correspond à `me.id` ; les autres restent en attente et sont proposés à la suppression après connexion du bon compte.
- Taille maximale : 200 éléments ou 1 Mo ; au-delà, la capture hors ligne est refusée avec un message clair.

### 11.3 Rejeu

- Déclencheurs : événement `online`, retour au premier plan (`visibilitychange`), démarrage de l'application, Background Sync (`sync` tag `capture-queue`) si le navigateur le permet.
- Ordre FIFO, un élément à la fois, verrou via Web Locks API (`navigator.locks`) pour éviter deux onglets en concurrence.
- Résultats : `2xx` ou `409 IDEMPOTENCY_KEY_REUSED` (déjà créé) → suppression de l'élément + invalidation du module ; `401` → arrêt, reprise après connexion ; `4xx` autre → `status: 'failed'`, visible par l'utilisateur ; `5xx`/réseau → backoff exponentiel (2 s, 4 s… plafond 5 min).
- Interface : pastille « 3 en attente » sur le bouton +, liste consultable depuis la feuille de capture, éléments `failed` modifiables ou supprimables.

### 11.4 Cache de lecture

- `PersistQueryClientProvider` avec un persister IndexedDB, **liste blanche** : `ideas`, `tasks`, `projects`, `notes`. Durée maximale 24 h.
- **Exclus** : `finance`, `debts`, `dashboard`, `me`, `dev`, `admin`, `search`. Les données financières ne sont jamais écrites sur le disque par le front.
- Purge complète à la déconnexion, sur `401` et au changement d'utilisateur.

## 12. Performance

- **Code splitting par route** : chaque page via `lazy`. Le shell (layout, navigation, feuille de capture, client HTTP) est dans le chunk initial ; le reste non.
- Les dépendances lourdes (graphiques, éditeur riche, calendrier) sont importées dynamiquement dans la page qui les utilise.
- **Budget** (gzip), vérifié en CI par `size-limit` — dépassement = CI rouge :

| Élément | Budget |
|---|---|
| JS initial (entrée + vendor du shell) | ≤ 170 Ko |
| Chunk d'une route | ≤ 60 Ko |
| CSS total | ≤ 25 Ko |
| Polices (sous-ensemble latin) | ≤ 60 Ko |

- **Web Vitals cibles** (profil Lighthouse mobile, « Slow 4G », CPU ×4) : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Lighthouse CI sur `/login` et `/` (authentifié par fixture).
- Listes de plus de 100 éléments : pagination par curseur côté API + « Charger plus » ou virtualisation (`@tanstack/react-virtual`).
- Préchargement : `queryClient.prefetchQuery` au survol/au focus d'un lien de navigation principal (desktop) et du compte par défaut à l'ouverture de la feuille de capture.
- Images : `loading="lazy"`, dimensions explicites.

## 13. Accessibilité

Exigences complètes : `DESIGN_SYSTEM.md` §9 (WCAG 2.2 AA). Côté code :
- Primitives Radix pour toute interaction complexe (dialogue, menu, popover, combobox, onglets) ; pas de réimplémentation maison.
- `eslint-plugin-jsx-a11y` en mode `strict`.
- Chaque page a un unique `<h1>` et un `<main id="main">` ; lien « Aller au contenu » en premier élément focalisable.
- Changement de route : le focus est placé sur le `<h1>` de la nouvelle page et le titre du document est mis à jour (`ORBIT · <Page>`).
- Toasts annoncés via `aria-live="polite"` (erreurs : `assertive`).
- `prefers-reduced-motion` respecté par tous les composants animés.
- Tests axe automatiques (section 15).

## 14. Sécurité côté front

- Aucun secret, jeton ou donnée sensible dans `localStorage`, l'URL ou les logs (`console.*` interdit en production par lint, sauf `lib/logger.ts`).
- Pas de `dangerouslySetInnerHTML`, sauf rendu Markdown des notes via un pipeline assaini (`rehype-sanitize`) dans un composant unique.
- Liens externes : `rel="noopener noreferrer"`.
- CSP et autres en-têtes de sécurité définis dans `apps/web/vercel.json` (valeurs : `SECURITY.md` §3.10 ; configuration : `INFRASTRUCTURE.md` §4.3) : le front ne charge aucun script tiers ni police externe. Seule exception de `connect-src` : l'ingestion Sentry en région UE.
- Variables d'environnement : uniquement des `VITE_*` publiques, définies dans Vercel par environnement (`VITE_APP_VERSION`, `VITE_APP_ENV`, `VITE_SENTRY_DSN`). Aucun secret n'est préfixé `VITE_`. L'URL de l'API n'est **pas** une variable : le front appelle toujours `/api` en relatif (même origine, réécriture Vercel).
- Suivi d'erreurs : `@sentry/react` avec `sendDefaultPii: false`, `beforeSend` qui retire URL de requête et données saisies, Session Replay désactivé.
- Coffre-fort : un secret révélé n'est jamais stocké dans le cache TanStack Query (`gcTime: 0`, `staleTime: 0`), masqué automatiquement après 30 s.

## 15. Tests front

| Niveau | Outil | Cible minimale |
|---|---|---|
| Unitaire | Vitest | `lib/http`, `lib/dates`, `lib/offline`, parseur de capture (`features/capture/lib/parse-capture.ts`, table de cas ≥ 40 entrées), hooks de formulaire. |
| Composant | Vitest + Testing Library + MSW | Chaque composant métier de `DESIGN_SYSTEM.md` §5 : rendu des états obligatoires, clavier, aria. |
| Accessibilité | `vitest-axe` (composants), `@axe-core/playwright` (pages) | Zéro violation `serious` ou `critical`. |
| E2E | Playwright (projets `mobile` Pixel 7 et `desktop` Chrome) | Parcours de `DESIGN_SYSTEM.md` §11 : capture < 5 s, dépense mobile money, transfert, rapprochement, onboarding, tri INBOX, file hors ligne (`context.setOffline(true)`), garde ADMIN. |
| Visuel | Playwright `toHaveScreenshot` | Pages clés en clair et sombre, mobile et desktop. |

- MSW partage ses gestionnaires entre tests et `pnpm dev:mock`.
- Couverture `apps/web` ≥ 80 % (ADR-021). `lib/offline` et le parseur de capture : ≥ 95 %.
- Un test E2E vérifie qu'un `USER` qui navigue vers `/dev` voit « Introuvable » et qu'aucun chunk `dev-*` n'est téléchargé.

## 16. Conventions

- **Nommage** : composants `PascalCase.tsx`, hooks `useCamelCase.ts`, autres fichiers `kebab-case.ts`. Un composant exporté par fichier.
- **Exports nommés** uniquement, sauf les pages chargées par `lazy` (qui exportent `Component` selon la convention React Router).
- **Props** : type `XxxProps` déclaré au-dessus du composant ; pas de `React.FC`.
- **Immutabilité** : jamais de mutation d'un objet venant du cache ; `setQueryData` reçoit une nouvelle valeur.
- **Textes** : clés i18n `module.ecran.element` (ex. `finance.transfer.submit`). Pluriels via i18next (`_one`, `_other`).
- **Classes** : `cn()` (clsx + tailwind-merge) ; variantes de composants via `class-variance-authority`.
- **Taille** : composant ≤ 200 lignes, fichier ≤ 400 lignes (plafond souple 800, `CODING_STANDARDS.md`).
- **Données de test** : `features/*/api/__fixtures__/` ; jamais de vraies données personnelles.
- **Commits** : en anglais, format conventionnel (ADR-022).

## 17. Points ouverts

| # | Sujet | Proposition | À trancher dans |
|---|---|---|---|
| F1 | Endpoint d'annulation d'une transaction (bouton « Annuler » du toast) | `POST /api/v1/finance/transactions/{id}/cancel`, audité | `API.md`, PHASE-05 |
| F2 | Endpoint de rapprochement | `POST /api/v1/finance/accounts/{id}/reconciliations` (enregistre le solde déclaré, crée l'ajustement si demandé) | `API.md`, `FINANCE_RULES.md` |
| F3 | Grille de frais mobile money (source, mise à jour) | Fournie par l'API par compte (`feePolicy`), jamais codée en dur dans le front | `FINANCE_RULES.md` |
| F4 | Conversion d'idée | `POST /api/v1/ideas/{id}/convert` `{ target: 'TASK' \| 'PROJECT' \| 'NOTE' }` | `API.md`, PHASE-04 |
| F5 | Préférence « masquer les soldes » | Locale à l'appareil (pas synchronisée) | Propriétaire |
