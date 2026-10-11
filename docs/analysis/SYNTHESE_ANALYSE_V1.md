# ORBIT : synthèse de l'analyse du cahier des charges

> **Document historique, remplacé.** Le cadrage V1/MVP et l'espace multi-utilisateur de cette analyse ont été abandonnés : l'application est développée intégralement, en 18 phases, avec un espace personnel par utilisateur. Les références sont désormais `DECISIONS.md` et `00-INDEX.md`.

- **Date :** 11 octobre 2026
- **Source analysée :** `docs/PRODUCT_SPEC.md` (cahier des charges v1.0, 2 463 lignes)
- **État du dépôt :** vide, aucune ligne de code. Cette analyse correspond à la **phase 0** du cahier (§14, §19).
- **Équipe d'analyse :** 6 agents en parallèle.

| Agent | Angle |
|---|---|
| `ecc:architect` | Architecture technique, décisions du §17, ADR |
| `ecc:database-reviewer` | Modèle de données, intégrité, multi-tenant |
| `ecc:security-reviewer` | Menaces, auth, coffre-fort, conformité |
| `ecc:tdd-guide` | Règles financières, cas de tests |
| `ecc:planner` | Périmètre, jalons, backlog, risques |
| `general-purpose` | Cohérence du document, produit et UX |

---

## 1. Verdict global

Le cahier est **solide sur les principes** : sécurité par défaut, pas de float, audit, isolation des workspaces, IA bornée. Il reste trois faiblesses de fond :

1. **Il est calibré pour un SaaS et une équipe**, alors que le besoin réel est celui d'un développeur solo. La V1 du §18 représente environ 6 à 9 semaines effectives. Un MVP réellement utilisable est atteignable en 22 à 34 jours effectifs.
2. **Le modèle de données (§5) ne porte pas les règles qu'il prétend servir (§4, §6).** Un transfert stocké sur une seule ligne avec un seul montant ne peut pas représenter le multi-devises ni les frais. Le statut et l'annulation des transactions sont absents. Rien n'empêche, au niveau de la base, un lien entre deux workspaces.
3. **Plusieurs décisions critiques restent ouvertes** : convention des montants, mécanisme d'auth, cryptographie du coffre, priorité entre retard et paiement partiel. Le cahier interdit lui-même de coder la finance et le coffre avant de les avoir tranchées.

---

## 2. Contradictions internes à corriger dans le cahier

| # | Contradiction | Sections |
|---|---|---|
| 1 | **Factures.** Classées P1 au §3.2, mais présentes en phase 3, dans les tickets D09 et D10, dans le test financier n°8 et dans les tests E2E. Absentes du §18. | §3.2, §14, §15, §6.6, §12.3, §18 |
| 2 | **Sauvegardes.** Classées P0 et exigées par le §18, mais livrées en phase 5, après la finance (phase 3). Des données financières réelles tourneraient donc sans sauvegarde. | §3.2, §14 |
| 3 | **Rappels.** Classés P1, mais exigés pour les renouvellements (P0), testés en E2E et dans l'annexe A.4. BullMQ n'arrive qu'en phase 6. | §3.2, §4.7, §12.3, §14 |
| 4 | **Transfert.** Le §4.9 décrit « un débit et un crédit liés », alors que le §5.6 le modélise sur une seule ligne. Les frais sont cités au §6.1 sans aucun champ. | §4.9, §5.6, §6.1 |
| 5 | **Coffre-fort.** P0 au §3.2, mais le §4.8 admet que la V1 se limite à des références. La MFA est exigée au §4.1 mais n'arrive qu'en phase 5. | §3.2, §4.1, §4.8, §14 |
| 6 | **Auth ambiguë.** Le §5.2 prévoit « sessions ou refresh_tokens », l'annexe prévoit `/auth/refresh` et le §8.2 parle de cookies « si auth par cookie ». | §5.2, §8.2, §16 |
| 7 | **Rôles.** Six rôles sont définis, mais il n'existe ni matrice de permissions, ni enum. L'« agent d'automatisation » n'a pas de table. | §2.1, §5.2 |
| 8 | **Recouvrement d'entités.** `clients`, `contacts` et `counterparties` se recouvrent. Les coûts existent en trois formats : `annual_cost`, `monthly_cost` et `billing_period`. | §5.3, §5.4, §5.6 |
| 9 | **Routes sans workspace.** Le §16 expose `/clients` sans workspace, alors que le §2.3 interdit de faire confiance au client pour le `workspace_id`. | §2.3, §16 |
| 10 | **Mission circulaire.** Le §19 demande de produire `PRODUCT_SPEC.md` « à partir du présent cahier », alors que ce cahier est ce fichier. | §19 |

---

## 3. Décisions structurantes : recommandations de l'équipe

### 3.1 Consensus (4 à 6 agents d'accord)

| Décision (§17) | Recommandation |
|---|---|
| **Monorepo (n°2)** | Workspaces pnpm `apps/api`, `apps/web`, `packages/contracts` (schémas Zod partagés). Ni Nx ni Turborepo au départ. |
| **Auth (n°3)** | Session côté serveur, cookie opaque `__Host-` HttpOnly, Secure, SameSite=Lax, hash de session en base. **Pas de JWT** et suppression de `/auth/refresh`. Mots de passe en argon2id. CSRF : SameSite, en-tête personnalisé et contrôle de l'`Origin`. Jetons d'API hachés et limités par portée pour n8n. |
| **Coffre-fort (n°6)** | **V1 = références** vers un gestionnaire existant (Bitwarden ou Vaultwarden). Aucun texte chiffré stocké. Le chiffrement par enveloppe (XChaCha20-Poly1305, une DEK par item, AAD, KEK hors VPS) arrive en V1.1, après la MFA et une sauvegarde testée. |
| **Redis/BullMQ** | **Pas en V1.** Utiliser `@nestjs/schedule` avec des requêtes SQL. Un ADR comparera pg-boss (file dans PostgreSQL, qui fait office d'outbox) à BullMQ, derrière une interface `JobQueue`. |
| **Isolation multi-tenant** | Workspace placé dans l'URL et contexte de requête via nestjs-cls. Une extension Prisma injecte `workspaceId` et lève une erreur si le contexte manque. **Clés étrangères composites `(workspace_id, id)` dès la V1.** SQL brut interdit par lint. Test inter-workspaces généré pour chaque route. |
| **Transferts et soldes** | En-tête `transactions` + `ledger_entries` : deux lignes pour un transfert, frais dans une écriture séparée. Pas de comptabilité en partie double complète. Solde = solde initial + Σ des écritures validées. Le solde initial n'est jamais modifié. |
| **Liens polymorphes** | Tables de liaison explicites pour l'environnement (domaines, serveurs, abonnements). Pour les tâches, notes et rappels : clés étrangères nullables avec `CHECK num_nonnulls(...) = 1`. |
| **Suppression** | `RESTRICT` sur tout le financier. Aucune suppression physique d'une transaction validée : annulation par statut. |
| **Hébergement (n°15)** | VPS en UE (Hetzner, OVH ou Scaleway), Docker Compose, Caddy. Sauvegardes chiffrées **chez un autre fournisseur** dès le jalon M1. RPO 24 h, RTO 4 h. |
| **Hors ligne (n°13)** | V1 en ligne uniquement, sous forme de PWA installable. V1.1 : file de capture hors ligne pour les idées, notes et tâches. **Jamais d'écriture financière hors ligne.** |
| **Recherche** | PostgreSQL FTS avec `unaccent` et `pg_trgm`. Pas de moteur dédié. |
| **Identifiants** | UUIDv7. |

### 3.2 Points où les agents divergent : à trancher par toi

| Sujet | Option A | Option B | Avis du coordinateur |
|---|---|---|---|
| **Convention des montants (n°8)** | `BIGINT` en unités mineures, avec une table `currencies` (XOF = 0, EUR = 2). Recommandée par **database-reviewer** et **tdd-guide**. | `NUMERIC(20,4)` avec contrôle du nombre de décimales par devise. Recommandée par **architect** et **planner**. | **A.** La base refuse structurellement 0,5 FCFA, les sommes sont exactes et rapides, et les deux options imposent de toute façon un transport en chaîne dans le JSON. `NUMERIC` est à réserver aux quantités, aux taux de TVA et aux taux de change. |
| **Adaptateur HTTP** | Express. Recommandé par **architect** : Multer, sessions et code généré par les agents. | Fastify, comme le suggère le §7.1 « si compatible ». | **Express.** Le cahier autorise l'écart, mais il faut le consigner dans un ADR. |
| **RLS PostgreSQL** | Dès la V1. Recommandée par **security-reviewer**. | Reportée, les clés étrangères composites et l'extension Prisma suffisant d'abord. Recommandée par **architect** et **database-reviewer**. | **B en V1**, puis RLS sur `transactions` et `vault_*` à l'arrivée du coffre chiffré. |
| **MFA** | Obligatoire dès l'installation. Recommandée par **security-reviewer**. | Seulement avec le coffre, donc en V1.1. Recommandée par **planner**. | **A, en version légère** : TOTP à l'installation, puisqu'un compte unique donne accès aux finances. Coût d'environ 1 à 2 jours. |
| **Statut `OVERDUE`** | Dérivé (calculé à l'affichage) : `is_overdue = échéance < aujourd'hui ET solde > 0`. | Stocké comme statut. | **A.** Cela supprime le conflit avec `PARTIALLY_PAID` (§6.4). |

---

## 4. Règles financières : base pour `docs/FINANCE_RULES.md`

**Statuts de transaction :**
- `PENDING`, `VALIDATED` et `CANCELLED` (terminal).
- Seul `VALIDATED` compte dans le solde réalisé.
- Une transaction validée n'est jamais modifiée en place : on l'annule, puis on la recrée.

**Table de vérité**, en ne comptant que les transactions `VALIDATED` :

| Type | Compte source | Compte destination | Revenus | Dépenses | Dettes | Créances | Position nette |
|---|---|---|---|---|---|---|---|
| INCOME | — | +M | +M | 0 | 0 | 0 | +M |
| INCOME, catégorie « cadeau » | — | +M | 0 (autres entrées) | 0 | 0 | 0 | +M |
| EXPENSE | −M | — | 0 | +M | 0 | 0 | −M |
| TRANSFER | −M | +M | 0 | 0 | 0 | 0 | 0 |
| BORROWING | — | +M | 0 | 0 | +M | 0 | 0 |
| LOAN | −M | — | 0 | 0 | 0 | +M | 0 |
| Remboursement de dette | −M | — | 0 | 0 | −M | 0 | 0 |
| Remboursement de créance | — | +M | 0 | 0 | 0 | −M | 0 |
| REFUND reçu (lié à la transaction d'origine) | — | +M | 0 | −M | 0 | 0 | +M |
| ADJUSTMENT CREDIT ou DEBIT (motif et audit obligatoires) | ±M | ±M | 0 | 0 | 0 | 0 | ±M |

**Décisions recommandées :**
- **Frais** : toujours une transaction EXPENSE séparée, liée par `parent_transaction_id`. Les frais mobile money suivent la même règle.
- **Trop-perçu** : refusé par défaut (erreur 422). Un mode `ADVANCE` explicite peut l'accepter.
- **Taxes** : arrondies par ligne, en demi vers le haut (half-up), puis additionnées.
- **Périodes de reporting** : intervalle `[début, fin[` sur la date civile du fuseau du workspace.
- **Multi-devises** : aucun total ne mélange les devises. Un transfert entre devises exige un taux saisi par l'utilisateur ; sans ce taux, le MVP le refuse.

**Questions ouvertes pour toi :**
- Découvert autorisé sur un compte (par exemple espèces) ?
- TVA à 18 % sur les factures ?
- Tontine : dette, compte ou catégorie ?

Les 15 cas de tests du §6.6, chiffrés en FCFA, et 8 cas limites supplémentaires sont prêts dans le rapport de `tdd-guide`. Ils incluent la concurrence, l'annulation d'un paiement, l'arrondi de TVA et les frontières de fuseau.

---

## 5. Sécurité : points bloquants avant la production

1. **Durcissement du VPS** (absent du cahier) : SSH par clé, pare-feu, mises à jour automatiques, conteneurs sans root, Redis et PostgreSQL non exposés. Le plus simple est de placer l'accès derrière **Tailscale ou Cloudflare Access en V1**.
2. **Journal d'audit en ajout seul** : le rôle applicatif n'a que le droit `INSERT`, et une copie est conservée hors du serveur. Fusionner `vault_access_logs` dans `audit_logs`.
3. **Masquage dans les logs** : pino `redact` sur `authorization`, `cookie`, `password`, `token`, `secret`. Swagger désactivé en production.
4. **Sauvegardes** chiffrées avec age ou restic, immuables, **sans jamais la clé du coffre dans la même sauvegarde**.
5. **Chaîne d'approvisionnement** : lockfile, `pnpm audit`, gitleaks en CI, Renovate.
6. **SSRF** : ne jamais aller chercher les URL d'applications saisies par l'utilisateur. Uniquement `http(s)`, liens en `rel="noopener noreferrer"`.
7. **Mass assignment** : jamais de `prisma.x.create({ data: dto })` sans DTO strict. Réponses filtrées par un `select` explicite.
8. **Conformité (loi sénégalaise 2008-12, CDP)** : une déclaration est probable dès qu'il y a des données de clients. Les transferts hors du Sénégal (hébergement UE, fournisseurs d'IA, Google) doivent être documentés. À faire valider par un juriste avant la phase SaaS (P4).

---

## 6. Périmètre et plan de livraison

**Coupes recommandées pour le MVP, qui respectent les règles de sécurité et de finance :**
- coffre chiffré, BullMQ, factures et paiements fractionnés ;
- récurrences, documents, calendrier, e-mail ;
- staging permanent ;
- dépendances de tâches.

| Jalon | Contenu | Critère de sortie | Jours effectifs |
|---|---|---|---|
| **M0 Cadrage** | ADR, `FINANCE_RULES.md`, `DATA_MODEL.md` des tables P0, `AGENTS.md` | Les 15 cas chiffrés sont validés et l'ERD P0 est figé | 2 à 4 |
| **M1 Squelette déployé** | Monorepo, CI, migration P0 **unique**, auth, workspace, audit, sauvegarde hors VPS | Connexion en HTTPS sur le VPS et premier test « A ne lit pas B » vert | 6 à 9 |
| **M2 Capture et organisation** | Idées, tâches, notes, tags, clients, projets, conversion d'une idée en projet, capture rapide | Une semaine d'usage quotidien réel | 6 à 9 |
| **M3 Finance fiable (fin du MVP)** | Comptes, catégories, transactions, transferts, idempotence, dettes et créances, annulation, correction | Tests du §6.6 verts et soldes Wave, Orange Money et espèces identiques à la réalité | 8 à 12 |
| **M4 Inventaire et dashboard** | Applications, domaines, serveurs, abonnements, échéances sur 30 jours, widgets, recherche | Le dashboard utilise les mêmes services que les pages | 5 à 7 |
| **M5 Durcissement (§18)** | Restauration testée, export global, logs structurés, runbooks, revue de sécurité | Liste du §18 cochée, RTO mesuré | 4 à 6 |
| **V1.1** | Factures, file de jobs et rappels, récurrences, documents, coffre chiffré, MFA renforcée | — | 25 à 40 |

- **Chemin critique :** ADR → modèle de données P0 → migration P0 → auth → contexte workspace → policies → comptes → transactions → transferts et idempotence → dettes → dashboard financier.
- **À confier en parallèle à des agents**, une fois le schéma figé : idées, tâches et notes ; clients et projets ; inventaire (CRUD pur) ; design system.
- **À garder pour toi, avec une revue renforcée :** auth, workspace, finance, sauvegardes, migrations.

**Tickets manquants dans le §15 :**
- seed des catégories ;
- client TypeScript généré depuis OpenAPI ;
- infrastructure de tests (Testcontainers, Playwright) ;
- déploiement ;
- **sauvegarde et restauration** ;
- observabilité ;
- design system ;
- rate limiting de l'auth ;
- annulation et correction auditées ;
- contreparties ;
- vues « Aujourd'hui » et « En retard » ;
- export global.

---

## 7. Produit et UX : ce qui fera l'usage quotidien

- **Capture rapide en moins de 5 secondes :**
  - un seul champ ;
  - parsing local de « 5000 taxi wave », qui devient une dépense de 5 000 FCFA en Transport sur Wave ;
  - un toast « Annuler » après validation ;
  - sans montant reconnu, la saisie devient une idée en `INBOX`.
- **Dashboard « centre d'attention »**, avec cinq blocs au maximum :
  - Maintenant ;
  - Argent (masquable) ;
  - 7 prochains jours ;
  - À trier ;
  - Alertes, affichées seulement s'il y en a.
- **Mobile money :**
  - comptes Wave, Orange Money et Free Money ;
  - barème de frais par opérateur, avec les frais enregistrés comme une transaction liée ;
  - l'ID de transaction de l'opérateur sert de clé d'idempotence ;
  - rapprochement avec le solde affiché par l'application de l'opérateur, l'écart étant corrigé par un `ADJUSTMENT` audité.
- **Catégories locales :** Woyofal/Senelec, Sen'eau, crédit et pass internet, transport, famille et dépenses sociales, cérémonies, tontine.
- **Mode « masquer les soldes »** pour un usage en public.
- **Exigences à rendre mesurables :**
  - progression = tâches terminées / (total − annulées) ;
  - rappels par défaut à J-30, J-7 et J-1 à 09:00 Africa/Dakar ;
  - anomalie du coffre = plus de 5 révélations en 10 minutes, ce qui entraîne un verrouillage.

---

## 8. Questions au propriétaire, par impact

1. Que contient réellement la V1 : factures, rappels, coffre ? Le §3.2, le §14 et le §18 doivent être alignés.
2. Montants en `BIGINT` (unités mineures) ou en `NUMERIC` ? Utilises-tu d'autres devises que le XOF ?
3. Quels comptes mobile money utilises-tu ? Faut-il gérer les frais et le rapprochement ?
4. Coffre en V1 : références seulement, ce qui est recommandé ?
5. MFA TOTP dès l'installation ?
6. Quel canal de notification lis-tu vraiment : push, e-mail, Telegram, WhatsApp (payant) ?
7. Quels sont l'hébergeur, le budget mensuel et l'objectif RPO/RTO ?
8. La V1 peut-elle être mono-utilisateur (OWNER seul), avec la matrice des rôles en P4 ?
9. Découvert autorisé ? TVA à 18 % ? Comment traiter la tontine ?
10. Quelle métrique dira que la V1 « marche » ? Par exemple au moins une capture par jour et un écart nul au rapprochement hebdomadaire.

---

## 9. Prochaine étape proposée (M0)

Une fois les questions 1 à 5 tranchées, produire dans cet ordre :
1. `docs/ADR/001` à `014` ;
2. `docs/FINANCE_RULES.md` ;
3. `docs/DATA_MODEL.md` avec l'ERD des tables P0 ;
4. `docs/SECURITY.md` ;
5. `docs/ARCHITECTURE.md` ;
6. `AGENTS.md` ;
7. le backlog ordonné.

Aucun code avant la validation de ces documents (§19).
