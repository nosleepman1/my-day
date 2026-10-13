# ORBIT : patrons de conception imposés

- **Statut :** référence. Subordonné à `DECISIONS.md` ; complète `ARCHITECTURE.md`.
- **Responsabilité :** comment écrire un module, un service, un repository, un port, un hook front. Chaque patron indique **quand** l'utiliser, un exemple, et les anti-patrons **interdits**.
- **Documents liés :** `ARCHITECTURE.md` (emplacements, graphe de dépendances), `CODING_STANDARDS.md` (style, nommage, lint), `DATA_MODEL.md` (tables), `FINANCE_RULES.md` (règles de calcul, statuts financiers), `API.md` (format des réponses et des erreurs), `FRONTEND.md`.

> Les exemples sont **normatifs dans leur forme** (signatures, emplacement, découpage). Les noms de colonnes, statuts et règles métier exacts viennent de `DATA_MODEL.md` et `FINANCE_RULES.md` ; en cas d'écart, ces documents l'emportent sur l'exemple.

---

## 1. Monolithe modulaire

**Quand :** toujours. Tout code métier appartient à exactement un module de `ARCHITECTURE.md` §4.

```ts
// apps/api/src/modules/tasks/tasks.module.ts
@Module({
  imports: [ProjectsModule, TagsModule],
  controllers: [TasksController],
  providers: [TasksService, TasksRepository, TasksPolicy, TasksSearchProvider],
  exports: [TasksFacade],
})
export class TasksModule {}

// apps/api/src/modules/tasks/index.ts — seule surface importable par les autres modules
export { TasksModule } from './tasks.module';
export { TasksFacade } from './tasks.facade';
export type { TaskSummary } from './domain/task-summary';
```

La **façade** (`<module>.facade.ts`) expose les quelques opérations dont les autres modules ont besoin (ex. `createFromIdea`, `existsForCurrentUser`). Elle délègue aux services ; elle ne contient pas de logique.

**Interdit :**
- importer `../../tasks/tasks.repository` depuis un autre module (règle `module-public-api-only`) ;
- exporter un repository ou le `PrismaService` dans `exports` ;
- un module « utils » ou « shared » qui accumule du métier de plusieurs domaines.

---

## 2. Ports et adaptateurs

**Quand :** toute dépendance hors du processus (fichiers, e-mail, file de jobs, IA, Google) **et** toute source de non-déterminisme (horloge, identifiants). Le service dépend du port (token d'injection), jamais de l'adaptateur.

```ts
// apps/api/src/platform/storage/storage.port.ts
export const STORAGE = Symbol('STORAGE');
export interface StoragePort {
  put(input: { key: StorageKey; body: Buffer | Readable; contentType: string; sizeBytes: number }): Promise<void>;
  signedGetUrl(key: StorageKey, opts: { expiresInSeconds: number }): Promise<string>; // ≤ 300 (ADR-013)
  delete(key: StorageKey): Promise<void>;
}
// Clé construite par le code, jamais à partir d'un nom de fichier fourni :
export const documentKey = (userId: string, documentId: string): StorageKey =>
  `users/${userId}/documents/${documentId}` as StorageKey;

// apps/api/src/platform/time/clock.port.ts
export const CLOCK = Symbol('CLOCK');
export interface ClockPort {
  now(): Date;                               // instant UTC
  today(timeZone: string): CivilDate;        // date civile dans le fuseau de l'utilisateur (ADR-023)
}

// platform/ids/id-generator.port.ts — UUIDv7 (ADR-011)
export interface IdGeneratorPort { next(): string }
// platform/mail/mail.port.ts — templates typés, jamais de HTML construit dans un service
export interface MailPort { send<T extends MailTemplate>(m: { to: string; template: T; data: MailTemplateData[T] }): Promise<void> }
// platform/jobs/job-queue.port.ts (PHASE-08)
export interface JobQueue { enqueue(envelope: JobEnvelope, opts?: { delayMs?: number }): Promise<void> }
```

Chaque port s'accompagne d'un token `Symbol` homonyme (`ID_GENERATOR`, `MAIL`, `JOB_QUEUE`).

La liaison port → adaptateur se fait dans le module de plateforme par `useFactory`, selon le driver de la configuration (`STORAGE_DRIVER`, `MAIL_DRIVER`, `JOBS_DRIVER`). Chaque port possède un **adaptateur de test** (`InMemoryStorage`, `CapturingMail`, `FixedClock`, `SequentialIdGenerator`, `InMemoryJobQueue`) dans le même dossier.

**Interdit :** `new Date()`, `Date.now()`, `crypto.randomUUID()` ou `uuidv7()` dans un service ou un domaine (lint) ; importer `@aws-sdk/*`, `nodemailer`, `bullmq`, `@anthropic-ai/sdk` ou `googleapis` hors de l'adaptateur correspondant.

---

## 3. Repository scopé tenant

**Quand :** tout accès Prisma à une table métier. Le repository est le seul fichier d'un module qui touche Prisma.

L'extension `tenantScope` (ADR-007-3, `platform/database/tenant-scope.extension.ts`) est appliquée au client `TENANT_PRISMA`, seul client autorisé dans les modules métier. Elle ajoute `userId` au `where` et au `data` ; un `userId` différent fourni par l'appelant est combiné en `AND` (aucune ligne trouvée) dans un filtre, et refusé pour une cible unique (`update`, `delete`, `upsert`) ; elle refuse `findUnique`, tout changement de `userId`, toute opération non prévue et tout modèle non cloisonné, et lève `MissingTenantContextError` sans contexte (nestjs-cls, alimenté par le guard global ou `TenantContext.runAsUser`).

```ts
// apps/api/src/platform/database/tenant-scope.extension.ts (extrait)
export const tenantScopeExtension = (tenant: TenantContext) =>
  Prisma.defineExtension({
    name: 'tenantScope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          assertScopedModel(model); // un modèle non cloisonné passe par PrismaService, jamais par ce client
          return query(scopeArgs(operation, args, requireUserId())); // findUnique et opérations inconnues refusées
        },
      },
    },
  });
```

`UNSCOPED_MODELS` = `users`, `sessions`, `email_verification_tokens`, `password_reset_tokens` (puis `currencies`, `feature_flags` quand ces tables arriveront). Ces modèles ne sont accessibles que par le client brut `PrismaService`, dont l'import est interdit par lint dans `modules/**` sauf `modules/auth`, `modules/users` et `modules/admin`.

```ts
// apps/api/src/modules/ideas/ideas.repository.ts
@Injectable()
export class IdeasRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<ScopedPrismaClient>>) {}

  private get db() { return this.txHost.tx; }

  findById(id: string): Promise<IdeaRecord | null> {
    return this.db.idea.findFirst({ where: { id, archivedAt: null }, select: IDEA_SELECT });
  }

  list(q: IdeaListQuery): Promise<IdeaRecord[]> {
    return this.db.idea.findMany({
      where: { status: q.status, archivedAt: null },
      orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,                       // détection de page suivante
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      select: IDEA_SELECT,
    });
  }

  create(data: NewIdea): Promise<IdeaRecord> {
    return this.db.idea.create({ data, select: IDEA_SELECT }); // userId injecté par l'extension
  }
}

const IDEA_SELECT = { id: true, title: true, status: true, capturedAt: true, source: true } satisfies Prisma.IdeaSelect;
```

Règles :
- **Faire :** un `select` explicite par repository (constante `*_SELECT`), jamais d'entité complète.
- **Faire :** `null` signifie « introuvable **ou** appartenant à un autre utilisateur » ; le service lève `NotFoundError` ⇒ 404 (ADR-007-7).
- **Faire :** les relations imbriquées (`include`, `connect`) ne sont sûres que parce que les clés étrangères sont composites `(user_id, id)` (ADR-007-4). Toute nouvelle relation exige cette clé composite dans la migration.
- **Interdit :** passer `userId` en paramètre de méthode de repository (il vient du contexte) ; `findUnique` ; `$queryRaw` hors `platform/database/raw/` ; retourner un type Prisma généré au-delà du service.

---

## 4. Unit of Work

**Quand :** dès qu'une opération écrit dans plus d'une table ou plus d'une ligne qui doivent rester cohérentes (transaction + écritures, facture + lignes, outbox).

ORBIT utilise `@nestjs-cls/transactional` avec l'adaptateur Prisma : le décorateur ouvre un `prisma.$transaction` interactif et tous les repositories qui lisent `txHost.tx` y participent automatiquement.

```ts
// apps/api/src/modules/finance/transfers/transfers.service.ts
@Injectable()
export class TransfersService {
  constructor(
    private readonly accounts: AccountsRepository,
    private readonly transactions: TransactionsRepository,
    private readonly policy: TransfersPolicy,
    @Inject(OUTBOX) private readonly outbox: OutboxPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  @Transactional()
  async create(input: CreateTransferInput): Promise<TransferView> {
    const [from, to] = await Promise.all([
      this.accounts.findById(input.fromAccountId),
      this.accounts.findById(input.toAccountId),
    ]);
    if (!from || !to) throw new NotFoundError('FINANCE_ACCOUNT_NOT_FOUND');
    this.policy.assertCanTransfer(from, to);

    const draft = buildTransfer({ id: this.ids.next(), from, to, input });   // domaine pur (§10)
    if (!draft.ok) throw draft.error;

    const saved = await this.transactions.insertWithEntries(draft.value);
    await this.outbox.record({ type: 'finance.transfer.created', entityId: saved.id }); // dès PHASE-08
    return toTransferView(saved);
  }
}
```

**Interdit :** appeler un service externe (HTTP, mail, S3) **à l'intérieur** d'une transaction ; enchaîner deux `@Transactional()` en espérant deux transactions distinctes (elles fusionnent) ; utiliser `prisma.$transaction([...])` en tableau dans un module ; transactions de plus de 5 s.

---

## 5. Service applicatif et domaine pur

**Quand :** systématiquement. Le **service** orchestre (charger, vérifier, appeler le domaine, persister, publier). Le **domaine** décide (calculs, validations métier, transitions) sans I/O.

```ts
// apps/api/src/modules/tasks/domain/task-dependencies.ts — pur, testable sans Nest
export function wouldCreateCycle(
  edges: ReadonlyArray<{ taskId: string; dependsOnId: string }>,
  candidate: { taskId: string; dependsOnId: string },
): boolean {
  const graph = new Map<string, string[]>();
  for (const e of [...edges, candidate]) graph.set(e.taskId, [...(graph.get(e.taskId) ?? []), e.dependsOnId]);
  const stack = [candidate.dependsOnId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === candidate.taskId) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...(graph.get(node) ?? []));
  }
  return false;
}

// apps/api/src/modules/tasks/tasks.service.ts — orchestration
async addDependency(taskId: string, dependsOnId: string): Promise<void> {
  const edges = await this.repo.dependencyEdges();
  if (wouldCreateCycle(edges, { taskId, dependsOnId })) throw new ConflictError('TASK_DEPENDENCY_CYCLE');
  await this.repo.insertDependency(taskId, dependsOnId);
}
```

Règles du domaine : fonctions pures ou objets immuables ; entrées et sorties en types du domaine (pas de `Prisma.*`, pas de DTO de requête) ; dépendances autorisées : `@orbit/money`, `@orbit/contracts` (enums, codes d'erreur), `platform/errors`.

**Interdit :** logique métier dans un contrôleur ; `if (status === ...)` de transition dispersé dans les services (voir §11) ; domaine anémique où le service fait tous les calculs inline ; méthode de service de plus de 50 lignes.

---

## 6. Policy (rôle et propriété)

**Quand :** toute règle d'autorisation qui dépasse « connecté » : rôle ADMIN, ré-authentification récente, règle dépendant de l'état de la ressource.

Trois niveaux, chacun à sa place :

| Niveau | Mécanisme | Exemple |
|---|---|---|
| Rôle | `@Roles('ADMIN')` sur la **classe** du contrôleur, `RolesGuard` | Zone Dev, `/admin/users` |
| Propriété | Repository scopé (§3) ⇒ 404 | Lire la tâche d'un autre utilisateur |
| Règle fine | Classe `<Resource>Policy` appelée par le service | Modifier une facture émise, révéler un secret |

```ts
// apps/api/src/modules/vault/policies/vault-items.policy.ts
@Injectable()
export class VaultItemsPolicy {
  constructor(@Inject(CLOCK) private readonly clock: ClockPort, private readonly tenant: TenantContext) {}

  assertCanReveal(session: SessionInfo): void {
    if (this.tenant.role() !== 'ADMIN') throw new NotFoundError('VAULT_ITEM_NOT_FOUND'); // jamais 403 révélateur
    if (!session.reauthAt || this.clock.now().getTime() - session.reauthAt.getTime() > REAUTH_WINDOW_MS) {
      throw new ForbiddenError('AUTH_REAUTH_REQUIRED');
    }
    if (!session.mfaVerifiedAt) throw new ForbiddenError('AUTH_MFA_REQUIRED');
  }
}
```

**Interdit :** vérifier un rôle dans le front seulement ; `if (user.role === 'ADMIN')` dans un service au lieu d'une policy ; une policy qui lit la donnée d'un autre utilisateur pour « décider » (ADR-002) ; répondre 403 pour une ressource d'autrui.

---

## 7. Contrats Zod partagés et DTO

**Quand :** toute entrée et toute sortie HTTP. Le schéma vit dans `packages/contracts`, le back en dérive un DTO `nestjs-zod`, le front l'utilise dans React Hook Form.

```ts
// packages/contracts/src/common/amount.ts
export const AmountMinorSchema = z.string().regex(/^\d{1,18}$/, 'AMOUNT_INVALID');   // ADR-008 : chaîne
export const CurrencyCodeSchema = z.enum(['XOF', 'EUR', 'USD']);

// packages/contracts/src/finance/transfers.schema.ts
export const CreateTransferInputSchema = z.object({
  fromAccountId: IdSchema,
  toAccountId: IdSchema,
  amountMinor: AmountMinorSchema,
  occurredOn: CivilDateSchema,
  description: z.string().trim().max(500).optional(),
}).strict().refine((v) => v.fromAccountId !== v.toAccountId, { path: ['toAccountId'], message: 'FINANCE_TRANSFER_SAME_ACCOUNT' });
export type CreateTransferInput = z.infer<typeof CreateTransferInputSchema>;

export const TransferViewSchema = z.object({
  id: IdSchema, amountMinor: AmountMinorSchema, currency: CurrencyCodeSchema,
  fromAccountId: IdSchema, toAccountId: IdSchema, occurredOn: CivilDateSchema, status: TransactionStatusSchema,
});
export type TransferView = z.infer<typeof TransferViewSchema>;

// apps/api/src/modules/finance/transfers/dto/transfers.dto.ts
export class CreateTransferDto extends createZodDto(CreateTransferInputSchema) {}

// contrôleur
@Post()
@Idempotent()
@ResponseSchema(TransferViewSchema)
create(@Body() dto: CreateTransferDto): Promise<TransferView> { return this.service.create(dto); }
```

Règles :
- **Faire :** `.strict()` sur les schémas d'entrée (clé inconnue ⇒ 400) ; schémas de réponse **non stricts** mais parsés (les clés inconnues sont retirées).
- **Faire :** un schéma `XxxListQuerySchema` avec tri et filtres en **liste blanche** (`z.enum`) et `limit` borné.
- **Interdit :** `class-validator`, `class-transformer` ; types TS écrits à la main en doublon d'un schéma ; renvoyer un `Record` Prisma ; montants en `z.number()` ; `userId` dans un schéma d'entrée.

---

## 8. Erreurs de domaine, `Result` et mapping HTTP

**Quand :** le domaine renvoie `Result` pour les échecs **attendus** (règle métier violée) ; le service lève l'erreur ; le filtre global la traduit. Les erreurs **inattendues** (bug, base indisponible) ne sont jamais converties en `Result`.

```ts
// apps/api/src/platform/errors/result.ts
export type Result<T, E extends DomainError = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E extends DomainError>(error: E): Result<never, E> => ({ ok: false, error });

// apps/api/src/platform/errors/domain-error.ts
export abstract class DomainError extends Error {
  abstract readonly kind: 'NOT_FOUND' | 'CONFLICT' | 'RULE_VIOLATION' | 'FORBIDDEN' | 'UNAUTHENTICATED';
  constructor(readonly code: ErrorCode, readonly details?: Readonly<Record<string, unknown>>) { super(code); }
}
export class NotFoundError extends DomainError { readonly kind = 'NOT_FOUND' as const }
export class RuleViolationError extends DomainError { readonly kind = 'RULE_VIOLATION' as const }

// apps/api/src/platform/errors/http-status.ts
export const HTTP_STATUS_BY_KIND = {
  NOT_FOUND: 404, CONFLICT: 409, RULE_VIOLATION: 422, FORBIDDEN: 403, UNAUTHENTICATED: 401,
} as const satisfies Record<DomainError['kind'], number>;
```

`GlobalExceptionFilter` produit le corps d'erreur défini dans `API.md`, avec `code`, `requestId` et `details` filtrés. Les `ZodError` deviennent `VALIDATION_FAILED` (400) ; les erreurs Prisma connues passent par `prisma-error.mapper.ts` (P2002 ⇒ 409 `UNIQUE_CONSTRAINT`, P2003 ⇒ 404 ou 409) ; tout le reste ⇒ 500 `INTERNAL_ERROR`, journalisé avec la pile, **sans** message interne dans la réponse.

**Interdit :** `throw new HttpException(...)` ou `BadRequestException` dans un service ou un domaine ; un message d'erreur en français dans le code (le front traduit le `code`) ; inclure SQL, pile ou nom de table dans la réponse ; `catch {}` vide.

---

## 9. Value object `Money` (`packages/money`)

**Quand :** toute valeur monétaire, dès qu'elle quitte la base ou la chaîne JSON.

```ts
// packages/money/src/money.ts
export interface Money { readonly minor: bigint; readonly currency: CurrencyCode }

export const money = (minor: bigint, currency: CurrencyCode): Money => Object.freeze({ minor, currency });

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

// packages/money/src/rounding.ts — division entière, arrondi half-up (règle unique : FINANCE_RULES.md)
export function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('denominator must be > 0');
  const q = numerator / denominator;                // troncature vers zéro
  const r = numerator % denominator;
  const twiceAbsR = (r < 0n ? -r : r) * 2n;
  if (twiceAbsR < denominator) return q;
  return numerator < 0n ? q - 1n : q + 1n;
}

// packages/money/src/quantity.ts — quantité NUMERIC(12,3) portée en millièmes
export function lineTotal(unitPrice: Money, quantityThousandths: bigint): Money {
  return money(divideHalfUp(unitPrice.minor * quantityThousandths, 1000n), unitPrice.currency);
}

// packages/money/src/parse.ts — frontière JSON
export const fromAmountString = (s: string, c: CurrencyCode): Money => money(BigInt(assertDigits(s)), c);
export const toAmountString = (m: Money): string => m.minor.toString();
```

Affichage (front et e-mails) : `format(m, 'fr-SN')` utilise `Intl.NumberFormat` avec l'exposant de la devise ; XOF n'affiche jamais de décimale.

**Interdit :** `number` pour un montant, `Number()`, `parseFloat`, `toFixed`, `Math.round` sur un montant ; additionner deux devises ; convertir sans taux explicite et horodaté (`FINANCE_RULES.md`) ; stocker un montant formaté.

---

## 10. Ledger : `transactions` + `ledger_entries`

**Quand :** toute écriture qui modifie un solde (ADR-009). L'en-tête `transactions` décrit l'événement ; `ledger_entries` porte les mouvements par compte.

```ts
// apps/api/src/modules/finance/domain/ledger.ts
export interface LedgerEntryDraft { readonly accountId: string; readonly direction: 'DEBIT' | 'CREDIT'; readonly amount: Money }

export function entriesFor(cmd: LedgerCommand): Result<readonly LedgerEntryDraft[]> {
  if (cmd.amount.minor <= 0n) return err(new RuleViolationError('FINANCE_AMOUNT_NOT_POSITIVE'));
  switch (cmd.type) {
    case 'EXPENSE':  return ok([{ accountId: cmd.accountId, direction: 'DEBIT',  amount: cmd.amount }]);
    case 'INCOME':   return ok([{ accountId: cmd.accountId, direction: 'CREDIT', amount: cmd.amount }]);
    case 'TRANSFER':
      if (cmd.fromAccountId === cmd.toAccountId) return err(new RuleViolationError('FINANCE_TRANSFER_SAME_ACCOUNT'));
      return ok([
        { accountId: cmd.fromAccountId, direction: 'DEBIT',  amount: cmd.amount },
        { accountId: cmd.toAccountId,   direction: 'CREDIT', amount: cmd.amount },
      ]);
    default: return assertNever(cmd);
  }
}
```

Lecture du solde (query service, §12) : `opening_balance + Σ CREDIT − Σ DEBIT` des écritures dont la transaction est `VALIDATED`, calculée en base :

```ts
const rows = await this.db.ledgerEntry.groupBy({
  by: ['accountId', 'direction'],
  where: { accountId: { in: accountIds }, transaction: { status: 'VALIDATED' } },
  _sum: { amountMinor: true },
});
```

Règles :
- **Faire :** les frais sont une transaction `EXPENSE` séparée, liée par `parent_transaction_id` ; le contrôle de découvert (hypothèse H3) se fait dans la même transaction SQL que l'insertion, après verrouillage du compte (`SELECT … FOR UPDATE` via `platform/database/raw/`).
- **Faire :** chaque règle de `FINANCE_RULES.md` possède un test fast-check d'invariant (somme des soldes conservée par un transfert, etc.).
- **Interdit :** colonne `balance` mise à jour par incrément ; `DELETE` d'une transaction validée (annulation par statut, auditée) ; écriture sans en-tête ; modification d'une écriture existante.

---

## 11. Machine à états pour les statuts

**Quand :** toute colonne `status` dont les changements obéissent à des règles (idées, tâches, transactions, factures, dettes, demandes de suppression, runs d'automatisation).

```ts
// apps/api/src/platform/errors/state-machine.ts
export function defineStateMachine<S extends string>(transitions: { readonly [K in S]: readonly S[] }) {
  return {
    canTransition: (from: S, to: S): boolean => transitions[from].includes(to),
    transition(from: S, to: S, code: ErrorCode): Result<S> {
      return transitions[from].includes(to) ? ok(to) : err(new RuleViolationError(code, { from, to }));
    },
    isTerminal: (s: S): boolean => transitions[s].length === 0,
  };
}

// apps/api/src/modules/pro/invoices/domain/invoice-status.ts — illustratif, table normative : FINANCE_RULES.md
export const invoiceStatus = defineStateMachine<InvoiceStatus>({
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID'],
  PAID: [],
  CANCELLED: [],
});
// « En retard » n'est PAS un statut : il est dérivé (ADR-020).
```

Le service applique `transition()` puis persiste avec une condition sur l'ancien statut (`updateMany({ where: { id, status: from } })` + vérification `count === 1`) pour éviter les courses.

**Interdit :** `PATCH` générique qui accepte `status` librement ; statut stocké pour une information dérivable (retard, solde) ; transition sans audit pour les statuts financiers.

---

## 12. CQRS léger : query services

**Quand :** lectures agrégées ou transverses (dashboard, rapports, soldes, prévisions, listes avec compteurs). Les écritures restent dans les services applicatifs.

```ts
// apps/api/src/modules/finance/reports/monthly-summary.query-service.ts
@Injectable()
export class MonthlySummaryQueryService {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<ScopedPrismaClient>>) {}

  async forMonth(month: CivilMonth, currency: CurrencyCode): Promise<MonthlySummaryView> {
    const rows = await monthlyTotalsByCategory(this.txHost.tx, { month, currency }); // platform/database/raw
    return MonthlySummaryViewSchema.parse(toMonthlySummaryView(rows));
  }
}
```

Règles :
- **Faire :** lecture seule, aucun effet de bord ; résultat validé par un schéma de réponse ; agrégats calculés par SQL (pas de chargement de toutes les lignes en mémoire) ; agrégats **reconstructibles** (§9.1 du cahier) : pas de table de cache sans procédure de reconstruction.
- **Interdit :** un query service qui écrit ; un repository d'écriture surchargé de 15 méthodes de reporting ; requête N+1 dans une boucle.

---

## 13. Agrégateurs par registre de providers

**Quand :** `dashboard`, `search`, `exports` (et tout futur agrégateur). Voir `ARCHITECTURE.md` §5.3.

```ts
// apps/api/src/modules/dashboard/index.ts
export interface DashboardWidgetProvider {
  readonly widgetId: DashboardWidgetId;                 // enum dans @orbit/contracts
  readonly requiredModule?: UserModuleKey;              // masqué si le module est désactivé (ADR-024)
  load(ctx: { today: CivilDate; timeZone: string }): Promise<DashboardWidgetData>;
}

export const DashboardWidget = DiscoveryService.createDecorator<void>(); // marqueur de découverte

// apps/api/src/modules/finance/dashboard/balances.widget.ts
@DashboardWidget()
@Injectable()
export class BalancesWidgetProvider implements DashboardWidgetProvider {
  readonly widgetId = 'finance.balances' as const;
  constructor(private readonly balances: BalancesQueryService) {}
  load() { return this.balances.summaryByAccount(); }
}
// finance.module.ts : providers: [..., BalancesWidgetProvider]

// apps/api/src/modules/dashboard/dashboard-widgets.registry.ts
@Injectable()
export class DashboardWidgetsRegistry {
  constructor(private readonly discovery: DiscoveryService) {}
  all(): DashboardWidgetProvider[] {
    return this.discovery.getProviders({ metadataKey: DashboardWidget.KEY })
      .map((w) => w.instance as DashboardWidgetProvider);
  }
}
```

NestJS n'a pas de multi-provider natif : la découverte par décorateur (`DiscoveryService.createDecorator`) est le **seul** mécanisme autorisé. `search` (`@SearchProvider()`) et `exports` (`@ExportProvider()`) suivent le même gabarit.

Le `DashboardService` exécute les providers en parallèle avec un délai maximal par widget ; un widget en échec renvoie un état d'erreur sans faire échouer le dashboard.

**Interdit :** `dashboard` qui importe `finance` ; une requête SQL transverse unique qui lit dix tables de modules différents hors `platform/database/raw/search/`.

---

## 14. Idempotence (`Idempotency-Key`)

**Quand :** obligatoire sur toute création financière (transactions, transferts, remboursements de dette, paiements de facture), exports, confirmations de proposition IA, et tout webhook entrant (clé = identifiant d'événement du fournisseur, table `webhook_events`).

```ts
@Post() @Idempotent() create(@Body() dto: CreateTransactionDto) { … }
```

Algorithme de `IdempotencyInterceptor` (table `idempotency_keys`, unique `(user_id, key)`) :
1. En-tête absent sur une route `@Idempotent()` ⇒ 400 `IDEMPOTENCY_KEY_REQUIRED`. Format : UUID.
2. `requestHash = SHA-256(méthode + route + corps canonique)`.
3. `INSERT … ON CONFLICT DO NOTHING` avec `status = IN_PROGRESS`, `expires_at = now + 24 h`.
4. Ligne existante : hash différent ⇒ 422 `IDEMPOTENCY_KEY_REUSED` ; `IN_PROGRESS` ⇒ 409 `IDEMPOTENCY_IN_PROGRESS` ; `COMPLETED` ⇒ rejouer le statut et le corps mémorisés.
5. Succès ⇒ `COMPLETED` + réponse mémorisée ; erreur 4xx métier ⇒ mémorisée ; erreur 5xx ⇒ ligne supprimée (le client peut réessayer).

Côté front : la clé est générée **une fois par intention de soumission** (au montage du formulaire), réutilisée lors d'un nouvel essai, renouvelée après succès.

**Interdit :** dédupliquer « par ressemblance » (montant + date) ; clé générée côté serveur ; idempotence implémentée dans chaque service.

---

## 15. Outbox transactionnelle (PHASE-08)

**Quand :** un effet de bord asynchrone **doit** suivre une écriture critique (finance, intégrations, suppression de compte, déclencheurs d'automatisation). Pour un effet non critique, `JobQueue.enqueue` après commit suffit (`ARCHITECTURE.md` §7.2).

```ts
// apps/api/src/platform/jobs/outbox.port.ts (token OUTBOX)
export interface OutboxPort { record(event: OutboxEventInput): Promise<void> } // { type, entityId, payload? }

// apps/api/src/platform/jobs/prisma-outbox.ts — injecte txHost, TenantContext, ID_GENERATOR
@Injectable()
export class PrismaOutbox implements OutboxPort {
  async record(event: OutboxEventInput): Promise<void> {
    if (!this.txHost.isTransactionActive()) throw new Error('Outbox.record must run inside @Transactional()');
    await this.txHost.tx.outboxEvent.create({
      data: { id: this.ids.next(), type: event.type, entityId: event.entityId,
              payload: event.payload ?? {}, correlationId: this.tenant.requestId() },
    });
  }
}
```

Le relais (worker) transforme chaque ligne en `JobEnvelope` avec `idempotencyKey = outbox_event.id`.

**Interdit :** publier un job **puis** écrire en base (ou l'inverse hors transaction) ; payload contenant secrets ou contenus privés ; outbox pour des notifications triviales.

---

## 16. Audit

**Quand :** chaque action listée au §4.24 du cahier. Deux formes :

| Forme | Usage |
|---|---|
| `@Audited({ action, entity })` sur la méthode du contrôleur | Créations, modifications et archivages ordinaires. L'intercepteur écrit après succès, avec `entityId` tiré de la réponse. |
| `AuditPort.record()` dans le service, **dans** la `@Transactional()` | Événements critiques : finance, révélation du coffre, export, changement de rôle, suppression de compte. L'audit et la donnée sont validés ensemble. |

```ts
@Patch(':id')
@Audited({ action: 'tasks.task.due_date_changed', entity: 'task' })
update(@Param('id', IdPipe) id: string, @Body() dto: UpdateTaskDto) { return this.service.update(id, dto); }

// dans un service critique
await this.audit.record({ action: 'vault.item.revealed', entity: 'vault_item', entityId: item.id });
```

Contenu d'une ligne : `user_id`, `action` (`<module>.<entité>.<verbe au passé>`), `entity`, `entity_id`, `request_id`, `ip_hash`, `metadata` **sans** valeur sensible (liste des champs modifiés, pas leurs valeurs pour les données privées). Les tentatives d'accès croisé (404 sur ressource existante d'un autre utilisateur) sont auditées par le filtre global (ADR-007-7).

**Interdit :** journaliser l'ancienne et la nouvelle valeur d'un secret, d'une note ou d'un montant privé dans `metadata` ; écrire directement dans `audit_logs` depuis un module.

---

## 17. Activation des modules (feature flags)

**Quand :** un module utilisateur désactivable (ADR-024 : ex. `pro`) ou un drapeau global (`feature_flags`, PHASE-17).

```ts
// apps/api/src/platform/auth/module-access.port.ts
export const MODULE_ACCESS = Symbol('MODULE_ACCESS');
export interface ModuleAccessPort { isEnabled(userId: string, module: UserModuleKey): Promise<boolean> }

// contrôleur
@Controller('pro/invoices')
@RequiresModule('pro')
export class InvoicesController { … }
```

Module désactivé ⇒ 404 `MODULE_DISABLED` (le module n'existe pas pour cet utilisateur). Les données restent intactes ; réactiver le module les rend de nouveau visibles. Le front lit `enabledModules` dans `/me` pour masquer la navigation.

**Interdit :** utiliser `enabled_modules` pour la zone Dev (c'est le rôle, ADR-024) ; `if (flags.x)` dispersés dans les services au lieu du guard ; drapeau sans date de retrait prévue pour un drapeau temporaire.

---

## 18. Liens entre entités (LinkTargets)

**Quand :** une entité peut pointer vers l'une de plusieurs cibles (rappels, liens de notes, liens de documents, objectifs). ADR-018 interdit `entity_type`/`entity_id`.

En base : une colonne FK nullable par cible + contrainte `CHECK`. Prisma ne génère pas les `CHECK` : la migration est créée avec `prisma migrate dev --create-only` puis complétée à la main.

```sql
ALTER TABLE reminders ADD CONSTRAINT reminders_single_target_chk
  CHECK (num_nonnulls(task_id, calendar_event_id, debt_id, invoice_id) = 1);
-- + FK composites : FOREIGN KEY (user_id, task_id) REFERENCES tasks(user_id, id)
```

En API : une union discriminée, traduite vers les colonnes par une fonction unique.

```ts
// packages/contracts/src/reminders/reminder-target.schema.ts
export const ReminderTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('task'), id: IdSchema }),
  z.object({ type: z.literal('calendarEvent'), id: IdSchema }),
  z.object({ type: z.literal('debt'), id: IdSchema }),
  z.object({ type: z.literal('invoice'), id: IdSchema }),
]);

// apps/api/src/modules/reminders/domain/reminder-target.ts
const COLUMN_BY_TARGET = {
  task: 'taskId', calendarEvent: 'calendarEventId', debt: 'debtId', invoice: 'invoiceId',
} as const satisfies Record<ReminderTarget['type'], keyof ReminderTargetColumns>;

export function toTargetColumns(t: ReminderTarget): ReminderTargetColumns {
  return { taskId: null, calendarEventId: null, debtId: null, invoiceId: null, [COLUMN_BY_TARGET[t.type]]: t.id };
}
```

Une cible inexistante ou appartenant à autrui provoque une violation de FK composite ⇒ mappée en 404 `LINK_TARGET_NOT_FOUND`.

**Interdit :** colonnes `entity_type`/`entity_id` ; JSON contenant des identifiants de liens ; ajouter une cible sans mettre à jour la contrainte `CHECK`, l'union Zod et `COLUMN_BY_TARGET` dans le même commit.

---

## 19. Patrons front-end

Détails dans `FRONTEND.md` ; patrons imposés ici.

**Feature folders :** tout le code d'une fonctionnalité vit dans `apps/web/src/features/<feature>/` (`api/`, `components/`, `pages/`, `hooks/`). Une feature n'importe une autre feature que via son `index.ts`.

**Query keys factory et hooks par ressource :**

```ts
// apps/web/src/features/ideas/api/ideas.keys.ts
export const ideaKeys = {
  all: ['ideas'] as const,
  lists: () => [...ideaKeys.all, 'list'] as const,
  list: (query: IdeaListQuery) => [...ideaKeys.lists(), query] as const,
  details: () => [...ideaKeys.all, 'detail'] as const,
  detail: (id: string) => [...ideaKeys.details(), id] as const,
};

// apps/web/src/features/ideas/api/ideas.queries.ts
export function useIdeas(query: IdeaListQuery) {
  return useQuery({
    queryKey: ideaKeys.list(query),
    queryFn: ({ signal }) => apiClient.get('/ideas', { query, signal, schema: IdeaListResponseSchema }),
  });
}

export function useCreateIdea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIdeaInput) => apiClient.post('/ideas', input, { schema: IdeaViewSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ideaKeys.lists() }),
  });
}
```

Règles :
- **Faire :** `apiClient` valide chaque réponse avec le schéma de `@orbit/contracts` ; une réponse invalide est une erreur visible, pas un `any`.
- **Faire :** chaque page gère les quatre états (chargement, vide, erreur, succès) — §9.3 et §10.3 du cahier.
- **Faire :** mutations financières **sans** mise à jour optimiste et **sans** file hors ligne (ADR-016) ; `Idempotency-Key` stable par soumission (§14).
- **Interdit :** `useEffect` + `fetch` pour charger des données serveur ; clés de requête écrites en littéral dans les composants ; données serveur copiées dans un store global ; calcul de totaux financiers faisant autorité dans le front (le serveur recalcule).

---

## 20. Récapitulatif des anti-patrons bloquants en revue

| Anti-patron | Remplacement |
|---|---|
| `userId` reçu du client (URL, corps, en-tête) | Contexte CLS (§3) |
| `findUnique({ where: { id } })` | `findFirst({ where: { id } })` via repository scopé |
| `$queryRaw` dans un module | Fonction typée dans `platform/database/raw/` |
| Entité Prisma renvoyée au contrôleur | `select` + schéma de réponse (§7) |
| `number` / `Number()` / `parseFloat` sur un montant | `Money` + chaîne de chiffres (§9) |
| Solde stocké et incrémenté | Somme des `ledger_entries` (§10) |
| `status` modifié librement | Machine à états (§11) |
| Appel HTTP/mail/S3 dans une transaction | Outbox ou après commit (§4, §15) |
| `new Date()`, `randomUUID()` dans le métier | `ClockPort`, `IdGeneratorPort` (§2) |
| Import profond dans un autre module | `index.ts` + façade (§1) |
| Polymorphisme `entity_type`/`entity_id` | LinkTargets (§18) |
| `HttpException` dans un service | `DomainError` + filtre global (§8) |
| 403 sur la ressource d'autrui | 404 (§3, §6) |
