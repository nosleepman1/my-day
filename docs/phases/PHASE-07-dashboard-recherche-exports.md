# PHASE-07 : Dashboard, recherche globale et exports

- **Statut :** À faire
- **Dépend de :** PHASE-04, PHASE-06
- **Accès :** Tous
- **Estimation :** 5 à 7 jours effectifs

## 1. Objectif
Donner à l'utilisateur un **centre d'attention** qui lui dit quoi faire maintenant (tâches, échéances, dettes, occurrences à confirmer) et une vue claire de sa trésorerie, une **recherche globale** rapide sur toutes ses données, et la possibilité d'**exporter** ses données en JSON et CSV. Cette phase conditionne l'ouverture publique des inscriptions (jalon J6 de `ROADMAP.md`).

## 2. Contexte à charger
1. `DECISIONS.md` : ADR-006 (ré-authentification pour l'export), ADR-007 (SQL brut encadré), ADR-008, ADR-012, ADR-017, ADR-020, ADR-023, ADR-024.
2. `PRODUCT_SCOPE.md` §4 (ligne M06 et « Évolutions prévues » : widgets étendus par les phases suivantes).
3. `ARCHITECTURE.md` : composition inter-modules (le dashboard lit les services des modules, sans accès direct à leurs tables).
4. `DATA_MODEL.md` : section `export_jobs`, section recherche (colonnes `tsvector`, configuration `unaccent`, index GIN et trigram), `user_preferences` (disposition du dashboard).
5. `API.md` : routes `/dashboard`, `/search`, `/exports`, téléchargement en flux.
6. `FINANCE_RULES.md` : sections soldes, rapports et dettes (les widgets réutilisent les mêmes calculs).
7. `SECURITY.md` : exports (ré-auth, audit, injection CSV, limitation), recherche (pas de fuite inter-utilisateurs), SQL brut.
8. `DESIGN_SYSTEM.md` et `FRONTEND.md` : widgets, cartes, palette de recherche (`Ctrl+K`), états.
9. `docs/progress/PHASE-04-REPORT.md` et `docs/progress/PHASE-06-REPORT.md` : services à réutiliser.
10. `PRODUCT_SPEC.md` §4.2, §4.20, §4.25, §10.4 uniquement.

## 3. Périmètre
### Inclus
**Dashboard et centre d'attention**
- **Centre d'attention** : liste unique d'éléments actionnables, triés par urgence puis par date, chacun avec un lien vers le détail et, si pertinent, une action rapide (terminer, confirmer, reporter) :
  - tâches en retard ; tâches du jour ;
  - dettes et créances en retard ou à échéance ≤ 7 jours ;
  - occurrences récurrentes échues à confirmer, et à venir sous 7 jours ;
  - transactions `PENDING` ;
  - comptes avec solde projeté négatif dans l'horizon ;
  - idées en `INBOX` depuis plus de 7 jours (à trier).
- **Widgets** (§4.2 du cahier, limités aux modules livrés) : trésorerie par compte et totaux **par devise** ; entrées et sorties de la période (période **explicite**, sélecteur : ce mois, mois dernier, 30 jours, personnalisé) ; dettes à payer et créances à recevoir ; tâches du jour, en retard et prioritaires ; projets actifs et progression ; dernières idées capturées ; prochaines occurrences récurrentes ; activité récente (issue d'`audit_logs` de l'utilisateur, actions lisibles).
- **Registre de widgets** côté API et web : chaque module déclare ses widgets et ses sources d'attention ; les phases suivantes (calendrier, factures, domaines, intégrations…) s'y ajoutent sans modifier le noyau.
- Les widgets financiers appellent **les mêmes services** que les pages finance (§4.2 du cahier) ; aucun calcul dupliqué.
- Personnalisation simple : masquer/afficher et ordonner les widgets (préférence stockée par utilisateur) ; respect de `enabled_modules`.
- Valeurs nulles et absence de données présentées clairement (états vides avec action).

**Recherche globale**
- Recherche plein texte PostgreSQL (ADR-017) : colonnes `tsvector` générées (configuration texte française avec `unaccent`), index GIN, complément `pg_trgm` pour la tolérance aux fautes et les titres courts.
- Sources couvertes dans cette phase : idées, tâches, projets, notes, transactions (description, notes, référence), contreparties, dettes, comptes financiers, tags.
- **Registre de sources de recherche** extensible (les phases suivantes ajoutent clients, documents, événements, applications, domaines…).
- Requête unique par source, **toujours filtrée par `user_id`**, écrite dans `platform/database/raw/search/` (ADR-007 point 5), paramètres liés uniquement (jamais de concaténation).
- Résultats limités aux champs nécessaires (type, id, titre, extrait surligné, date, statut), groupés par type, pagination par curseur, filtres de type et de période, tri par pertinence ou date.
- Palette de recherche (`Ctrl+K` desktop, icône dans l'en-tête mobile) avec navigation clavier, et page de résultats complète.

**Exports**
- Formats : **JSON** complet (toutes les données de l'utilisateur des modules livrés, schéma versionné, montants en chaîne avec devise) et **CSV** par jeu de données (transactions, comptes, dettes, récurrences, tâches, idées, projets, notes), livrés dans une archive ZIP.
- Contenu financier : devise, dates, catégories, comptes, références (§4.25 du cahier) ; aucun secret, aucun jeton, aucun hachage de mot de passe, aucune donnée de session.
- Parcours : demande d'export → **ré-authentification récente exigée** (ADR-006) → création d'une entrée `export_jobs` (portée, format, statut, expiration 15 min, empreinte du jeton de téléchargement) → téléchargement **en flux** par lien à usage unique → statut `DOWNLOADED` ; génération **synchrone en flux** au moment du téléchargement (ADR-012 : pas de job avant PHASE-08 ; aucun fichier stocké).
- Limitation : 5 exports par heure et par utilisateur ; audit de chaque demande et téléchargement.
- Protection contre l'injection de formules CSV (préfixe des cellules commençant par `=`, `+`, `-`, `@`, tabulation, retour chariot), encodage UTF-8 avec BOM pour Excel, séparateur documenté.
- Écran « Exporter mes données » dans les paramètres.

### Exclu (et phase où ces éléments seront traités)
- Widgets factures, rendez-vous, domaines, serveurs, services, alertes d'intégration et d'automatisation → phases de leurs modules (09, 10, 12, 14, 15), via les registres livrés ici.
- Notifications des éléments du centre d'attention → PHASE-08.
- Exports asynchrones volumineux et export des documents (fichiers) → PHASE-09 (documents) et PHASE-17 (export complet du compte en libre-service avec fichiers).
- Import de données → non prévu ; à proposer comme décision.
- Recherche sémantique ou par IA → PHASE-16.

## 4. Modèle de données
- Table créée : `export_jobs` (`id`, `user_id`, `scope`, `format`, `status` : `READY` | `DOWNLOADED` | `EXPIRED`, `download_token_hash`, `expires_at`, `downloaded_at`, `row_counts` jsonb, timestamps). Détail dans `DATA_MODEL.md`.
- Tables modifiées :
  - `ideas`, `tasks`, `projects`, `notes`, `transactions`, `counterparties`, `debts`, `financial_accounts`, `tags` : colonne `search_vector tsvector` générée + index GIN ; index trigram sur les titres/noms selon `DATA_MODEL.md`.
  - `user_preferences` : colonne de disposition du dashboard (jsonb validé par contrat) si `DATA_MODEL.md` la prévoit ainsi.
- Configuration de recherche texte (`orbit_fr` ou nom fixé par `DATA_MODEL.md`) basée sur `unaccent` + dictionnaire français.
- Migrations : `0006_search` (SQL écrit à la main dans la migration Prisma, colonnes générées et index), `0007_export_jobs`.

## 5. API
Voir `API.md`. Tout utilisateur authentifié, données propres uniquement.

| Méthode | Route | Remarque |
|---|---|---|
| GET | `/dashboard` | widgets visibles, `period` explicite (`from`, `to`) |
| GET | `/dashboard/attention` | centre d'attention, pagination |
| GET | `/dashboard/widgets/:key` | rafraîchissement d'un widget |
| PATCH | `/dashboard/layout` | ordre et visibilité des widgets |
| GET | `/search` | `q` (2 à 100 caractères), `types`, `from`, `to`, `sort`, curseur |
| POST | `/exports` | `{ scope, format }` ; ré-authentification récente requise ; renvoie l'URL de téléchargement à usage unique |
| GET | `/exports` | historique des exports |
| GET | `/exports/:id/download` | `token` à usage unique ; flux ZIP ou JSON ; 410 si expiré ou déjà téléchargé |

## 6. Frontend
| Route | Écran |
|---|---|
| `/` | Accueil = centre d'attention en tête, puis widgets ; sélecteur de période ; liens vers le détail |
| `/settings/dashboard` | Choix et ordre des widgets |
| Palette `Ctrl+K` | Recherche instantanée (debounce), résultats groupés, navigation clavier |
| `/search?q=` | Résultats complets, filtres de type et de période |
| `/settings/export` | Demande d'export (portée, format), ré-auth, téléchargement, historique |

- Actions rapides depuis le centre d'attention : terminer une tâche, confirmer une occurrence (formulaire pré-rempli, idempotence), ouvrir une dette.
- États obligatoires : chargement par widget (un widget en erreur n'empêche pas les autres), vide, période sans données, données périmées (horodatage de calcul), lien expiré pour l'export.

## 7. Règles métier et cas limites
- Les montants du dashboard sont **identiques** à ceux des pages finance pour la même période (test de non-régression qui compare les deux).
- Aucun total qui mélange les devises ; un widget par devise si nécessaire.
- Période toujours affichée ; bornes calculées dans le fuseau de l'utilisateur.
- Un module désactivé (`enabled_modules`) disparaît du dashboard et de la recherche.
- Recherche : requête vide ou d'un caractère → 422 ; caractères spéciaux traités sans erreur (`websearch_to_tsquery` ou équivalent) ; aucun résultat d'un autre utilisateur, même avec des termes identiques ; éléments archivés exclus par défaut (filtre pour les inclure) ; transactions annulées marquées comme telles.
- Export : sans ré-auth récente → 401/403 avec code `REAUTH_REQUIRED` ; jeton de téléchargement utilisé deux fois → 410 ; export d'un autre utilisateur → 404 ; génération interrompue → aucun statut `DOWNLOADED` erroné.
- Le contenu exporté ne contient jamais de secret, jeton, hachage ni identifiant de session (test qui parcourt l'export).
- Les performances : dashboard < 500 ms et recherche < 300 ms (p95) sur un jeu de données synthétique de 10 000 éléments par utilisateur.

## 8. Tests exigés
- **Unitaires :** tri et construction du centre d'attention, registre de widgets et de sources, échappement CSV, sérialisation de l'export (montants en chaîne).
- **Intégration :** chaque widget contre une base Testcontainers peuplée ; égalité dashboard ↔ rapports finance ; recherche (accents : « éléctricité » trouve « electricite », fautes légères via trigram, pagination) ; export complet relu et validé contre son schéma ; jeton à usage unique et expiration.
- **Isolation :** harnais généré pour toutes les nouvelles routes ; test spécifique : deux utilisateurs avec des contenus identiques, la recherche de A ne renvoie que les éléments de A ; l'export de A ne contient aucune ligne de B ; `/dashboard` de A n'agrège rien de B.
- **Sécurité :** injection SQL dans `q` et les filtres, injection de formules CSV, export sans ré-auth, rejeu du lien, revue du SQL brut de recherche par `database-reviewer` et `security-reviewer`.
- **Performance :** test de charge simple (jeu synthétique) sur `/dashboard` et `/search`, plans d'exécution vérifiés (utilisation des index GIN).
- **E2E Playwright :** accueil avec tâche en retard et occurrence à confirmer → action rapide → l'élément disparaît du centre d'attention ; `Ctrl+K` → recherche d'une note par un mot sans accent → ouverture ; export JSON avec ré-auth → fichier téléchargé et lisible ; mobile et desktop.

## 9. Découpage en tâches
| Tâche | Intitulé | Dépend de |
|---|---|---|
| T1 | Migration `0006_search` (configuration texte, colonnes générées, index GIN/trigram) ; revue `database-reviewer` | — |
| T2 | Migration `0007_export_jobs` ; préférence de disposition du dashboard ; contrats Zod | — |
| T3 | Registre de sources de recherche ; requêtes brutes par source dans `platform/database/raw/search/` ; endpoint `/search` | T1 |
| T4 | Registre de widgets et de sources d'attention ; widgets organisation (tâches, projets, idées, activité) | T2 |
| T5 | Widgets finance (trésorerie, période, dettes, occurrences) branchés sur les services existants ; test d'égalité avec les rapports | T4 |
| T6 | Centre d'attention (agrégation, tri, actions rapides côté API) | T4, T5 |
| T7 | Exports : génération JSON et CSV/ZIP en flux, échappement, jeton à usage unique, ré-auth, limitation, audit | T2 |
| T8 | Front accueil (centre d'attention, widgets, période, personnalisation) | T6 |
| T9 | Front recherche (palette `Ctrl+K`, page de résultats) | T3 |
| T10 | Front export (paramètres, ré-auth, téléchargement, historique) | T7 |
| T11 | Tests d'isolation ciblés, sécurité, performance, E2E | T8–T10 |
| T12 | Revues ECC, vérification, mise à jour docs, rapport ; liste de contrôle d'ouverture publique (jalon J6) | T11 |

## 10. Agents ECC à mobiliser
- `tdd-guide`, `planner`.
- `security-reviewer` (**obligatoire** : SQL brut de recherche, exports, isolation des agrégats).
- `database-reviewer` (**obligatoire** : colonnes générées, index, plans d'exécution).
- `performance-optimizer` (requêtes du dashboard et de la recherche).
- `typescript-reviewer`, `code-reviewer`, `react-reviewer`, `a11y-architect`.
- `e2e-runner`.

## 11. Definition of Done
- [ ] Centre d'attention et widgets fonctionnels, montants identiques aux pages finance.
- [ ] Recherche globale insensible aux accents, paginée, strictement limitée à l'utilisateur.
- [ ] Export JSON et CSV complets, sans secret, avec ré-auth, lien à usage unique et audit.
- [ ] Registres de widgets, d'attention et de recherche documentés pour les phases suivantes.
- [ ] Objectifs de performance atteints sur le jeu synthétique.
- [ ] Toutes les nouvelles routes couvertes par le harnais d'isolation.
- [ ] Liste de contrôle d'ouverture publique (J6, `ROADMAP.md`) établie dans le rapport, avec recommandation.
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` cochée.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-07-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`).
