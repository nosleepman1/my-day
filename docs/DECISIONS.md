# ORBIT : registre des décisions (ADR)

- **Statut :** référence. **Ce document prime sur `PRODUCT_SPEC.md`** en cas de divergence.
- **Date :** 11 octobre 2026
- **Décideur :** propriétaire du produit (Abdou)

Format de chaque entrée : décision, raison, conséquence. Une décision ne se modifie pas : on ajoute une nouvelle ADR qui la remplace (`Remplacée par ADR-0xx`).

---

## ADR-001 : Modèle produit, SaaS à espaces personnels isolés

- **Décision :** ORBIT est un SaaS. Chaque utilisateur possède **un seul espace personnel**, totalement isolé.
  - Pas d'équipe, pas de membres, pas d'invitations, pas de partage entre utilisateurs.
- **Raison :** choix du propriétaire. Chaque utilisateur gère sa vie : finances, idées, planification, intégrations mail et calendrier.
- **Conséquences :**
  - Le concept de `workspace` du cahier est **supprimé**. Partout où `PRODUCT_SPEC.md` mentionne `workspace_id`, il faut lire **`user_id`** (le propriétaire de la donnée).
  - Les tables `workspaces` et `workspace_members` ainsi que les rôles OWNER, MEMBER et VIEWER n'existent pas.
  - Les §2.1 à §2.3 du cahier s'appliquent en remplaçant « workspace » par « utilisateur » : isolation, contrôles, tests d'accès croisé.

## ADR-002 : Rôles USER et ADMIN, zone Dev réservée

- **Décision :** deux rôles plateforme.
  - **`USER`** : tout utilisateur inscrit.
  - **`ADMIN`** : le propriétaire de la plateforme.
- **Modules réservés à ADMIN (zone « Dev ») :** applications, environnements, domaines, serveurs, services techniques, historique technique, coffre-fort, console d'administration.
- **Règle de confidentialité absolue :** ADMIN **ne lit jamais** les données privées d'un autre utilisateur (finances, notes, idées…).
  - La console d'administration n'expose que des métadonnées de compte : e-mail, date d'inscription, statut, volumétrie agrégée.
- **Conséquence :** un guard `@Roles('ADMIN')` protège la zone Dev. Les données de la zone Dev appartiennent à l'utilisateur ADMIN, avec le même cloisonnement par `user_id` que le reste.

## ADR-003 : Développement intégral en phases, sans MVP

- **Décision :** l'application complète est construite par une IA en **18 phases (PHASE-00 à PHASE-17)**, décrites dans `docs/phases/`.
- **Principes :**
  - Pas de « V1 » ni de « MVP ».
  - Chaque phase est **autoportante** : elle liste les documents à charger, son périmètre, ses tables, ses endpoints, ses écrans, ses tests et sa Definition of Done.
  - À la fin de chaque phase, l'IA rédige `docs/progress/PHASE-XX-REPORT.md`. La phase suivante démarre en lisant ce rapport.
- **Raison :** l'IA doit toujours disposer du contexte complet, alors que sa fenêtre de contexte est limitée.

## ADR-004 : Monorepo pnpm

- **Arborescence :**
  - `apps/api` (NestJS)
  - `apps/web` (React)
  - `packages/contracts` (schémas Zod partagés : DTO, enums, codes d'erreur)
  - `packages/money` (arithmétique monétaire et formatage)
  - `packages/config` (tsconfig, eslint, prettier)
- **Outils :** pnpm workspaces seuls. Turborepo uniquement si la CI dépasse 5 minutes. Pas de Nx.

## ADR-005 : Backend NestJS avec l'adaptateur Express

- **Décision :** NestJS + **Express**, et non Fastify. C'est un écart assumé au §7.1, qui disait « Fastify si compatible ».
- **Raisons :**
  - L'upload par Multer fonctionne directement.
  - L'écosystème de sessions et de CSRF est mûr.
  - Le code généré par les IA cible Express.
  - Le gain de performance de Fastify n'a aucun intérêt à cette échelle.

## ADR-006 : Authentification par session serveur et cookie HttpOnly

- **Session :**
  - Cookie `__Host-orbit_sid`, avec les attributs HttpOnly, Secure, SameSite=Lax et Path=/.
  - Le cookie contient un jeton **opaque** de 256 bits. La base stocke son empreinte SHA-256 dans la table `sessions`.
  - **Pas de JWT** pour le navigateur. L'endpoint `/auth/refresh` du §16 est supprimé.
  - Expiration glissante après 7 jours d'inactivité, durée absolue de 30 jours. Révocation unitaire ou globale.
- **Mots de passe :** argon2id (`m=64 MiB`, `t=3`, `p=1`, à calibrer).
- **Parcours de compte :** inscription ouverte avec vérification de l'e-mail, réinitialisation par jeton à usage unique valable 30 minutes.
- **CSRF :** SameSite=Lax, en-tête `X-Requested-With: orbit` obligatoire et vérification d'`Origin` sur chaque mutation.
- **Même origine :** le front et l'API sont servis sur le même domaine, `/api` passant par le reverse proxy.
- **MFA :** **pas de MFA pour l'instant** (décision du propriétaire). Les actions sensibles exigent une **ré-authentification par mot de passe** (`reauth_at` sur la session) : changement d'e-mail ou de mot de passe, export, suppression du compte. Le TOTP est livré en **PHASE-13** et devient obligatoire pour révéler un secret du coffre.
- **Clients non navigateur** (n8n, intégrations) : jetons d'API opaques hachés, à portée limitée, en **PHASE-14**.

## ADR-007 : Isolation des données par `user_id`

1. **Colonne de cloisonnement :** toute table métier porte `user_id`.
2. **Contexte de requête :** le guard d'authentification résout l'utilisateur, puis **nestjs-cls** enregistre `{ userId, role, requestId }`.
3. **Extension Prisma `tenantScope` :**
   - elle injecte `user_id` dans `where` et `data` ;
   - elle lève une erreur si le contexte est absent ;
   - `findUnique` sur le seul identifiant est interdit au profit de `findFirst({ id, userId })`.
4. **Clés étrangères composites** `(user_id, id)` entre tables métier. PostgreSQL garantit ainsi qu'une donnée ne référence jamais celle d'un autre utilisateur.
5. **SQL brut :** `$queryRaw` et `$executeRaw` sont interdits par lint en dehors de `platform/database/raw/`. Ce dossier est relu à chaque modification.
6. **RLS PostgreSQL :** non activée au départ. Elle sera réévaluée en PHASE-17.
7. **Accès à la donnée d'un autre utilisateur :** la réponse est **404**, jamais 403, et l'événement est audité.
8. **Tâches de fond :** jobs et webhooks transportent `userId`. Le worker rejoue le contexte de requête avant tout accès à la base.

## ADR-008 : Montants en entiers, unités mineures

- **Stockage :** `BIGINT` en unités mineures, et `currency CHAR(3)` selon l'ISO 4217.
- **FCFA (XOF) :** exposant 0, donc **1 unité = 1 FCFA, sans décimale**. EUR et USD : exposant 2.
- **Table `currencies` :** `code`, `exponent`, `symbol`. Devise par défaut : **XOF**.
- **API :** les montants circulent en **chaîne de chiffres** (`"150000"`), jamais en `number`.
- **Code :** toute arithmétique passe par `packages/money` (`Money { minor: bigint; currency }`). Il est interdit d'utiliser `float`, `Number()` ou `parseFloat` sur un montant.
- **Types `NUMERIC` :** réservés aux taux de change (`NUMERIC(20,10)`), aux taux de taxe (`NUMERIC(7,4)`) et aux quantités de facture (`NUMERIC(12,3)`).
- **Arrondi :** une seule règle, half-up, appliquée par ligne. Voir `FINANCE_RULES.md`.

## ADR-009 : Registre financier à deux niveaux

- **Structure :** `transactions` est l'en-tête de l'événement métier. `ledger_entries` porte les mouvements par compte : `direction` (DEBIT ou CREDIT), `amount_minor`, `currency`.
  - Un revenu ou une dépense produit 1 écriture.
  - Un transfert produit 2 écritures.
  - Les frais sont une transaction EXPENSE séparée, liée par `parent_transaction_id`.
- **Solde réalisé :** `opening_balance + Σ CREDIT − Σ DEBIT` des écritures dont la transaction est `VALIDATED`.
- **Portée :** pas de comptabilité en partie double complète (§1.4).

## ADR-010 : Contrats Zod partagés

- **Source unique :** les schémas Zod de `packages/contracts` valident le back (via `nestjs-zod`) et le front (React Hook Form).
- **Documentation :** l'OpenAPI est généré à partir de ces schémas.
- **Réponses :** jamais d'entité Prisma brute. Chaque réponse passe par un `select` explicite et un schéma de réponse qui retire les clés inconnues.

## ADR-011 : Identifiants UUIDv7

Toutes les clés primaires sont des UUIDv7, générés côté application.

## ADR-012 : Traitements asynchrones avec Redis et BullMQ

- **Calendrier :** introduits en **PHASE-08**, derrière un port `JobQueue`. Avant PHASE-08, aucune fonctionnalité ne dépend d'un job.
- **Contenu d'un job :** `{ jobType, version, userId, entityId, correlationId, idempotencyKey }`. Jamais de secret ni de donnée sensible dans le payload.
- **Table `outbox_events` :** pour les événements critiques (finance, intégrations). Elle est écrite dans la même transaction SQL que la donnée.
- **Processus :** l'API et le worker partagent la même base de code, mais tournent dans deux processus distincts (`main.ts` et `worker.ts`).

## ADR-013 : Stockage de fichiers

- **Interface :** port `StoragePort` compatible S3.
- **Implémentations :**
  - développement et tests : adaptateur sur le système de fichiers local ;
  - production : Cloudflare R2 (juridiction UE) ou Backblaze B2.
- **Accès :** fichiers toujours privés, servis par URL signée valable au plus 5 minutes.

## ADR-014 : E-mail

- **Interface :** port `MailPort`.
- **Développement :** Mailpit, dans Docker Compose.
- **Production :** fournisseur transactionnel (Brevo ou Resend), choisi en PHASE-03.

## ADR-015 : Hébergement et exploitation

> **Amendée par ADR-038** : front sur Vercel, observabilité par Sentry SaaS, pas de VPS « ops ».

- **Serveur :** VPS en UE, Docker Compose, Caddy (HTTPS automatique).
- **Environnements :** `local`, `staging` et `production`, chacun avec ses propres secrets.
- **Sauvegardes :** PostgreSQL et fichiers, chiffrées avec restic, chez **un autre fournisseur** que le VPS. Une restauration testée est exigée avant la mise en production.
- **Objectifs :** RPO de 24 heures, RTO de 4 heures.
- **Calendrier :** tout cela est mis en place en **PHASE-03**, avant toute donnée financière réelle.

## ADR-016 : Frontend

> **Amendée par ADR-038** : front hébergé sur Vercel.

- **Stack :** React, TypeScript strict, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query, React Router, React Hook Form et Zod.
- **Mobile :** **mobile-first**. PWA installable (`vite-plugin-pwa`).
- **Hors ligne :** file de capture en IndexedDB pour les idées, notes et tâches. **Jamais d'écriture financière hors ligne.**
- **Langue :** interface en français, avec i18n prête (`fr` par défaut).

## ADR-017 : Recherche

Recherche plein texte PostgreSQL avec `unaccent` et `pg_trgm`, toujours filtrée par `user_id`. Pas de moteur externe.

## ADR-018 : Liens entre entités

- **Pas de colonnes polymorphes** `entity_type` et `entity_id`.
- **Remplacement :** des colonnes de clé étrangère nullables, une par cible, avec la contrainte `CHECK (num_nonnulls(...) = 1)`. Ou bien des tables de liaison explicites.
- **Exemples :** `note_links`, `document_links`, `reminders`, `environment_domains`.

## ADR-019 : Coffre-fort (zone Dev, ADMIN)

- **Chiffrement :** libsodium XChaCha20-Poly1305, sur le principe de l'enveloppe.
  - Une clé de données (DEK) par item, elle-même chiffrée par une clé maître (KEK) versionnée.
  - Données associées authentifiées (AAD) : `user_id`, `item_id`, `key_version`, `format_version`.
- **Clé maître :** stockée dans un fichier secret monté (root:600), **hors de la base et hors des sauvegardes de la base**. Une copie hors ligne est conservée séparément.
- **Révélation d'un secret :** ré-authentification et TOTP. Chaque révélation est auditée et limitée en débit.
- **Calendrier :** livré en PHASE-13. Aucun secret réel n'y est stocké avant la validation des tests de sécurité de cette phase.

## ADR-020 : Retard dérivé

Le retard d'une facture ou d'une dette est calculé, jamais stocké : `is_overdue = due_date < aujourd'hui (fuseau de l'utilisateur) ET solde > 0 ET statut non terminal`.

## ADR-021 : Tests

- **Outils :** Vitest pour l'API (transpilation TypeScript, ADR-040) et pour le web, Testcontainers PostgreSQL pour l'intégration, Playwright pour l'E2E, fast-check pour les invariants financiers.
- **Couverture :** au moins 80 % au global, **100 % sur `packages/money` et sur le domaine finance**.
- **Isolation :** un test d'isolation entre utilisateurs est **généré pour chaque route** et bloque la CI.

## ADR-022 : Langues

- **Code :** identifiants, tables et commits en **anglais**.
- **Interface et documentation :** en **français**.

## ADR-023 : Temps

- **Stockage :** les instants en UTC (`timestamptz`), les dates civiles en `date`.
- **Fuseau de l'utilisateur :** `Africa/Dakar` par défaut.
- **Tests :** ils forcent aussi `Europe/Paris` et `America/New_York` pour couvrir les changements d'heure.

## ADR-024 : Modules activables par utilisateur

- **Mécanisme :** `user_preferences.enabled_modules` permet de masquer un module, par exemple le module Pro (clients, contrats, factures).
- **Portée :** l'accès aux modules réservés à ADMIN ne dépend **pas** de ce champ. Il est réglé par le rôle.

## ADR-025 : Fournisseur d'IA

- **Fournisseur :** l'API Claude d'Anthropic, avec le modèle le plus récent disponible au moment de la PHASE-16.
- **Garde-fous du §4.23 :** outils à schéma strict, aucun SQL libre, aucun secret transmis, confirmation obligatoire de toute écriture financière.

---

## Arbitrages de cohérence (11 octobre 2026, après la rédaction documentaire)

Ces ADR tranchent les incohérences relevées entre les documents rédigés en parallèle. Elles **priment** sur toute formulation contraire dans les autres documents.

### ADR-026 : Mode d'inscription

- **Variable :** `REGISTRATION_MODE` = `closed` | `allowlist` | `open` (introduite en PHASE-01).
- **Calendrier d'ouverture :**
  - `allowlist` (accès sur invitation) jusqu'à la fin de PHASE-08 ;
  - `open` au plus tôt après PHASE-08.

### ADR-027 : Tables de plateforme introduites en PHASE-01

- **Tables concernées :** `currencies` (avec son seed : XOF, EUR, USD) et `idempotency_keys`.
- **Raison :** ce sont des tables transverses, rangées dans `platform/` et non dans le module finance. Elles sont créées dès PHASE-01, car `user_preferences.default_currency`, le budget de projet et la capture hors ligne en ont besoin avant PHASE-05.
- **Impact sur PRODUCT_SCOPE §4 :** M04 les liste toujours ; c'est cette ADR qui fait foi.

### ADR-028 : Emplacement du SQL brut (amende ADR-007, point 5)

Le seul dossier autorisé pour le SQL brut est `apps/api/src/platform/database/raw/`.

### ADR-029 : Exception à ADR-018 pour les journaux

- **Tables concernées :** `audit_logs` et `outbox_events`.
- **Exception :** ces deux tables utilisent `entity_type` et `entity_id`, sans clé étrangère.
- **Raison :** ce sont des journaux, pas des relations métier. Ils doivent survivre à la suppression de l'entité.
- **Portée :** aucune autre table ne bénéficie de cette exception.

### ADR-030 : Statuts de paiement dérivés et imputation unique

1. **Dettes et factures :** la base ne stocke que le **cycle de vie** (factures : `DRAFT`, `ISSUED`, `CANCELLED` ; dettes : `OPEN`, `CANCELLED`, `WRITTEN_OFF` si une décision est prise plus tard). L'**état de paiement** (`UNPAID`, `PARTIALLY_PAID`, `PAID`) et le **retard** sont **calculés** à partir des imputations valides. Conséquence : annuler un paiement rouvre la dette ou la facture sans mise à jour croisée.
2. **Imputation :** `invoice_payments` et `debt_repayments` sont la **seule** source d'imputation d'un paiement. La colonne `transactions.invoice_id` **n'existe pas**, car une transaction peut payer plusieurs factures.
3. **Documents à aligner :** `FINANCE_RULES.md` et les fiches de phase doivent se lire ainsi. Leurs règles de calcul restent inchangées.

### ADR-031 : Accès aux clés maîtres (amende ADR-019)

- **Clés concernées :** la clé maître du coffre (`VAULT_KEK`) et celle des jetons d'intégration (`INTEGRATION_TOKENS_KEK`). Ce sont deux clés **distinctes**.
- **Montage :** fichiers secrets montés en lecture seule (mode `0400`), appartenant à l'UID non-root du conteneur API ou worker.
- **Raison :** le mode `root:600` d'ADR-019 serait illisible par le conteneur.
- **Inchangé :** les deux clés restent hors de la base et hors des sauvegardes de la base.

### ADR-032 : Clés d'API pour tous les utilisateurs

- **Décision :** tout utilisateur peut créer des clés d'API à portée limitée, par exemple pour son propre n8n. Livraison en PHASE-14.
- **Remplace :** la mention « clés d'API : ADMIN » de PRODUCT_SCOPE M13.
- **Garanties :** une clé agit uniquement dans l'espace de son propriétaire, avec ses portées. Elle ne peut jamais révéler un secret du coffre.

### ADR-033 : MFA obligatoire pour ADMIN à partir de PHASE-13

- **ADMIN :** dès la livraison de PHASE-13, la zone Dev et la console d'administration exigent un TOTP actif.
- **USER :** la MFA reste facultative.

### ADR-034 : Exports avant les jobs

- **Avant PHASE-08 :** les exports de PHASE-07 sont produits en flux synchrone au téléchargement (taille bornée).
- **À partir de PHASE-08 :** ils passent par un job, avec un fichier temporaire sur `StoragePort` (PHASE-09).
- **Table `export_jobs` :** sa structure est conservée ; elle est utilisée pleinement à partir de PHASE-08.

### ADR-035 : Gmail et vérification Google

- **Contrainte :** les portées Gmail de lecture sont « restricted ». Une ouverture publique impose une vérification Google et un audit de sécurité tiers (CASA), renouvelé chaque année.
- **Tant que cet audit n'est pas obtenu :** l'intégration Gmail reste en mode test (100 utilisateurs maximum, sur liste blanche). Alternative : ingestion par transfert d'e-mail vers une adresse dédiée.
- **Moment de la décision finale :** au démarrage de PHASE-14.

### ADR-036 : Suppression de compte avant PHASE-17

Si l'ouverture publique (ADR-026) intervient avant PHASE-17 :
- l'export et la suppression de compte sont traités manuellement par l'ADMIN, selon le runbook `account-deletion` d'`INFRASTRUCTURE.md` ;
- ce runbook impose un délai de traitement de 30 jours au maximum.

### ADR-037 : Décisions financières complémentaires acceptées

1. **Statut à la création :** les transactions BORROWING, LOAN et ADJUSTMENT sont créées directement en `VALIDATED`.
2. **Découvert :** chaque compte porte un plafond `overdraft_limit_minor`, à 0 par défaut (voir H3).
3. **Montant maximal :** 10^18 unités mineures.
4. **Trop-perçu de facture :** traitement `CUSTOMER_CREDIT`, avec une transaction enfant ; jamais compté en revenu.
5. **Sur-remboursement en mode ADVANCE :** l'excédent crée une dette ou une créance de sens opposé.

### ADR-038 : Hébergement hybride, front sur Vercel et back sur un VPS (amende ADR-015 et ADR-016)

- **Date :** 11 octobre 2026. Décision validée par le propriétaire.

**Front (`apps/web`)** : hébergé sur **Vercel**.
- Le projet Vercel pointe sur le dossier `apps/web`, avec une installation pnpm depuis la racine du monorepo. `packages/contracts` et `packages/money` sont intégrés au bundle au moment du build : aucun code partagé n'existe à l'exécution.
- Une préversion est déployée pour chaque PR.
- Les en-têtes de sécurité du front (CSP, HSTS, `frame-ancestors`, etc.) sont définis dans `apps/web/vercel.json`.

**Même origine conservée (ADR-006)** :
- `vercel.json` réécrit `/api/:path*` vers `https://api.<domaine>/api/:path*`, sur le VPS.
- Le navigateur ne voit qu'une seule origine : le cookie `__Host-orbit_sid` reste un cookie de premier niveau et aucun CORS n'est nécessaire.
- L'API compare l'en-tête `Origin` avec `APP_ORIGIN`, l'origine publique du front, et fait confiance à `X-Forwarded-*` derrière Caddy.
- Un appel direct à `api.<domaine>` n'emporte jamais de cookie de session, car celui-ci n'est lié qu'au domaine du front.
- Les webhooks entrants (Google, WhatsApp, Telegram) visent directement `api.<domaine>`.

**VPS (OVH)** :
- **Services :** Caddy (pour l'API et n8n uniquement), `api`, `worker`, Redis (PHASE-08), **n8n**, PostgreSQL (sauf si OD-7 retient Neon) et Uptime Kuma.
- **Capacité minimale :** 4 Go de RAM avec 2 Go de swap, 2 vCPU et 40 Go de SSD. **Recommandé :** 8 Go si le prix est proche.
- **Limites mémoire** fixées dans Compose pour chaque service.

**Observabilité** : **Sentry SaaS**, offre gratuite, région UE, avec nettoyage des données personnelles (`sendDefaultPii: false`, `beforeSend`), à la place de GlitchTip. Il n'y a plus de VPS « ops » séparé.

**Staging** :
- front : préversions Vercel ;
- API : second projet Compose sur le même VPS, avec sa propre base, ses propres secrets et des limites mémoire basses. Si la RAM ne suffit pas, il est démarré seulement à la demande.

**n8n** :
- accessible sur `n8n.<domaine>` derrière Caddy, avec authentification ;
- appelle l'API avec une clé à portée limitée (ADR-032) ;
- workflows versionnés dans `infra/n8n/workflows/`.

**Raison du rejet du back sur Vercel** : le modèle serverless ne permet ni worker BullMQ, ni processus permanent pour les rappels, la synchronisation et les webhooks mis en file. Il limite aussi le corps des requêtes (environ 4,5 Mo) et multiplie les connexions Prisma.

**À vérifier en PHASE-03** :
- la durée maximale d'une réécriture externe sur Vercel. Les exports et les appels IA longs doivent rester sous cette limite, ou passer par un job et un lien de téléchargement ;
- la transmission de `Set-Cookie` à travers la réécriture.

### ADR-039 : argon2id via `node:crypto` plutôt que le paquet natif `argon2` (précise ADR-006)

- **Date :** 12 octobre 2026, PHASE-01 T2.
- **Contexte :** le contrôle d'application de Windows (Smart App Control) bloque le module natif non signé du paquet `argon2` sur le poste de développement, qui sert aussi de runner CI auto-hébergé. On ne modifie pas ce réglage de sécurité.
- **Décision :** le hachage utilise `crypto.argon2` de Node (OpenSSL, disponible depuis Node 24.7, exécuté dans le pool de threads libuv). Le format PHC (`$argon2id$v=19$m=…,t=…,p=…$sel$empreinte`) est écrit et lu par `apps/api/src/platform/auth/argon2-phc.ts`. Il est compatible avec les bibliothèques argon2 usuelles et ses coûts sont bornés à la lecture. `engines.node` passe à `>=24.7.0`.
- **Conséquences :** il n'y a plus aucun module natif tiers ni script d'installation pour le hachage, et le comportement est identique sous Windows et sur le VPS Linux. Les paramètres d'ADR-006 et la sémaphore de SECURITY.md §3.3 sont inchangés.

### ADR-040 : TypeScript compile et transpile l'API à la place de SWC (amende ADR-020)

- **Date :** 13 octobre 2026, PHASE-01 T6.
- **Contexte :** Smart App Control (Windows) bloque désormais le binaire natif non signé `@swc/core` (`swc.win32-x64-msvc.node`) sur le poste de développement, qui est aussi le runner CI. On ne modifie pas ce réglage de sécurité. Même situation que lefthook (remplacé par husky) et argon2 (ADR-039).
- **Décision :**
  - build et mode dev : `nest build` / `nest start` avec le builder `tsc` ; `tsconfig.build.json` émet du CommonJS (`module: CommonJS`, `moduleResolution: node10`) dans `dist/` ;
  - tests : un plugin Vite de `apps/api/vitest.config.ts` transpile les fichiers `.ts` avec `ts.transpileModule` (`emitDecoratorMetadata`, décorateurs hérités, `useDefineForClassFields: false`), à la place de `unplugin-swc` ;
  - `@swc/cli`, `@swc/core` et `unplugin-swc` sortent des dépendances de l'API. `@swc/core` reste présent comme dépendance optionnelle d'outils tiers, sans être chargé.
- **Conséquences :** le compilateur TypeScript est du JavaScript pur, que le contrôle d'application ne peut pas bloquer. Le build est un peu plus lent (quelques secondes) ; la vérification de types reste `pnpm typecheck`. Aucun changement pour le code applicatif.

### ADR-041 : PostgreSQL sur le VPS au démarrage (tranche OD-7)

- **Statut :** proposée en PHASE-03, **à valider par le propriétaire** (décision de coût).
- **Contexte :** OD-7 oppose PostgreSQL en conteneur sur le VPS OVH et Neon managé (région UE). ORBIT démarre avec un seul utilisateur réel ; le budget mémoire (INFRASTRUCTURE.md §10.1) donne ≈ 2,0 Go en production avec PostgreSQL, sur un VPS de 4 Go doté de 2 Go de swap.
- **Décision :** PostgreSQL 17 en conteneur sur le VPS (`infra/compose/compose.production.yml`), réseau `data` interne, rôles `orbit_owner` / `orbit_app` / `orbit_backup`, sauvegarde `pg_dump` quotidienne et avant chaque migration, chiffrée par restic vers un fournisseur distinct. **Un VPS de 8 Go est recommandé** si l'écart de prix est faible, pour garder le staging démarré en permanence.
- **Alternatives :** Neon (restauration à un instant donné, VPS soulagé de ~600 Mo) : écarté au démarrage pour éviter une quatrième dépendance SaaS, la latence inter-fournisseurs et le coût dès que l'offre gratuite ne suffit plus. Il redevient le choix par défaut si le RPO doit descendre sous 24 h ou si la base dépasse ~20 Go.
- **Conséquences :** la restauration est testable sur n'importe quel PostgreSQL 17 (`infra/scripts/restore.sh`, répétée en local en PHASE-03). Passer à Neon plus tard se fait par `pg_dump`/`pg_restore` sans changement de code (seules les URL de connexion changent).

### ADR-042 : e-mail transactionnel par relais SMTP chiffré (Brevo par défaut)

- **Statut :** acceptée en PHASE-03.
- **Contexte :** l'API envoie déjà ses e-mails par un adaptateur SMTP unique, testé contre Mailpit. La revue de sécurité de PHASE-01 (M8) exige un transport chiffré en déploiement.
- **Décision :** un seul adaptateur SMTP (`MAIL_DRIVER=smtp`) ; en staging et en production, `SMTP_SECURITY=starttls` (587, TLS 1.2 minimum, montée en TLS obligatoire) ou `tls` (465), identifiants obligatoires (`SMTP_USER`, `SMTP_PASSWORD_FILE`). Fournisseur par défaut : **Brevo** (entreprise française, données en UE, 300 e-mails par jour gratuits, relais SMTP standard). **Resend** reste possible par son relais SMTP, sans changement de code. Le staging n'envoie qu'aux destinataires de `MAIL_ALLOWLIST` (adresses ou `@domaine`).
- **Alternatives :** adaptateurs HTTP propres à chaque fournisseur : écartés, ils doubleraient le code et les tests pour un gain nul à ce volume.
- **Conséquences :** l'API refuse de démarrer en déploiement avec un SMTP en clair ou sans identifiants. SPF, DKIM et DMARC sont configurés par le propriétaire dans son DNS (runbook `first-setup`).

### ADR-043 : destination de la réécriture `/api` choisie par hôte dans `vercel.json`

- **Statut :** acceptée en PHASE-03 (lève le point « à vérifier » d'INFRASTRUCTURE.md §4.3).
- **Contexte :** un `vercel.json` statique ne lit pas les variables d'environnement ; or les préversions ne doivent jamais viser l'API de production.
- **Décision :** deux réécritures `/api/:path*` ordonnées : la première, conditionnée par `has: [{ type: "host", value: "orbit.<domaine>" }]`, vise l'API de production ; la seconde, sans condition, vise l'API de staging. Tout autre hôte (domaine de staging, préversions `*.vercel.app`) part donc vers le staging.
- **Alternatives :** `vercel.ts` ou un middleware de routage : plus souples, mais ajoutent du code exécuté à chaque requête pour un besoin satisfait par la configuration.
- **Conséquences :** le domaine de production est écrit en dur dans `vercel.json` (valeur fictive `orbit.example.com` à remplacer au branchement du domaine réel, runbook `first-setup`). Une CI vérifie que la réécriture de production reste liée à un hôte.

### ADR-044 : Modélisation de la tontine par catégories standards (tranche OD-1)

- **Statut :** acceptée en PHASE-05.
- **Date :** 15 octobre 2026.
- **Contexte :** OD-1 interrogeait la modélisation de la tontine (compte dédié, dette/créance ou simple catégorie).
- **Décision :** la tontine ne dispose d'aucun modèle relationnel ni type de compte dédié. Elle est modélisée par des catégories d'opérations standards (`income.tontine_payout` pour la main reçue et `expense.tontine` pour la cotisation), associables à des contreparties (nom du groupe ou organisateur).
- **Raison :** méthode la plus souple et universelle, sans alourdir le schéma relationnel de la finance.
- **Conséquences :** aucune table supplémentaire. Le seed sénégalais intègre ces catégories prêtes à l'emploi.

### ADR-045 : Insertion des transactions financières en deux étapes pour conformité avec le déclencheur d'intégrité

- **Statut :** acceptée en PHASE-05.
- **Date :** 15 octobre 2026.
- **Contexte :** le déclencheur PostgreSQL `trg_ledger_entries__guard` interdit formellement d'insérer, modifier ou supprimer une écriture de grand livre (`ledger_entries`) sur une transaction dont le statut n'est pas `PENDING` (SQLSTATE `23514`). Or, le client ou l'API souhaite pouvoir créer directement une transaction validée (`VALIDATED`).
- **Décision :** le dépôt insère systématiquement l'en-tête de transaction en `PENDING` (`validated_at = null`), insère ensuite les écritures de débit/crédit, puis effectue un `UPDATE` vers `VALIDATED` (`validated_at = occurred_at`) au sein de la même transaction SQL. Le même patron s'applique aux transferts avec frais.
- **Raison :** respect strict de l'invariant d'immuabilité du grand livre au niveau base de données sans sacrifier l'ergonomie de création directe.
- **Conséquences :** conformité totale avec le déclencheur de la base ; aucune régression possible lors de l'application des migrations réelles.

### ADR-046 : Interdiction absolue de suppression physique des transactions financières

- **Statut :** acceptée en PHASE-05.
- **Date :** 15 octobre 2026.
- **Contexte :** le déclencheur PostgreSQL `orbit_transactions_guard` bloque tout `DELETE` sur la table `transactions` afin de garantir l'auditabilité et la traçabilité comptable (`FINANCE_RULES.md` §11.1). Une route `DELETE /finance/transactions/:id` avait initialement été envisagée pour les transactions `PENDING`.
- **Décision :** interdiction définitive de la suppression physique sur `transactions`. La route `DELETE` est supprimée de l'API. Toute annulation (qu'elle concerne une transaction `PENDING` ou `VALIDATED`) transite par l'action métier explicite `POST /finance/transactions/:id/cancel` avec motif obligatoire audité.
- **Raison :** principe comptable de non-altération du grand livre et respect du déclencheur SQL.
- **Conséquences :** API simplifiée et robuste ; traçabilité exhaustive de toutes les intentions de saisie.

### ADR-047 : Détection et gestion de course d'insertion d'idempotence (P2002)

- **Statut :** acceptée en PHASE-05.
- **Date :** 15 octobre 2026.
- **Contexte :** deux requêtes concurrentes utilisant la même clé d'idempotence peuvent interroger la base avant que la première n'ait fini d'insérer sa clé `IN_PROGRESS`, déclenchant une violation de contrainte d'unicité Prisma `P2002` sur `(user_id, scope, key)`.
- **Décision :** `IdempotencyService.start` intercepte l'erreur `P2002` et la transforme en `DomainError('IDEMPOTENCY_IN_PROGRESS')`, renvoyant un statut HTTP `409` propre avec `Retry-After: 1`.
- **Raison :** évite toute remontée d'erreur 500 interne sur les requêtes concurrentes utilisant une clé identique.
- **Conséquences :** comportement déterministe et conforme aux standards d'idempotence d'API de paiement (type Stripe).

---

## Décisions ouvertes (à trancher au plus tard au démarrage de la phase indiquée)

| # | Sujet | Phase |
|---|---|---|
| OD-1 | Tontine : traitée par catégories standards (**Tranchée par ADR-044**) | PHASE-05 |
| OD-2 | Ajustements du principal d'une dette : quelle table, ou une transaction `ADJUSTMENT` liée ? (FINANCE_RULES OD-F5) | PHASE-06 |
| OD-3 | Import de données (§4.25) : quel module, quelle phase ? Proposition : PHASE-07, en import CSV de transactions avec prévisualisation. | PHASE-07 |
| OD-4 | Avoirs, radiation et utilisation du crédit client | PHASE-10 |
| OD-5 | Fournisseur de transcription vocale (l'API Claude ne transcrit pas l'audio) | PHASE-16 |
| OD-6 | Intérêts et pénalités sur les dettes ; conversion vers une devise de reporting | Après PHASE-06 |
| OD-7 | Base de données : PostgreSQL sur le VPS ou Neon managé. **Proposition : ADR-041 (PostgreSQL sur le VPS), à valider par le propriétaire.** | PHASE-03 |

---

## Hypothèses à confirmer par le propriétaire

| # | Hypothèse retenue | Impact si elle est fausse |
|---|---|---|
| H1 | Le module **Pro** (clients, contrats, factures) est disponible pour tous les utilisateurs, et désactivable. | Il passerait en zone Dev (ADMIN), sans changement de schéma. |
| H2 | Pas d'abonnement payant à ORBIT pour le moment. PHASE-17 prépare des quotas, mais aucune facturation SaaS. | Une phase de facturation (Wave, Stripe) serait à ajouter. |
| H3 | Le découvert est **refusé** par défaut sur tous les comptes, mais configurable par compte. | Il suffit de changer la valeur par défaut. |
