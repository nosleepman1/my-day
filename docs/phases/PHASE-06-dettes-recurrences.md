# PHASE-06 : Dettes, créances, récurrences et prévisions

- **Statut :** Terminée
- **Dépend de :** PHASE-05
- **Accès :** Tous
- **Estimation :** 6 à 8 jours effectifs

## 1. Objectif
Suivre ce que l'utilisateur doit et ce qu'on lui doit, avec remboursements partiels reliés aux transactions réelles et soldes restants exacts, et anticiper la trésorerie grâce aux dépenses et revenus récurrents (abonnements, loyer, salaire, tontine) transformés en prévisions, confirmées en transactions réelles sans jamais être comptées deux fois.

## 2. Contexte à charger
1. `DECISIONS.md` : ADR-007, 008, 009, 012 (pas de job avant PHASE-08), 018, 020, 023.
2. `PRODUCT_SCOPE.md` §2 (abonnement = dépense récurrente) et §4 (ligne M05).
3. `FINANCE_RULES.md` : sections dettes et créances (solde restant, statuts, remboursement, trop-perçu, radiation, classification des remboursements), récurrences et prévisions (occurrences, confirmation, double comptage), et tous les cas FIN-xx associés.
4. `DATA_MODEL.md` : sections `debts`, `debt_repayments`, `recurring_transactions`, `recurring_occurrences` ; rappel des tables finance de PHASE-05.
5. `API.md` : routes `/finance/debts`, `/finance/recurring`, `/finance/reports/*`.
6. `docs/progress/PHASE-05-REPORT.md` : services de solde, d'idempotence et de verrouillage à réutiliser.
7. `DESIGN_SYSTEM.md` : affichage d'échéances, progression, statut dérivé « en retard ».
8. `PRODUCT_SPEC.md` §4.11, §4.13, §6.3, Annexe A.3 uniquement.

## 3. Périmètre
### Inclus
**Dettes et créances**
- Types `PAYABLE` (je dois) et `RECEIVABLE` (on me doit) ; champs : contrepartie (obligatoire, table `counterparties`), titre, motif, principal (BIGINT mineures), devise, date d'ouverture, échéance facultative, notes, statut stocké pour les états de cycle de vie selon `FINANCE_RULES.md` (ouverte, partiellement réglée, soldée, annulée, radiée) ; **« en retard » toujours dérivé** (ADR-020), jamais stocké.
- **Création avec ou sans mouvement de trésorerie** :
  - avec : emprunt reçu (`BORROWING`, crédit du compte choisi) pour une `PAYABLE`, prêt accordé (`LOAN`, débit du compte) pour une `RECEIVABLE`, créé dans la même transaction SQL que la dette ;
  - sans : dette historique ou née hors trésorerie (ex. achat à crédit) — aucune écriture.
- **Remboursements** (`debt_repayments`) : chaque remboursement est **relié à une transaction** (règle du cahier) :
  - soit créé avec sa transaction (compte, date, montant, `Idempotency-Key`) dans la même transaction SQL ;
  - soit en rattachant une transaction validée existante non encore rattachée (`transaction_id` unique dans `debt_repayments` : une transaction ne rembourse jamais deux dettes, et n'est jamais comptée deux fois).
  - Classification : le principal remboursé n'est **ni une charge opérationnelle ni un revenu** (catégories « Remboursement de dette » / « Remboursement reçu » et classification économique de `FINANCE_RULES.md`).
- **Solde restant** dérivé : principal + ajustements autorisés − remboursements imputés dont la transaction est `VALIDATED` (§6.3 du cahier). Annuler la transaction d'un remboursement rouvre automatiquement le solde.
- Remboursement supérieur au solde restant → **refusé par défaut** ; le traitement explicite (avance, trop-perçu, correction) suit `FINANCE_RULES.md`.
- **Annulation** d'une dette (saisie par erreur) : refusée si des remboursements validés existent ; sinon statut annulé, audit. **Radiation** d'une créance (abandon) : statut radié, montant radié conservé, aucune écriture de trésorerie, motif obligatoire.
- Vues par personne (contrepartie), par période, par statut ; totaux à payer / à recevoir **par devise**.
- Historique complet des versements (Annexe A.3).

**Transactions récurrentes**
- `recurring_transactions` : nom, sens (`EXPENSE` | `INCOME`), montant attendu, devise, compte, catégorie, contrepartie facultative, fréquence (`WEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY`) avec intervalle et ancrage (jour du mois, avec règle de fin de mois), date de début, date de fin facultative ou nombre d'occurrences, actif/inactif, mode de confirmation (`MANUAL` uniquement dans cette phase), délai de rappel en jours (utilisé en PHASE-08), notes.
- `recurring_occurrences` : une ligne par échéance, unicité `(recurring_transaction_id, due_date)` = **clé d'idempotence de l'occurrence** ; statut (`FORECAST`, `CONFIRMED`, `SKIPPED`), montant attendu, `transaction_id` unique nullable.
- **Génération des occurrences** (ADR-012 : pas de job avant PHASE-08) : matérialisation **synchrone et idempotente** des occurrences jusqu'à un horizon (90 jours par défaut) lors de la création/modification d'une récurrence et lors de la lecture des occurrences ou des prévisions (`INSERT … ON CONFLICT DO NOTHING`). PHASE-08 ajoute la génération planifiée.
- **Confirmation** d'une occurrence : crée la transaction réelle (montant réel éventuellement différent, date et compte modifiables), lie `transaction_id`, passe à `CONFIRMED` ; une occurrence confirmée deux fois → même transaction (idempotence par occurrence). **Ignorer** une occurrence : `SKIPPED`. Rattacher une transaction existante à une occurrence : possible (évite le double comptage d'un abonnement déjà saisi à la main).
- Modifier une récurrence n'affecte que les occurrences futures non confirmées ; les occurrences confirmées et passées ne changent jamais.
- Désactiver une récurrence supprime (ou marque `SKIPPED`, selon `DATA_MODEL.md`) les occurrences futures non confirmées.

**Prévisions de trésorerie**
- Par compte et par devise, sur un horizon (30/60/90 jours) : solde réalisé d'aujourd'hui + occurrences `FORECAST` datées dans l'horizon (entrées et sorties), présentées en **série séparée** du réalisé (§4.13 du cahier) ; les occurrences confirmées sont déjà dans le réalisé et sont donc exclues (pas de double comptage, Annexe A.2).
- Échéances de dettes et créances dans l'horizon affichées à titre indicatif (option d'inclusion explicite), selon `FINANCE_RULES.md`.
- Alerte visuelle si le solde projeté d'un compte passe sous zéro.

### Exclu (et phase où ces éléments seront traités)
- Rappels et notifications avant échéance de dette ou d'occurrence → PHASE-08.
- Génération planifiée des occurrences et mode de confirmation `AUTO` → PHASE-08 (la confirmation automatique crée des transactions : elle exige le worker et l'outbox).
- Widgets dettes et prévisions du dashboard → PHASE-07.
- Intérêts, pénalités, échéanciers complexes → hors périmètre (§4.11 du cahier) ; à proposer comme décision si besoin.
- Lien d'une récurrence vers un serveur, un domaine ou un service technique → PHASE-12.
- Factures → PHASE-10.

## 4. Modèle de données
Tables créées (noms canoniques, détail dans `DATA_MODEL.md`) : `debts`, `debt_repayments`, `recurring_transactions`, `recurring_occurrences`.

Modifications : `transactions.type` accepte désormais `BORROWING` et `LOAN` (déjà dans l'énumération si `DATA_MODEL.md` l'a prévu dès PHASE-05, sinon ajout par migration) ; seed applicatif des catégories complété si nécessaire (« Emprunt reçu », « Prêt accordé »), idempotent.

Points obligatoires :
- FK composites `(user_id, …)` vers `counterparties`, `financial_accounts`, `transaction_categories`, `transactions`.
- `debt_repayments.transaction_id` **unique** ; `recurring_occurrences.transaction_id` **unique** ; une même transaction ne peut pas être à la fois remboursement et occurrence confirmée (vérifié par le service ; contrainte si `DATA_MODEL.md` la prévoit).
- `CHECK (principal_minor > 0)`, montants attendus > 0.
- Unicité `(recurring_transaction_id, due_date)`.
- Index : `debts (user_id, status, due_on)`, `debts (user_id, counterparty_id)`, `recurring_occurrences (user_id, due_date, status)`.

Migration : `0005_debts_recurring`.

## 5. API
Voir `API.md`. Tout utilisateur authentifié, données propres uniquement. `Idempotency-Key` obligatoire sur toute route qui crée une transaction.

| Méthode | Route | Remarque |
|---|---|---|
| GET / POST | `/finance/debts` | filtres type, statut (dont `overdue` dérivé), contrepartie, période ; POST avec mouvement initial facultatif |
| GET / PATCH | `/finance/debts/:id` | PATCH limité (titre, motif, échéance, notes) ; changement d'échéance audité |
| POST | `/finance/debts/:id/repayments` | crée la transaction ou rattache `transactionId` existant |
| DELETE | `/finance/debts/:id/repayments/:repaymentId` | détache (la transaction reste) ; ou annulation via la transaction |
| POST | `/finance/debts/:id/cancel` | refusé si remboursements validés |
| POST | `/finance/debts/:id/write-off` | `RECEIVABLE` uniquement, motif obligatoire |
| GET | `/finance/debts/summary` | totaux à payer / à recevoir par devise, en retard |
| GET / POST | `/finance/recurring` | |
| GET / PATCH | `/finance/recurring/:id` | |
| POST | `/finance/recurring/:id/pause`, `/finance/recurring/:id/resume` | |
| GET | `/finance/recurring/:id/occurrences` | matérialise jusqu'à l'horizon |
| GET | `/finance/recurring/occurrences` | toutes récurrences, filtre `from`/`to`/`status` |
| POST | `/finance/recurring/occurrences/:occurrenceId/confirm` | crée ou rattache la transaction |
| POST | `/finance/recurring/occurrences/:occurrenceId/skip` | |
| GET | `/finance/reports/forecast` | `horizon`, `accountId` facultatif, `includeDebts` |

## 6. Frontend
| Route | Écran |
|---|---|
| `/finance/debts` | Onglets « Je dois » / « On me doit » ; totaux par devise ; filtres ; badge « en retard » dérivé |
| `/finance/debts/:id` | Détail : progression, solde restant, historique des versements, ajouter un remboursement, annuler, radier |
| `/finance/debts/new` | Création avec option « argent reçu / donné maintenant » (compte) |
| `/finance/counterparties/:id` | Enrichi : dettes et créances de la personne |
| `/finance/recurring` | Liste (abonnements, loyer, salaire, tontine) ; prochaine échéance ; coût mensuel équivalent par devise |
| `/finance/recurring/:id` | Détail, occurrences passées et à venir, confirmer / ignorer / rattacher |
| `/finance/upcoming` | Occurrences à confirmer (échues) et à venir |
| `/finance/forecast` | Courbe réalisé vs prévu par compte, alerte de solde projeté négatif |

États obligatoires, dont « remboursement supérieur au solde », « dette déjà soldée », « occurrence déjà confirmée », « horizon vide ».

## 7. Règles métier et cas limites
Toutes les règles et cas FIN-xx de `FINANCE_RULES.md` relatifs aux dettes, créances, récurrences et prévisions s'appliquent ; rappels :
- Annexe A.3 : dette de 100 000 FCFA, remboursement de 30 000 → reste 70 000 ; remboursement de 70 000 → soldée ; historique des deux versements conservé ; aucun des deux n'est une dépense opérationnelle.
- Remboursement dans une devise différente de la dette → refusé (pas de conversion implicite).
- Remboursement depuis un compte sans provision suffisante → règle de découvert de PHASE-05 (409).
- Rattacher une transaction déjà rattachée à une autre dette ou occurrence → 409.
- Rattacher une transaction annulée ou `PENDING` → 409.
- Statut « en retard » : échéance < aujourd'hui dans le fuseau de l'utilisateur, solde restant > 0, statut non terminal (ADR-020).
- Récurrence mensuelle ancrée au 31 → dernier jour du mois pour les mois courts ; 29 février → 28 les années non bissextiles (règle exacte dans `FINANCE_RULES.md`).
- Confirmation concurrente de la même occurrence → une seule transaction (verrou + unicité).
- Matérialisation concurrente des occurrences → aucune occurrence dupliquée (unicité + `ON CONFLICT`).
- Une prévision n'est jamais incluse dans un solde réalisé ni dans les rapports de PHASE-05.
- Toute création, remboursement, annulation, radiation, confirmation est auditée.

## 8. Tests exigés
- **Unitaires (couverture 100 % du domaine finance) :** solde restant et statut d'une dette, refus de dépassement, calcul des dates d'occurrence (fins de mois, bissextiles, intervalles, fin par nombre), projection de trésorerie.
- **Propriétés (fast-check) :** pour toute suite de remboursements acceptés, Σ remboursements ≤ principal et solde restant ≥ 0 ; matérialisation répétée = idempotente ; projection = réalisé + Σ prévisions non confirmées.
- **Cas FIN-xx** de `FINANCE_RULES.md` correspondant au §6.6 du cahier : emprunt reçu, prêt accordé, remboursement partiel d'une dette, remboursement partiel d'une créance, plus les cas récurrences et prévisions (double comptage, confirmation idempotente).
- **Intégration :** création de dette avec mouvement initial atomique ; remboursement avec transaction atomique ; annulation de la transaction → solde rouvert ; concurrence de confirmation ; matérialisation concurrente ; fuseaux (`Africa/Dakar`, `Europe/Paris`, `America/New_York`) pour « en retard » et échéances.
- **Isolation :** harnais généré pour toutes les nouvelles routes ; tests ciblés : rattacher une transaction de B à une dette de A, utiliser la contrepartie ou le compte de B → 404.
- **E2E Playwright :** scénario A.3 complet ; abonnement mensuel (ex. hébergement 5 000 FCFA) → occurrence à confirmer → confirmation → solde mis à jour et prévision diminuée ; rattacher une dépense déjà saisie à une occurrence (pas de double comptage) ; prévision de 90 jours affichant un solde projeté négatif.

## 9. Découpage en tâches
| Tâche | Intitulé | Dépend de |
|---|---|---|
| T1 | Schéma des 4 tables, contraintes, index, `BORROWING`/`LOAN` ; migration `0005_debts_recurring` ; revue `database-reviewer` | — |
| T2 | Contrats Zod dettes, remboursements, récurrences, occurrences, prévisions | T1 |
| T3 | Domaine pur : solde restant, statuts, dépassement ; calcul des dates d'occurrence ; projection | T2 |
| T4 | Dettes : création avec ou sans mouvement initial (`BORROWING`/`LOAN`), lecture, modification limitée | T3 |
| T5 | Remboursements : création avec transaction, rattachement, détachement, effet de l'annulation | T4 |
| T6 | Annulation et radiation ; synthèse par devise ; vues par contrepartie | T5 |
| T7 | Récurrences : CRUD, pause/reprise, effets sur les occurrences futures | T3 |
| T8 | Matérialisation idempotente des occurrences ; confirmation, rattachement, ignorer | T7 |
| T9 | Prévisions de trésorerie (`/finance/reports/forecast`) | T8, T6 |
| T10 | Front dettes et créances (liste, détail, création, remboursement) | T6 |
| T11 | Front récurrences, à venir, prévisions (graphique) | T9 |
| T12 | Tests de propriétés, cas FIN-xx nommés, isolation ciblée, E2E | T10, T11 |
| T13 | Revues ECC, vérification, mise à jour docs, rapport | T12 |

T4–T6 (dettes) et T7–T8 (récurrences) peuvent être confiés à deux sous-agents en parallèle après T1–T3.

## 10. Agents ECC à mobiliser
- `tdd-guide`, `planner`.
- `security-reviewer` (**obligatoire** : finance, isolation, idempotence).
- `database-reviewer` (**obligatoire** : migration, unicités, concurrence).
- `typescript-reviewer`, `code-reviewer`, `react-reviewer`, `a11y-architect`.
- `e2e-runner`.
- Revue par un agent différent de l'auteur pour le domaine finance.

## 11. Definition of Done
- [ ] Scénario Annexe A.3 vérifié en E2E.
- [ ] Aucune transaction comptée deux fois (remboursement, occurrence) : unicités et tests.
- [ ] « En retard » dérivé, jamais stocké.
- [ ] Occurrences matérialisées de façon idempotente ; prévisions séparées du réalisé.
- [ ] Couverture 100 % du domaine finance ; cas FIN-xx applicables nommés et verts.
- [ ] Toutes les nouvelles routes couvertes par le harnais d'isolation.
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` cochée.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-06-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`).
