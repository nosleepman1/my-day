# ORBIT : stratégie et outils de test

- **Statut :** référence. Applique ADR-007, 008, 009, 020, 021 et 023 de `DECISIONS.md` et détaille `PRODUCT_SPEC.md` §12.
- **Date :** 11 octobre 2026.
- **Responsabilité :** dire quoi tester, avec quel outil, où ranger les tests, quels seuils s'appliquent et ce qui bloque la CI. Ce document ne définit pas les règles métier (voir `FINANCE_RULES.md`), ni le pipeline CI/CD lui-même (voir `INFRASTRUCTURE.md`).
- **Documents liés :** `FINANCE_RULES.md` (cas `FIN-01` à `FIN-40`), `SECURITY.md`, `API.md`, `DATA_MODEL.md`, `DEVELOPMENT_METHOD.md`, `INFRASTRUCTURE.md`, `docs/phases/PHASE-XX-*.md` (section « Tests exigés »).

Les mots DOIT et NE DOIT PAS sont normatifs. Les commandes, chemins et noms d'outils donnés ici sont le contrat ; `PHASE-00` les instancie.

---

## 1. Règles absolues

1. **Aucun code de production sans test écrit avant** (RED → GREEN → REFACTOR, §7).
2. **Ne jamais inventer un résultat de test** (§17). Un test non exécuté est déclaré « non exécuté ».
3. **Les valeurs attendues financières viennent de `FINANCE_RULES.md`**, jamais d'une sortie du code copiée dans l'assertion.
4. **Chaque route a son test d'isolation** entre utilisateurs, généré automatiquement ; une route non couverte ni exclue fait échouer la CI (§9).
5. **Seuils de couverture** : 80 % global, 100 % sur `packages/money` et le domaine finance (§8).
6. **Données synthétiques uniquement** ; aucun secret réel (§6).
7. **Aucune écriture financière hors ligne** (ADR-016), et un test l'établit (§13).
8. Un test ne dépend ni d'un autre test, ni de l'ordre d'exécution, ni de l'heure réelle, ni du fuseau du poste.

---

## 2. Pyramide et ratio

| Niveau | Part cible (en nombre de tests) | Cible de durée | Base de données | Exemples |
|---|---|---|---|---|
| Unitaire | ~70 % | < 60 s pour toute la suite API + web + packages | Aucune | `packages/money`, règles de domaine, transitions d'état, validations Zod, composants React |
| Intégration | ~25 % | < 6 min | PostgreSQL réel (Testcontainers) | Services Nest + Prisma, contraintes SQL, verrous, API HTTP, jobs |
| E2E | ~5 % | < 10 min (parcours critiques) | Pile complète | Parcours Playwright |

Règles :
- Un test se place au **niveau le plus bas** capable de prouver le comportement.
- Le domaine finance est testé à 100 % en unitaire (fonctions pures, sans base). L'intégration prouve ce que le pur ne peut pas : verrous, contraintes, atomicité, concurrence.
- Un bug trouvé en E2E ou en production reçoit d'abord un test de niveau inférieur qui échoue (RED), puis le correctif.
- La pyramide est contrôlée dans chaque rapport de phase (décompte par niveau). Un écart supérieur à 15 points par rapport à la cible est justifié par écrit.

---

## 3. Outils et configuration de principe

| Besoin | Outil | Remarque |
|---|---|---|
| Exécuteur API | **Vitest + SWC** (`unplugin-swc`) | SWC émet les métadonnées de décorateurs requises par l'injection de dépendances NestJS. |
| Exécuteur web | **Vitest + Testing Library** (`@testing-library/react`, `user-event`, `jest-dom`) | Environnement `happy-dom` (jsdom est écarté : il remplace AbortSignal de façon incompatible avec le fetch de Node). |
| Base de données | **Testcontainers PostgreSQL** | Même version majeure que la production (version épinglée dans `INFRASTRUCTURE.md`). Redis via Testcontainers à partir de PHASE-08. |
| HTTP API | `supertest` sur l'application Nest démarrée | Le test exerce les guards, pipes et filtres réels. |
| E2E | **Playwright** | Chromium bureau, Chromium mobile (viewport téléphone), WebKit mobile en smoke. |
| Propriétés | **fast-check** | Invariants financiers (§10). |
| Mocks HTTP | **MSW** | Web (requêtes vers l'API) et API (appels sortants : Google, Brevo ou Resend, WhatsApp, Anthropic). |
| Architecture | **dependency-cruiser** + ESLint | §11. |
| Courriels | Mailpit (Docker Compose) | E2E : lire le lien de vérification via l'API de Mailpit. |
| Mutation (nocturne) | Stryker | `packages/money` et domaine finance. |

### 3.1 Principes de configuration

**Vitest (API).**
- Trois projets Vitest : `unit` (`src/**/*.spec.ts`), `integration` (`test/integration/**/*.int.spec.ts`), `contract` (isolation, sécurité, architecture, migrations, propriétés).
- `globals: false` : imports explicites. `pool: 'forks'` pour l'intégration (binaires natifs Prisma). Délais : unitaire 5 s, intégration 30 s, propriétés 120 s.
- `unplugin-swc` avec `decoratorMetadata`, décorateurs hérités et cible `es2022`.
- `setupFiles` : `reflect-metadata`, forçage du fuseau, horloge injectée.
- `bail` désactivé en CI (on veut la liste complète des échecs). `.only` interdit (lint + CI). `.skip` interdit sans référence de ticket (`// SKIP(ORBIT-123): raison`).

**Testcontainers.**
- Un conteneur PostgreSQL par exécution (`globalSetup`), réutilisé par tous les workers.
- Une base de données par worker, clonée depuis une base modèle (`CREATE DATABASE … TEMPLATE`) où `prisma migrate deploy` a été joué une fois.
- Pas de rollback de transaction pour isoler les tests : l'application ouvre ses propres transactions et verrous. L'isolation vient de **l'utilisateur neuf par test** (toute donnée est cloisonnée par `user_id`) et d'un `TRUNCATE` entre fichiers.
- Pool de connexions d'au moins 10 pour les tests de concurrence (`FIN-27`, `FIN-28`).
- Le fuseau de session PostgreSQL est toujours `UTC`.

**Horloge et identifiants.**
- Le code accède au temps et aux UUIDv7 par des ports injectables (`Clock`, `IdGenerator`). `Date.now()` et `new Date()` sont interdits dans le domaine (§11).
- Les tests figent l'horloge ; les tests de propriétés injectent des dates générées.

**Vitest (web).**
- `environment: 'happy-dom'`, `setupFiles` : `jest-dom`, serveur MSW avec `onUnhandledRequest: 'error'`, `cleanup` après chaque test.
- Requêtes par rôle d'abord (`getByRole`), puis libellé ; `data-testid` en dernier recours.
- Aucun montant manipulé en `number` dans les tests de formulaires ; le formatage vient de `packages/money`.

**MSW (API).**
- Tout appel sortant d'un test d'intégration est intercepté ; une requête sans gestionnaire fait échouer le test. Aucun appel réseau réel en CI.

**fast-check.**
- 100 exécutions par propriété en PR, 1 000 en nocturne, 50 pour les modèles à états (§10).
- La graine est affichée en cas d'échec et un test de régression fixe la graine et le contre-exemple (`fc.assert(..., { seed, path })`).

**Playwright.**
- `webServer` démarre l'API, le worker (à partir de PHASE-08) et le front sur une base de test.
- Un utilisateur neuf par test (`user-<uuid>@example.test`), créé par l'API (jamais par l'interface), session injectée via `storageState`.
- `timezoneId: 'Africa/Dakar'`, `locale: 'fr-FR'`, horloge pilotée par `page.clock`.
- `trace: 'on-first-retry'`, `retries: 1` en CI (0 en local). Un test réussi après nouvel essai est signalé dans le rapport (§16).
- Contrôle d'accessibilité automatique (`@axe-core/playwright`) sur les écrans principaux de chaque parcours.

---

## 4. Organisation des fichiers

```
apps/api/
  src/<module>/**/*.spec.ts                  # unitaire, à côté du code
  test/
    integration/<module>/*.int.spec.ts       # intégration (base réelle)
    isolation/                               # généré (§9)
      generate.ts
      exclusions.ts
      provisioners/<resource>.ts
    properties/*.prop.spec.ts                # invariants (§10)
    architecture/*.arch.spec.ts              # §11
    security/*.sec.spec.ts                   # §12
    migrations/*.mig.spec.ts                 # §14
    factories/                               # §6
    helpers/                                 # app, clock, sessions, db
apps/web/
  src/**/*.test.tsx                          # unitaire / composant, à côté du code
e2e/
  tests/phase-XX/*.e2e.ts                    # parcours critiques
  fixtures/
packages/money/src/*.spec.ts                 # unitaire (100 %)
packages/contracts/src/**/*.spec.ts          # schémas Zod
```

Règles :
- Nom du fichier de test = nom du fichier testé + suffixe. Un fichier de test dépasse rarement 400 lignes ; au-delà il est découpé par comportement.
- Titre : `describe('<unité>')`, `it('<comportement attendu>')`, en anglais pour les identifiants et au choix français ou anglais pour la phrase, de façon homogène dans un fichier.
- Un test cite le cas métier qu'il vérifie dans son titre : `it('[FIN-11] converts EUR to XOF with half-up rounding', …)` (§5).
- Structure **Arrange / Act / Assert**, une seule raison d'échouer par test.
- Aucun test ne lit un fichier d'un autre test.

---

## 5. Traçabilité des cas `FIN-xx`

1. Chaque cas `FIN-01` à `FIN-40` de `FINANCE_RULES.md` est implémenté par au moins un test dont le titre contient `[FIN-xx]`.
2. Un script `scripts/check-fin-traceability` (exécuté en CI, bloquant) :
   - extrait les identifiants `FIN-\d+` de `FINANCE_RULES.md` ;
   - échoue si un identifiant n'apparaît dans aucun titre de test ;
   - échoue si un test cite un identifiant inexistant ;
   - échoue si un identifiant est cité uniquement dans un test `skip` ou `todo`.
3. Les niveaux se répartissent ainsi : les assertions de calcul au niveau unitaire (domaine pur), les assertions de persistance, de verrou et d'API au niveau intégration. Un même `FIN-xx` peut avoir un test à chaque niveau.
4. Ajouter un cas à `FINANCE_RULES.md` ajoute l'obligation de test. Un identifiant n'est jamais renuméroté ni réutilisé.

---

## 6. Données de test

1. **Synthétiques uniquement.** Aucune donnée réelle, aucun export de production, aucun vrai client ni vraie coordonnée.
2. **Factories** dans `test/factories/` : `buildUser`, `buildAccount`, `buildTransaction`, `buildDebt`, `buildInvoice`, etc. Chaque factory :
   - fournit des valeurs valides par défaut et accepte des surcharges explicites ;
   - utilise une graine déterministe (compteur ou `fast-check`), jamais `Math.random()` ;
   - produit des e-mails en `@example.test` et des téléphones fictifs (plage réservée) ;
   - crée l'utilisateur propriétaire par défaut si aucun n'est fourni.
3. **Deux utilisateurs au minimum** dans tout test d'intégration touchant des données : helper `createTwoUsers()` (A, B) et `createAdmin()`.
4. **Secrets fictifs** : toute valeur ressemblant à un secret porte le préfixe `FAKE_` (par exemple `FAKE_vault_secret_001`). Ces valeurs ne correspondent à aucun format de secret réel ; le scan de secrets en CI n'est jamais désactivé pour les tests. Le coffre-fort (PHASE-13) n'est testé qu'avec des secrets fictifs.
5. **Plusieurs devises** dans les jeux de données finance : XOF (exposant 0), EUR (exposant 2) au minimum.
6. **Montants** : toujours des chaînes ou des `bigint`, jamais des `number`, y compris dans les factories.
7. **Jeux de référence** : les états initiaux de `FIN-01` à `FIN-40` sont construits par des helpers nommés (`scenario.fin11()`), pour que la lecture du test renvoie au document.
8. **Nettoyage** : pas de données partagées entre fichiers ; `TRUNCATE` entre fichiers d'intégration ; les tests E2E créent leurs utilisateurs et n'en dépendent jamais entre eux.
9. **Journaux** : les tests de sécurité utilisent un secret « canari » (`FAKE_canary_…`) et vérifient son absence des journaux, réponses d'erreur et audits (§12).

---

## 7. TDD appliqué par tâche

Les phases sont découpées en tâches d'au plus une demi-journée (`DEVELOPMENT_METHOD.md`). Chaque tâche suit ce cycle :

1. **Lire** la règle (`FINANCE_RULES.md`, fiche de phase) et lister les cas de test avant d'écrire du code : nominal, limites (nul, vide, maximum, minimum), erreurs, concurrence, autre utilisateur.
2. **RED** : écrire les tests. Les exécuter. Constater l'échec **pour la bonne raison** (assertion, pas erreur de compilation ou d'import). Consigner la commande et l'échec réel dans le rapport de phase.
3. **GREEN** : écrire le code minimal. Exécuter. Constater le passage.
4. **REFACTOR** : nettoyer (doublons, noms, fonctions < 50 lignes, fichiers < 800 lignes). Les tests restent verts, sans modification.
5. **Couverture** : vérifier les seuils du périmètre touché (§8).
6. **Revue** : agents `code-reviewer`, puis `security-reviewer` si la tâche touche l'authentification, des entrées utilisateur, des requêtes SQL, des fichiers, des appels externes ou des données financières.
7. **Commit** : un commit par comportement, type conventionnel (`test:`, `feat:`, `fix:`, `refactor:`). Le commit de tests RED peut être séparé du commit GREEN ; à défaut, le rapport de phase atteste l'échec initial.

Règles complémentaires :
- Corriger un bug : test qui reproduit le bug (RED), correctif (GREEN).
- Un test qui échoue après le code se corrige en corrigeant **le code**, sauf s'il contredit la règle documentée ; dans ce cas, on corrige d'abord la règle (`FINANCE_RULES.md`) puis le test, jamais l'inverse en silence.
- Interdit : supprimer, affaiblir ou commenter un test pour faire passer la CI ; élargir une tolérance numérique ; remplacer une valeur attendue par la sortie observée.
- Les tests de caractérisation (code existant) sont autorisés, nommés comme tels, et ne servent jamais de preuve de conformité à `FINANCE_RULES.md`.

---

## 8. Seuils de couverture

| Périmètre | Lignes | Branches | Fonctions | Instructions |
|---|---|---|---|---|
| Global (API + web + packages) | ≥ 80 % | ≥ 80 % | ≥ 80 % | ≥ 80 % |
| `packages/money` | **100 %** | **100 %** | **100 %** | **100 %** |
| Domaine finance : `apps/api/src/modules/{finance,debts,invoices,recurring}/domain/**` | **100 %** | **100 %** | **100 %** | **100 %** |

(Les chemins du domaine suivent `ARCHITECTURE.md` ; si ce document les fixe autrement, la configuration de couverture est mise à jour, pas le seuil.)

Règles :
- Fournisseur `v8`. Seuils configurés **par glob** dans Vitest ; l'échec d'un seuil échoue la CI.
- Dans les périmètres à 100 %, `/* v8 ignore */` est interdit. Un code inatteignable est supprimé, pas ignoré.
- Exclus du calcul : fichiers générés, `*.spec.ts`, migrations, configuration, points d'entrée (`main.ts`, `worker.ts`) et les exclusions listées dans `vitest.config` avec leur raison.
- Une couverture élevée ne remplace pas la qualité : le score de mutation nocturne vise ≥ 80 % sur `packages/money` et le domaine finance (non bloquant en PR, bloquant avant une version).
- Le rapport de couverture (résumé par périmètre) figure dans chaque rapport de phase.

---

## 9. Tests d'isolation entre utilisateurs (générés)

Objectif : prouver qu'aucune route ne laisse un utilisateur lire, modifier, supprimer ou référencer la donnée d'un autre (ADR-007, ADR-021).

### 9.1 Source

Le **registre des routes** est le document OpenAPI généré par les schémas Zod (ADR-010), construit depuis l'application Nest démarrée (et non un fichier rédigé à la main). Chaque opération (méthode + chemin) est une entrée du registre.

### 9.2 Génération

`test/isolation/generate.ts` produit, pour chaque opération du registre qui n'est pas dans `exclusions.ts`, les scénarios suivants :

| Forme de la route | Scénario généré | Attendu |
|---|---|---|
| Paramètre de chemin identifiant une ressource (`GET`, `PATCH`, `PUT`, `DELETE`, `POST …/action`) | A crée la ressource par le provisionneur ; B appelle avec l'identifiant de A | **404**, corps identique (hors `requestId`) à la réponse pour un identifiant inexistant ; ressource de A inchangée ; audit `CROSS_USER_ACCESS_DENIED` |
| Liste ou recherche | A crée des ressources ; B liste, filtre, pagine, recherche | Aucune ressource de A dans la réponse ni dans les totaux et compteurs |
| Corps référençant une autre ressource (`account_id`, `debt_id`, `invoice_id`, …) | B envoie les identifiants de A | **422** `REFERENCE_NOT_FOUND` (ou 404), indiscernable d'un identifiant inexistant ; aucune ligne créée |
| Corps ou paramètre contenant `user_id` | B tente de fixer `user_id` à A | Champ refusé ou ignoré ; la ressource appartient à B |
| Route ADMIN | Un `USER` appelle | **403** (garde de rôle) ; aucune donnée |
| Route utilisateur appelée par ADMIN avec la ressource d'un utilisateur | ADMIN appelle avec l'identifiant de A | **404** (ADR-002) |
| Toute route protégée | Sans session ; session expirée ; session révoquée | **401** |
| Export, téléchargement, URL signée | B demande le fichier ou l'export de A | **404** ; une URL signée émise pour A n'est pas utilisable pour B si elle est liée à l'utilisateur |

### 9.3 Provisionneurs

`test/isolation/provisioners/<resource>.ts` associe un type de ressource à une fonction qui crée une instance valide pour un utilisateur donné (via les factories). Une route dont le type n'a pas de provisionneur fait échouer la génération.

### 9.4 Exclusions

`exclusions.ts` liste les routes volontairement non testées (inscription, connexion, vérification d'e-mail, réinitialisation de mot de passe, santé, webhooks entrants authentifiés par signature, etc.). Chaque exclusion porte :
- la méthode et le chemin exacts ;
- une raison écrite ;
- le test de remplacement (par exemple, test de signature de webhook en §12).

### 9.5 Verrou de la CI

La CI échoue (`ISOLATION_UNCOVERED_ROUTE`) si :
- une opération du registre n'est ni couverte par un scénario généré ni listée dans `exclusions.ts` ;
- une exclusion ne correspond plus à aucune route (exclusion périmée) ;
- une exclusion n'a pas de raison ou de test de remplacement ;
- un type de ressource n'a pas de provisionneur.

Toute modification de `exclusions.ts` est relue par `security-reviewer`.

### 9.6 Autres surfaces d'isolation

- Extension Prisma `tenantScope` : tests unitaires (contexte absent → erreur ; `findUnique` sur le seul identifiant interdit ; `user_id` injecté dans `where` et `data`).
- Clés étrangères composites `(user_id, id)` : tests de migration (§14) qui tentent d'insérer une référence inter-utilisateurs en SQL direct.
- Tâches de fond : le worker rejoue le contexte `userId` avant tout accès (ADR-007 point 8), testé avec un job portant l'`userId` de B et l'identifiant d'une ressource de A.
- Recherche globale, tableau de bord, exports : chaque agrégat est vérifié avec deux utilisateurs ayant des données.

---

## 10. Tests de propriétés financières (invariants)

Fichiers dans `apps/api/test/properties/` (domaine pur, sans base) et `packages/money`. Les générateurs produisent des montants `bigint` sur toute la plage valide (dont 0, 1, 2^53 ± 1, `MAX_AMOUNT_MINOR`), des devises XOF/EUR/USD et des séquences d'opérations.

| ID | Propriété |
|---|---|
| P1 | **Conservation** : un `TRANSFER` de même devise ne change pas la somme des soldes de cette devise. Il produit deux écritures de même montant. |
| P2 | **Formule de solde** : `solde = opening + Σ CREDIT − Σ DEBIT` des seules écritures `VALIDATED`, quelle que soit la séquence d'opérations. |
| P3 | **Annulation** : annuler toutes les transactions d'une séquence rend chaque solde égal à `opening`. Annuler puis recréer à l'identique rend l'état initial. |
| P4 | **Position nette** : `BORROWING`, `LOAN`, remboursement de dette ou de créance, `TRANSFER` même devise, `CUSTOMER_CREDIT` et dette `ADVANCE` ne changent pas la position nette ; `INCOME` standard ou cadeau, `EXPENSE` standard, `REFUND` et `ADJUSTMENT` la changent exactement du montant de `FINANCE_RULES.md` §4.2. |
| P5 | **Dette** : `restant = principal + Σ ajustements − Σ remboursements valides`, `restant ≥ 0`, `SETTLED ⇔ restant = 0`. |
| P6 | **Facture** : `payé + solde = total` ; `PAID ⇔ solde = 0` ; `Σ imputé sur une transaction ≤ montant de la transaction`. |
| P7 | **Taxes** : `tax_amount = Σ line_tax` ; `total = subtotal + tax_amount` ; chaque `line_tax` est l'arrondi half-up de la ligne. |
| P8 | **Arrondi** : `roundHalfUp` est monotone, `|round(x) − x| ≤ 1/2`, les égalités à la moitié vont vers le haut, et le résultat est identique à une référence en arithmétique rationnelle exacte. |
| P9 | **`Money`** : addition associative et commutative, `a − a = 0`, aller-retour `bigint` ↔ chaîne sans perte (y compris > 2^53), refus de mélanger des devises, refus des décimales en trop. |
| P10 | **Idempotence** : rejouer N fois la même requête avec la même clé produit exactement un effet. |
| P11 | **Indépendance de l'ordre** : pour des opérations sans violation de découvert, le solde final ne dépend pas de l'ordre. |
| P12 | **Découvert** : aucun solde ne descend sous `−overdraft_limit_minor` quelle que soit la séquence ; une opération qui le violerait est refusée sans effet. |
| P13 | **Périodes** : pour chaque fuseau (`Africa/Dakar`, `Europe/Paris`, `America/New_York`), les périodes `[début, fin[` consécutives partitionnent le temps ; chaque transaction appartient à une seule période ; la somme des périodes égale le total de l'intervalle. |
| P14 | **Devises** : aucun rapport n'additionne deux devises ; toute somme est regroupée par devise. |
| P15 | **Machines à états** (modèle) : des séquences aléatoires d'actions (créer, valider, annuler, rembourser, imputer, annuler un paiement) ne produisent jamais une transition illégale de `FINANCE_RULES.md` §5 et laissent P2, P5, P6 vrais. |

Règles :
- P1 à P14 s'exécutent en domaine pur. P15 s'exécute aussi contre PostgreSQL (`fc.commands`, 50 exécutions) : le modèle en mémoire et la base doivent donner les mêmes soldes.
- Une propriété qui échoue produit un test de régression fixe (graine + contre-exemple) en plus de la correction.
- Les propriétés ne remplacent pas les cas `FIN-xx` : celles-ci vérifient des valeurs précises, celles-là des lois.

---

## 11. Tests d'architecture

Fichiers dans `apps/api/test/architecture/` et configuration `.dependency-cruiser.cjs`. Exécutés en CI (bloquants).

**dependency-cruiser :**
- le `domain/` n'importe ni Nest, ni Prisma, ni `infrastructure/`, ni `express` ;
- un module n'importe un autre module que par son point d'entrée public (`index.ts`) ;
- aucun cycle de dépendances ;
- `apps/web` n'importe pas `apps/api`, et inversement ;
- `packages/*` n'importe pas `apps/*` ;
- `packages/money` et `packages/contracts` n'ont aucune dépendance vers un framework serveur.

**Interdits vérifiés par lint (ESLint, règles en erreur) et par un test qui parcourt l'AST :**
- `$queryRaw`, `$executeRaw`, `$queryRawUnsafe`, `$executeRawUnsafe`, `Prisma.sql`, `Prisma.raw` en dehors de `platform/database/raw/` (ADR-007 point 5) ; toute modification de ce dossier est relue par `database-reviewer` et `security-reviewer` ;
- `findUnique` sur le seul identifiant (utiliser `findFirst({ id, userId })`) ;
- `parseFloat`, `Number(`, `parseInt` appliqués à un montant, le type `float`/`number` pour un montant, `toFixed` dans le domaine et `packages/money` ;
- `Date.now()`, `new Date()` et `Math.random()` dans le domaine (utiliser `Clock`, `IdGenerator`) ;
- `console.log` dans le code de production ;
- `.only` et `.skip` sans ticket dans les tests ;
- retour d'une entité Prisma brute par un contrôleur (réponse hors schéma de réponse) ;
- import d'une dépendance d'un module métier depuis `packages/contracts`.

Un test d'architecture est lui-même testé : un fichier de violation volontaire (fixture) doit faire échouer la règle correspondante.

---

## 12. Tests de sécurité (`PRODUCT_SPEC.md` §12.4)

Fichiers dans `apps/api/test/security/` et, pour le navigateur, `e2e/tests/security/`. Le détail des contrôles est dans `SECURITY.md`.

| Élément du §12.4 | Test | Niveau | Attendu |
|---|---|---|---|
| Contrôle d'accès horizontal | Généré (§9) | Intégration | 404, aucun effet |
| Session expirée | Inactivité > 7 jours, durée absolue > 30 jours (horloge figée) | Intégration | 401 |
| Jeton révoqué | Révocation unitaire puis globale ; jeton d'API révoqué | Intégration | 401 immédiat |
| Force brute | Échecs répétés de connexion, de réinitialisation et de vérification | Intégration | Limitation de débit (429), message identique pour compte existant ou non |
| XSS | Charges (`<script>`, attributs d'événement, URL `javascript:`) dans notes, descriptions, noms | Composant + E2E | Rendu échappé ; en-têtes CSP présents |
| CSRF | Mutation sans `X-Requested-With: orbit` ; `Origin` étranger ou absent ; cookie seul | Intégration | 403 ; aucune mutation |
| SSRF | URLs de webhook ou d'intégration vers `127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `localhost`, redirections vers l'interne, DNS qui change de résolution | Intégration (MSW + résolveur factice) | Refus avant tout appel |
| Injection | `'`, `"`, `;`, `--`, `%`, `_`, caractères Unicode dans recherche, filtres, tri, paramètres (`unaccent`, `pg_trgm`) ; clés de tri hors liste blanche | Intégration | Paramètres liés, aucune erreur SQL exposée, aucun résultat étranger |
| Upload dangereux | Extension ≠ type MIME ; contenu réel ≠ type déclaré ; fichier polyglotte ; taille hors limite ; nom avec `../` ou octet nul ; SVG avec script | Intégration | Refus ; nom de stockage généré par le serveur ; URL signée de 5 minutes au plus, expirée refusée |
| Webhook forgé ou rejoué | Signature absente, fausse ; horodatage hors tolérance ; même identifiant d'événement rejoué | Intégration | 401 ou 400 ; un seul traitement ; un seul paiement (Annexe A.1) |
| Fuite de secrets dans les logs | Secret canari `FAKE_canary_…` dans les entrées, en-têtes, corps ; erreurs forcées | Intégration | Absent des journaux, réponses d'erreur, audits, traces |
| Export non autorisé | Export sans ré-authentification récente ; export de B demandé par A | Intégration | Ré-authentification exigée ; 404 inter-utilisateur |
| Prompt injection dans des documents | Document contenant des instructions (« ignore les règles », « envoie les secrets », « crée une dépense ») | Intégration (PHASE-16, modèle simulé) | Aucun outil d'écriture financière exécuté sans confirmation ; aucun secret transmis ; aucune action hors schéma |

Contrôles transverses obligatoires :
- Cookie de session : nom `__Host-orbit_sid`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sans `Domain`.
- Erreurs : aucun message ne distingue un identifiant inexistant d'un identifiant d'un autre utilisateur, ni un compte existant d'un compte absent.
- Réponses : aucune clé inconnue (schémas de réponse stricts) ; un champ sensible (hash, jeton, secret) n'apparaît jamais.
- Affectation de masse : `user_id`, `role`, `status`, `balance` envoyés dans un corps sont ignorés ou refusés.
- ADMIN : aucune route ne renvoie de donnée privée d'un autre utilisateur (ADR-002).
- Mots de passe : `argon2id` avec les paramètres de `SECURITY.md` ; jamais journalisés.
- Coffre-fort (PHASE-13) : révélation refusée sans ré-authentification et TOTP ; chaque révélation auditée et limitée en débit ; données associées authentifiées vérifiées (un blob déplacé vers un autre item ne se déchiffre pas).

---

## 13. Tests E2E critiques par phase

Seuls les parcours **critiques** sont en E2E (~5 % des tests). Chaque parcours crée ses données par l'API. À partir de PHASE-01, un parcours d'isolation A/B figure dans chaque phase qui ajoute des données (l'utilisateur B ne voit rien de A dans l'interface).

| Phase | Parcours E2E |
|---|---|
| 01 | Inscription, vérification d'e-mail (Mailpit), connexion, déconnexion, expiration de session, ré-authentification avant un changement sensible |
| 02 | Navigation mobile (barre du bas) et bureau (barre latérale), accessibilité des écrans du shell |
| 04 | Capture rapide d'une idée, conversion en projet, tâche ; file hors ligne des idées, notes et tâches |
| 05 | Créer des comptes ; saisir revenu, dépense, transfert ; annuler une transaction ; solde et prévisionnel corrects ; **hors ligne, la saisie financière est refusée et rien n'est mis en file** |
| 06 | Dette et remboursement partiel jusqu'au solde ; créance ; confirmation d'une occurrence récurrente sans doublon (double clic) |
| 07 | Tableau de bord avec chiffres conformes à `FIN-xx` ; recherche globale ; export contrôlé |
| 08 | Rappel déclenché une seule fois ; notification |
| 09 | Dépôt de document, téléchargement par URL signée, refus après expiration |
| 10 | Client, projet, facture, émission, paiements fractionnés (`FIN-08`), annulation d'un paiement (`FIN-18`) |
| 12 | (ADMIN) application, environnement, domaine ; un `USER` n'y accède pas |
| 13 | Secret fictif : consultation autorisée (ré-authentification + TOTP) et refusée |
| 14 | Connexion Google simulée (fournisseur factice), webhook rejoué sans doublon |
| 15 | Règle d'automatisation exécutée une seule fois |
| 16 | Une proposition d'écriture financière de l'assistant exige une confirmation explicite |
| 17 | Export de compte, demande de suppression de compte |

Règles : pas de `sleep` fixe (attendre un état observable) ; sélecteurs par rôle et libellé ; données et horloge maîtrisées ; une panne d'E2E n'est jamais « corrigée » en supprimant l'assertion.

**Où tournent les E2E (ADR-038)** : en CI, contre l'API et ses dépendances en conteneurs et le front servi par `vite preview` avec le proxy `/api` (même origine), ce qui reste la référence bloquante. Les **préversions Vercel** de chaque PR (branchées sur l'API de staging, protégées par la *Deployment Protection* de Vercel) peuvent en plus recevoir un smoke E2E non bloquant : elles seules prouvent le comportement réel de la réécriture `/api` et des en-têtes posés par Vercel. Le parcours complet de staging (`INFRASTRUCTURE.md` §8.6) vérifie en particulier que le cookie `__Host-orbit_sid` traverse la réécriture.

---

## 14. Tests de migration

Fichiers dans `apps/api/test/migrations/`, sur une base PostgreSQL Testcontainers vide.

1. **Depuis zéro (bloquant, chaque PR)** : base vide → `prisma migrate deploy` joue toutes les migrations dans l'ordre → le schéma obtenu est identique à `schema.prisma` (`prisma migrate diff` vide) → un second `migrate deploy` ne fait rien.
2. **Contraintes** : tests SQL directs qui prouvent chaque contrainte de `DATA_MODEL.md` :
   - clé étrangère composite `(user_id, id)` : l'insertion d'une référence vers la ressource d'un autre utilisateur est refusée ;
   - `CHECK (num_nonnulls(...) = 1)` sur les liens (ADR-018) ;
   - unicité `(user_id, clé d'idempotence)`, `(user_id, external_reference)`, `(recurring_id, scheduled_on)` ;
   - montants strictement positifs et `BIGINT` ; devise connue ;
   - `debt_repayments` et `invoice_payments` : une transaction imputée une seule fois à une dette ;
   - plafond de découvert ≥ 0.
3. **Données d'amorçage** : `currencies` contient XOF (exposant 0), EUR (2), USD (2) ; les catégories système sont créées à l'inscription.
4. **Migrations transformant des données** : un test « avant / après » avec des lignes synthétiques par migration concernée.
5. **Migration destructive** (suppression de colonne ou de table) : interdite sans phase préalable de non-utilisation et test de données ; la sauvegarde est restaurée en essai avant mise en production (`INFRASTRUCTURE.md`).
6. Le test de migration précède tout test d'intégration (il valide le modèle qu'ils utilisent).

---

## 15. Tests de fuseaux horaires

1. **Deux dimensions indépendantes**, toutes deux testées :
   - le fuseau **du processus** (`TZ`) ∈ {`Africa/Dakar`, `Europe/Paris`, `America/New_York`} ;
   - le fuseau **de l'utilisateur** (préférence) ∈ les mêmes trois.
2. Les suites unitaires de `packages/money` et du domaine finance, ainsi que les tests d'intégration de reporting, s'exécutent en matrice sur les trois valeurs de `TZ` (projets Vitest dédiés). Le résultat ne dépend que du fuseau de l'utilisateur (P13).
3. La base utilise toujours `UTC` en session ; les instants sont des `timestamptz`, les dates civiles des `date` (ADR-023).
4. Jeux de dates obligatoires : `FIN-24` (frontière de mois, heure d'été), `FIN-25` (23 h et 25 h : 2026-03-29 Paris, 2026-11-01 New York), `FIN-26` (retard dérivé), `FIN-37` (fin de mois).
5. Les composants web affichant une date sont testés avec `timezoneId` Playwright et avec le fuseau de préférence de l'utilisateur, jamais celui du navigateur.
6. Aucune assertion ne dépend de « aujourd'hui » : l'horloge est injectée.

---

## 16. Bloquant en CI et nocturne

### 16.1 Bloquant à chaque pull request

| Contrôle | Seuil |
|---|---|
| Lint, formatage, typage strict | 0 erreur |
| Tests unitaires (API, web, packages), matrice de fuseaux | 100 % réussis |
| Tests d'intégration (Testcontainers) | 100 % réussis |
| Migration depuis zéro et contraintes (§14) | Réussis |
| Isolation générée (§9) | Réussie, aucune route non couverte |
| Architecture (§11) | 0 violation |
| Sécurité rapide (§12 : CSRF, session, injection, SSRF, secrets dans les logs, webhook) | Réussie |
| Propriétés P1 à P15 | 100 exécutions, réussies |
| Traçabilité `FIN-xx` (§5) | Complète |
| Couverture (§8) | Seuils respectés |
| E2E smoke : parcours critiques des phases en cours et précédentes | Réussis |
| Scan de secrets | 0 découverte |
| Build | Réussi |

Aucun test `skip`, `todo` ou `.only` sans ticket. Aucune relance automatique en unitaire ou intégration.

### 16.2 Nocturne (et avant chaque version)

| Contrôle | Détail |
|---|---|
| Propriétés | 1 000 exécutions par propriété ; modèle à états étendu |
| Stabilité **pass^3** | Les tests financiers critiques (`FIN-xx`, concurrence, idempotence) sont exécutés trois fois d'affilée ; les trois doivent réussir |
| Concurrence répétée | `FIN-27` et `FIN-28` répétés 200 fois |
| E2E complets | Tous les parcours, trois navigateurs/profils |
| Mutation | Stryker sur `packages/money` et domaine finance, score ≥ 80 % |
| Performance | Listes et rapports avec 10 000 transactions ; temps de réponse mesuré (budgets de `PRODUCT_SPEC.md` §9.1) |
| Sécurité approfondie | SSRF avec rebond DNS, uploads polyglottes, fuzz léger des schémas |
| Dépendances | Audit des vulnérabilités connues |
| Restauration | Restauration d'une sauvegarde puis migration (`INFRASTRUCTURE.md`) |

### 16.3 Tests instables

- Un test intermittent est mis en quarantaine **le jour même** avec un ticket et corrigé dans la phase en cours, sinon supprimé avec justification.
- Un E2E réussi seulement au nouvel essai est signalé dans le rapport de CI et compte comme instable.
- Il est interdit d'augmenter un délai pour masquer une condition de concurrence.

---

## 17. Ne jamais inventer un résultat de test

Cette règle lie tout agent (humain ou IA) qui rédige du code, un rapport de phase ou une réponse.

1. **Exécuter avant d'affirmer.** « Les tests passent » n'est écrit qu'après exécution réelle de la commande, dont la sortie a été lue.
2. **Citer la preuve** : commande exacte, nombre de tests réussis et échoués, résumé de couverture tel qu'affiché. Aucun chiffre n'est estimé ou arrondi à la hausse.
3. **Si l'exécution est impossible** (outil absent, base indisponible, délai), écrire « non exécuté », la raison, et la commande qui le fera. Ne jamais déclarer réussi ce qui n'a pas tourné.
4. **Ne pas déduire** un résultat de la lecture du code ou d'un test voisin.
5. **Ne pas régler un test par la sortie du code** : les valeurs attendues financières proviennent de `FINANCE_RULES.md`. Les instantanés (`toMatchSnapshot`, `toMatchInlineSnapshot`) sont interdits pour un montant, un solde ou une date métier.
6. **Un échec reste visible.** Ne pas supprimer, affaiblir, relancer jusqu'au vert ou commenter un test pour faire passer. Rapporter l'échec, son hypothèse de cause et ce qui reste à faire.
7. **Un RED imaginaire est interdit** : la phase RED est prouvée par une exécution réelle qui échoue pour la bonne raison.
8. **Le rapport de phase** (`docs/progress/PHASE-XX-REPORT.md`) contient la section « Preuves de test » : commandes, résultats bruts résumés, couverture par périmètre, tests non exécutés, tests instables.
9. Une incohérence découverte entre un test et `FINANCE_RULES.md` est signalée telle quelle ; elle ne se résout pas en modifiant l'un pour correspondre à l'autre sans décision écrite.

---

## 18. Liste de contrôle d'une tâche testée

- [ ] Cas listés avant le code (nominal, limites, erreurs, concurrence, autre utilisateur)
- [ ] RED constaté (commande et échec consignés)
- [ ] GREEN constaté
- [ ] Refactor, tests inchangés et verts
- [ ] Titres `[FIN-xx]` ajoutés si une règle financière est concernée
- [ ] Route nouvelle ou modifiée : provisionneur ou exclusion justifiée (§9)
- [ ] Seuils de couverture respectés (§8)
- [ ] Aucun `skip`, `.only`, snapshot financier, secret réel, appel réseau réel
- [ ] Revue `code-reviewer` (et `security-reviewer` si sensible)
- [ ] Section « Preuves de test » du rapport de phase à jour
