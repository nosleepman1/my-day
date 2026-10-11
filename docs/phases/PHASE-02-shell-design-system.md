# PHASE-02 : Shell de l'application et design system

- **Statut :** À faire
- **Dépend de :** PHASE-01
- **Accès :** Tous
- **Estimation :** 5 à 7 jours effectifs

## 1. Objectif
Livrer l'enveloppe complète de l'application web, mobile-first et installable : design system, navigation mobile et desktop, pages d'authentification et de paramètres branchées sur l'API de PHASE-01, onboarding initial, bouton de capture rapide (en coquille) et composants d'états obligatoires. Chaque module des phases suivantes se « branche » dans ce shell sans le modifier.

## 2. Contexte à charger
1. `DECISIONS.md` : ADR-006 (CSRF, même origine), ADR-016, ADR-022, ADR-024.
2. `PRODUCT_SCOPE.md` §5 (navigation cible) et §3 (rôles).
3. `DESIGN_SYSTEM.md` : identité visuelle, jetons (couleurs, typographie, espacements), composants, états d'interface, accessibilité, mode sombre.
4. `FRONTEND.md` : structure `apps/web`, routage, TanStack Query, formulaires React Hook Form + Zod, PWA, i18n, gestion des erreurs API.
5. `API.md` : routes `/auth/*` et `/me*`, codes d'erreur.
6. `TESTING.md` : tests de composants, Playwright, accessibilité automatisée.
7. `phases/PHASE-01-identite-sessions.md` §5 et §7 (contrat et règles d'auth).
8. `PRODUCT_SPEC.md` §9.3, §10.1 à §10.3 uniquement.

## 3. Périmètre
### Inclus
- **Design system** dans `apps/web` : jetons Tailwind (couleurs, rayons, ombres, typographie, espacements) conformes à `DESIGN_SYSTEM.md`, thème clair/sombre (préférence système + choix utilisateur), composants shadcn/ui (Radix) installés et thémés : Button, Input, Textarea, Select, Checkbox, Switch, Dialog, Sheet (tiroir mobile), DropdownMenu, Tabs, Toast, Tooltip, Badge, Card, Skeleton, Avatar, Form (RHF + Zod), DatePicker, `MoneyInput` (saisie en chaîne, formatage via `packages/money`, jamais de float), `MoneyText`.
- **Composants d'états** réutilisables (§10.3 du cahier) : `LoadingState` (squelettes), `EmptyState` (avec action), `ErrorState` (réseau, avec réessai), `ValidationErrors` (mapping des erreurs de l'enveloppe API vers les champs), `ForbiddenState`, `NotFoundState`, `ArchivedBanner`, `ConflictDialog`, `StaleBanner` (données périmées / synchronisation), `OfflineBanner`.
- **Layout** : mobile — barre du bas (Accueil, Finances, **+**, Tâches, Plus) ; desktop (≥ 1024 px) — barre latérale complète ; en-tête avec recherche (coquille, active en PHASE-07), notifications (coquille, active en PHASE-08), menu utilisateur. Menu « Plus » conforme à `PRODUCT_SCOPE.md` §5 ; entrées **Dev** et **Admin** visibles seulement pour `role = ADMIN` ; modules masqués selon `enabled_modules`.
- **Registre de navigation** déclaratif (une entrée par module : libellé, icône, route, rôle requis, clé de module, phase de disponibilité) : les modules non encore livrés affichent une page « Bientôt disponible ».
- **Routage** : routes publiques (`/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`), routes privées protégées par un garde qui interroge `/me` ; redirection vers `/login?next=` ; gestion du 401 global (session expirée → retour connexion avec message).
- **Pages d'authentification** branchées : inscription (message générique de confirmation), vérification d'e-mail, connexion, mot de passe oublié, réinitialisation, renvoi de vérification ; messages génériques identiques à l'API.
- **Paramètres** : profil (nom), préférences (langue, fuseau avec recherche, devise par défaut, format de date, thème), modules activés (`enabled_modules`), sécurité (changer e-mail et mot de passe avec dialogue de ré-authentification, liste et révocation des sessions, historique de connexions).
- **Onboarding initial** (premier accès, `onboarding_completed_at` nul) : 3 écrans — bienvenue, fuseau et devise (préremplis `Africa/Dakar`, `XOF`), choix des modules (dont Pro désactivable) ; marque la fin via `PATCH /me/preferences`.
- **Capture rapide en coquille** : bouton **+** (barre du bas) et raccourci clavier desktop (`N` ou `Ctrl+K` selon `DESIGN_SYSTEM.md`) ouvrant un `Sheet` avec sélecteur de type (idée, tâche, note, transaction…) ; chaque type affiche « disponible en PHASE-XX » tant que son module n'est pas livré. Architecture prête : registre de types de capture, chaque module fournira son formulaire.
- **PWA** installable : `vite-plugin-pwa`, manifeste (nom, icônes, couleurs, `display: standalone`), service worker (précache de l'app shell, **jamais** de cache des réponses `/api`), écran hors ligne, invite d'installation discrète. Mise à jour du SW avec message « nouvelle version disponible ».
- **i18n** : bibliothèque retenue dans `FRONTEND.md`, `fr` par défaut, tous les textes dans des fichiers de traduction ; formatage de dates selon fuseau et préférence.
- **Accessibilité** : WCAG 2.2 AA (contrastes, focus visible, navigation clavier, libellés, zones tactiles ≥ 44 px, `prefers-reduced-motion`).
- Page d'accueil (Accueil) provisoire : salutation et cartes « à venir » (le centre d'attention arrive en PHASE-07).

### Exclu (et phase où ces éléments seront traités)
- Formulaires de capture réels : idées, tâches, notes → PHASE-04 ; transaction → PHASE-05.
- Recherche globale active → PHASE-07 ; notifications actives → PHASE-08.
- File de capture hors ligne (IndexedDB) → PHASE-04.
- Paramètres MFA → PHASE-13 ; intégrations → PHASE-14 ; export de compte → PHASE-07.
- Déploiement → PHASE-03.

## 4. Modèle de données
Aucune table créée ni modifiée. Utilise `users` et `user_preferences` (PHASE-01). Pas de migration.

## 5. API
Aucun nouvel endpoint. Consomme ceux de PHASE-01 : `/auth/register`, `/auth/email/verify`, `/auth/email/resend`, `/auth/login`, `/auth/logout`, `/auth/password/forgot`, `/auth/password/reset`, `/auth/reauth`, `/me`, `/me/preferences`, `/me/email`, `/me/password`, `/me/sessions`, `/me/sessions/:id`, `/me/sessions/revoke-others`, `/me/login-events`. Voir `API.md`.

Si un manque est découvert côté API (champ absent de `/me`), il est corrigé dans cette phase avec son test, et signalé dans le rapport.

## 6. Frontend
| Route | Écran | États obligatoires |
|---|---|---|
| `/login` | Connexion | chargement, erreur générique, compte non vérifié (lien renvoi), 429 |
| `/register` | Inscription | validation, succès générique, inscriptions fermées |
| `/verify-email` | Vérification | chargement, succès, jeton invalide |
| `/forgot-password`, `/reset-password` | Réinitialisation | succès générique, jeton invalide, validation |
| `/onboarding` | Onboarding 3 étapes | chargement, erreur, succès |
| `/` | Accueil provisoire | chargement, vide |
| `/settings/profile`, `/settings/preferences`, `/settings/modules`, `/settings/security` | Paramètres | chargement, erreur, validation, succès, ré-auth requise |
| `/more` | Menu Plus (mobile) | — |
| `/dev`, `/admin` | Coquilles ADMIN | accès refusé pour USER |
| `*` | 404 | — |

Composants partagés : `AppShell`, `BottomNav`, `Sidebar`, `TopBar`, `QuickCaptureSheet`, `ReauthDialog`, `ModuleGate` (masque selon `enabled_modules`), `RoleGate`.

## 7. Règles métier et cas limites
- Un module désactivé dans `enabled_modules` disparaît de la navigation et sa route affiche un état « module désactivé » avec lien vers les paramètres ; les entrées ADMIN ne dépendent que du rôle (ADR-024).
- Le front n'affiche **jamais** si un e-mail existe ; il reprend les messages génériques de l'API.
- Le 401 en cours de navigation vide le cache TanStack Query (pas de données d'un utilisateur précédent visibles après reconnexion d'un autre compte sur le même appareil).
- Le service worker ne met jamais en cache une réponse d'API ni une page contenant des données utilisateur.
- Saisie de montant : uniquement des chiffres (XOF sans décimale), conversion en chaîne de chiffres en unités mineures (ADR-008).
- Dates affichées dans le fuseau de l'utilisateur.

## 8. Tests exigés
- **Composants (Vitest + Testing Library) :** composants d'états, `MoneyInput` (pas de float, XOF sans décimale, EUR 2 décimales), `ModuleGate`, `RoleGate`, mapping des erreurs de validation API vers les champs, garde de route privée.
- **Accessibilité :** axe-core sur chaque écran (aucune violation sérieuse ou critique).
- **E2E Playwright** (mobile 375 px et desktop 1280 px, contre l'API réelle + Mailpit) : inscription → lecture du lien dans Mailpit → vérification → connexion → onboarding → accueil ; mot de passe oublié → reset → connexion ; révocation d'une autre session (deux contextes navigateur) ; USER ne voit ni Dev ni Admin et reçoit « accès refusé » sur `/admin` ; désactivation d'un module le masque ; déconnexion vide les données.
- **PWA :** manifeste valide, SW enregistré, app shell disponible hors ligne (test Playwright en mode offline).
- **Sécurité :** pas de `dangerouslySetInnerHTML` (règle ESLint), CSP compatible, en-tête `X-Requested-With` présent sur toutes les mutations.
- Isolation entre utilisateurs : couverte côté API (PHASE-01) ; l'E2E vérifie l'absence de fuite de cache entre deux comptes sur le même navigateur.

## 9. Découpage en tâches
| Tâche | Intitulé | Dépend de |
|---|---|---|
| T1 | Jetons du design system, Tailwind, thème clair/sombre, typographie | — |
| T2 | Installation et thème des composants shadcn/ui de base | T1 |
| T3 | Composants d'états (§10.3) et `MoneyInput` / `MoneyText` | T2 |
| T4 | i18n (`fr`), formatage de dates selon fuseau | T1 |
| T5 | Registre de navigation, `AppShell`, `BottomNav`, `Sidebar`, `TopBar`, menu Plus, `ModuleGate`, `RoleGate` | T2 |
| T6 | Routage, garde privée via `/me`, gestion globale du 401, page 404 | T5 |
| T7 | Pages d'authentification (inscription, vérification, connexion, oubli, reset, renvoi) | T3, T6 |
| T8 | Paramètres : profil, préférences, modules | T6 |
| T9 | Paramètres sécurité : `ReauthDialog`, changement e-mail et mot de passe, sessions, historique | T8 |
| T10 | Onboarding initial | T8 |
| T11 | Capture rapide en coquille : bouton, raccourci, `QuickCaptureSheet`, registre de types | T5 |
| T12 | PWA : manifeste, icônes, SW, écran hors ligne, mise à jour | T6 |
| T13 | Tests axe-core et E2E Playwright mobile/desktop | T7–T12 |
| T14 | Revues ECC, vérification, rapport | T13 |

## 10. Agents ECC à mobiliser
- `tdd-guide` (composants et gardes).
- `react-reviewer`, `a11y-architect` (**obligatoires**).
- `typescript-reviewer`, `code-reviewer`.
- `e2e-runner` (T13).
- `security-reviewer` (gestion du 401, cache, SW, XSS).

## 11. Definition of Done
- [ ] Parcours complet inscription → onboarding → accueil réalisé en E2E sur mobile et desktop.
- [ ] Tous les composants d'états disponibles et documentés (story ou page de démonstration interne).
- [ ] Navigation conforme à `PRODUCT_SCOPE.md` §5, ADMIN seul voit Dev et Admin.
- [ ] PWA installable (Chrome Android) et app shell hors ligne.
- [ ] Aucune violation axe sérieuse ou critique.
- [ ] Aucun texte en dur hors fichiers de traduction.
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` cochée.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-02-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`).
