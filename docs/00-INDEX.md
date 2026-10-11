# ORBIT : index de la documentation

La documentation est **la mémoire du projet**. Une IA qui travaille sur ORBIT ne connaît que ce qu'elle lit ici. Chaque document a **une seule responsabilité**.

## 1. Carte des documents

| Document | Responsabilité | Question à laquelle il répond |
|---|---|---|
| `../AGENTS.md` | Règles impératives pour les agents IA | Que dois-je toujours faire, et ne jamais faire ? |
| `PRODUCT_SPEC.md` | Cahier des charges d'origine (v1.0) | Que veut le produit, en détail ? |
| `PRODUCT_SCOPE.md` | Périmètre consolidé, carte des modules, rôles | Qu'est-ce qui est construit, pour qui et dans quelle phase ? |
| `DECISIONS.md` | Registre des décisions (ADR) | Pourquoi avoir choisi X ? *(prime sur tout le reste)* |
| `ARCHITECTURE.md` | Architecture système, monorepo, modules, flux | Où va le code, et comment les parties communiquent-elles ? |
| `DESIGN_PATTERNS.md` | Patrons de conception imposés, avec exemples | Comment écrire un module, un service, un repository, un port ? |
| `CODING_STANDARDS.md` | Conventions de code, nommage, erreurs, logs | À quoi doit ressembler le code ? |
| `DATA_MODEL.md` | Schéma de données, contraintes, index, migrations | Quelles tables, quelles colonnes, quelles contraintes ? |
| `FINANCE_RULES.md` | Règles de calcul financier et cas chiffrés | Comment calculer un solde, une dette, une facture ? |
| `SECURITY.md` | Modèle de menace et contrôles de sécurité | Comment protéger les données et les comptes ? |
| `API.md` | Conventions REST et catalogue des endpoints | Quel format de requête, de réponse et d'erreur ? |
| `FRONTEND.md` | Architecture React, état, formulaires, PWA | Comment structurer le front ? |
| `DESIGN_SYSTEM.md` | Identité visuelle, composants, UX, accessibilité | À quoi ressemble l'interface, et comment se comporte-t-elle ? |
| `TESTING.md` | Stratégie et outils de test, seuils, isolation | Que tester, comment, et qu'est-ce qui bloque la CI ? |
| `INFRASTRUCTURE.md` | Docker, environnements, CI/CD, déploiement, sauvegardes, observabilité | Comment lancer, déployer et restaurer ? |
| `INTEGRATIONS.md` | OAuth, Google, Gmail, WhatsApp, n8n, webhooks | Comment connecter des services externes ? |
| `DEVELOPMENT_METHOD.md` | Méthode de développement par phases avec IA | Comment travailler, phase après phase ? |
| `ROADMAP.md` | Les 18 phases, dépendances, jalons | Dans quel ordre construire ? |
| `phases/PHASE-XX-*.md` | Fiche autoportante de chaque phase | Que dois-je faire dans cette phase précise ? |
| `progress/PHASE-XX-REPORT.md` | Rapport de fin de phase, rédigé par l'IA | Qu'est-ce qui a été fait, et qu'est-ce qui reste ? |
| `analysis/` | Analyses historiques | Contexte uniquement. Ce n'est pas une référence. |

## 2. Ordre de lecture

**Toujours :**
1. `AGENTS.md`
2. `DECISIONS.md`
3. `PRODUCT_SCOPE.md`
4. `ROADMAP.md`
5. le dernier `progress/PHASE-XX-REPORT.md`
6. la fiche de la phase courante

Ensuite, uniquement les documents listés dans la section « Contexte à charger » de la fiche de phase.

## 3. Gabarit d'une fiche de phase

Chaque fichier `docs/phases/PHASE-XX-<slug>.md` suit **exactement** ce gabarit :

```markdown
# PHASE-XX : <Titre>

- **Statut :** À faire | En cours | Terminée
- **Dépend de :** PHASE-.., PHASE-..
- **Accès :** USER | ADMIN | Tous
- **Estimation :** <n à m> jours effectifs

## 1. Objectif
Une ou deux phrases sur la valeur livrée.

## 2. Contexte à charger
Liste ordonnée des documents ou sections à lire, et seulement ceux-là.

## 3. Périmètre
### Inclus
### Exclu (et phase où ces éléments seront traités)

## 4. Modèle de données
Tables créées ou modifiées (noms canoniques de PRODUCT_SCOPE §4), renvoi aux sections de DATA_MODEL.md, nom de la migration.

## 5. API
Endpoints (méthode, route, rôle requis), renvoi à API.md.

## 6. Frontend
Écrans, routes, composants, états obligatoires.

## 7. Règles métier et cas limites
Règles propres à la phase, avec renvoi à FINANCE_RULES.md ou SECURITY.md si besoin.

## 8. Tests exigés
Unitaires, intégration, E2E, isolation entre utilisateurs, sécurité.

## 9. Découpage en tâches
Liste ordonnée de tâches d'au plus une demi-journée (T1, T2…), avec leurs dépendances.

## 10. Agents ECC à mobiliser
Par exemple tdd-guide, typescript-reviewer, security-reviewer, database-reviewer, e2e-runner…

## 11. Definition of Done
Liste à cocher, qui inclut la DoD générale de DEVELOPMENT_METHOD.md.

## 12. Rapport de fin de phase
Rédiger docs/progress/PHASE-XX-REPORT.md (gabarit dans DEVELOPMENT_METHOD.md).
```

## 4. Liste des phases

| Phase | Fichier |
|---|---|
| 00 | `phases/PHASE-00-socle-technique.md` |
| 01 | `phases/PHASE-01-identite-sessions.md` |
| 02 | `phases/PHASE-02-shell-design-system.md` |
| 03 | `phases/PHASE-03-production-continue.md` |
| 04 | `phases/PHASE-04-organisation.md` |
| 05 | `phases/PHASE-05-finance-coeur.md` |
| 06 | `phases/PHASE-06-dettes-recurrences.md` |
| 07 | `phases/PHASE-07-dashboard-recherche-exports.md` |
| 08 | `phases/PHASE-08-async-rappels-notifications.md` |
| 09 | `phases/PHASE-09-calendrier-documents.md` |
| 10 | `phases/PHASE-10-pro-clients-factures.md` |
| 11 | `phases/PHASE-11-objectifs-habitudes-journal.md` |
| 12 | `phases/PHASE-12-zone-dev-inventaire.md` |
| 13 | `phases/PHASE-13-coffre-fort-mfa.md` |
| 14 | `phases/PHASE-14-integrations.md` |
| 15 | `phases/PHASE-15-automatisations.md` |
| 16 | `phases/PHASE-16-ia-capture-multicanale.md` |
| 17 | `phases/PHASE-17-administration-saas-conformite.md` |
