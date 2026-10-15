# PHASE-02 : Shell de l'application et design system — rapport

- **Statut :** En cours, quasi terminée (voir §12) ; rien n'est commité (consigne du propriétaire « pas de commit ni push »)
- **Branche :** phase-01/identite-sessions (travail non commité, à reporter sur `phase-02/shell-design-system` au moment des commits)
- **Période :** 13 et 14 octobre 2026 ; sessions IA
- **Commit de merge :** à renseigner

## 1. Résumé

L'application web est utilisable de bout en bout contre l'API de PHASE-01 : inscription, vérification par lien e-mail, connexion, onboarding en trois écrans, accueil provisoire, paramètres (profil, préférences, modules, sécurité avec ré-authentification, sessions, historique) et déconnexion. Le shell mobile-first (barre du bas, menu « Plus ») et desktop (barre latérale) est dérivé d'un registre de navigation déclaratif ; les modules non livrés affichent « Bientôt disponible », les modules désactivés « Ce module est désactivé », la zone ADMIN « Introuvable » pour un USER. La PWA est installable (manifeste, icônes, service worker sans aucun cache d'API, mise à jour sur invite).

## 2. Plan exécuté

| Tâche | État |
|---|---|
| T1 Jetons, thème clair/sombre, typographie | Fait (`tokens.css`, `globals.css`, `theme-init.js`) |
| T2 Composants shadcn/Radix | Fait (Button, Input, Textarea, Label, Card, Dialog, Sheet, DropdownMenu, Select, Switch, Checkbox, Tabs, Tooltip, Badge, Skeleton, Toaster) |
| T3 Composants d'états, `MoneyInput`, `MoneyAmount` | Fait (`components/data-display`, `components/forms`) |
| T4 i18n `fr`, dates selon fuseau | Fait (`lib/i18n`, `lib/dates.ts`) |
| T5 Registre de navigation, shell, `ModuleGate`, `RoleGate` | Fait |
| T6 Routage, gardes via `/me`, 401 global, 404 | Fait |
| T7 Pages d'authentification | Fait |
| T8–T9 Paramètres et sécurité (`ReauthDialog`) | Fait |
| T10 Onboarding | Fait |
| T11 Capture rapide en coquille (bouton +, touche `N`, registre de types) | Fait |
| T12 PWA | Fait (test E2E hors ligne non écrit, voir §12) |
| T13 axe-core et E2E | Fait (parcours auth, onboarding, sécurité, `/admin`) |
| T14 Revues, rapport | Rapport fait ; revues par agents non lancées (voir §10) |

## 3. Fichiers créés ou modifiés

- `apps/web/src/app/` : `guards/`, `navigation/registry.ts`, `session/session.tsx`, `shell/` (AppShell, BottomNav, Sidebar, TopBar, UserMenu, MorePage, ComingSoon, BootScreen), `router.tsx` (401 global), `providers.tsx`, `query-client.ts`.
- `apps/web/src/routes/` : `public.routes.tsx`, `app.routes.tsx`, `lazy-pages.tsx` (pages en `React.lazy`).
- `apps/web/src/features/` : `auth/`, `settings/`, `onboarding/`, `dashboard/`, `capture/`.
- `apps/web/src/components/` : `ui/`, `data-display/` (états, bandeaux, `ConflictDialog`, `MoneyAmount`), `forms/` (`FormField`, `MoneyInput`, erreurs API).
- `apps/web/src/lib/` : `i18n/` (8 espaces de noms), `dates.ts`, `http/api-error-message.ts`, `http/session.api.ts`, `pwa/register-sw.ts`, `query-keys.ts` ; `hooks/` ; `sw.ts` ; `public/icons/*`.
- Lint : règle `WEB_UI` (texte en dur et `dangerouslySetInnerHTML` interdits dans le JSX) dans `packages/config/eslint`.
- E2E : `e2e/helpers/mailpit.ts`, `e2e/tests/phase-02/auth-flow.e2e.ts` ; `playwright.config.ts` (`REGISTRATION_MODE=open` pour l'API de test).

## 4. Modèle de données et migrations

Aucun changement.

## 5. API

Aucun nouvel endpoint ; toutes les routes `/auth/*` et `/me*` de PHASE-01 sont consommées.

## 6. Frontend livré

Routes : `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/confirm-email-change`, `/status`, `/onboarding`, `/`, `/more`, `/settings/{profile,preferences,modules,security}`, une route « Bientôt disponible » par module du registre (gardée par module ou par rôle), `*` (404).

## 7. Décisions techniques

- **Jetons des liens e-mail lus dans le fragment** (`#token=`) puis retirés de l'URL et de l'historique.
- **401 global** : sur toute requête hors pages publiques, `queryClient.clear()` puis `/login?next=…` avec le message « session expirée » ; `next` n'accepte qu'un chemin relatif (anti open-redirect).
- **Ré-authentification** : `useReauth().run(action)` ; sur `REAUTH_REQUIRED`, dialogue de mot de passe puis rejeu unique ; annulation = `ReauthCancelledError`, sans message d'erreur.
- **Requêtes de session hors modules** (`lib/http/session.api.ts`) : les gardes et le shell n'importent plus les pages de paramètres ou d'authentification, chargées en `lazy`.
- **Validation côté client en français** : locale Zod `fr` (`zod/locales`).
- **Dates** : `Intl` seulement (pas de `@date-fns/tz`), le fuseau des préférences fait foi.
- **Icônes PWA** générées par script (PNG sans dépendance).

## 8. Écarts par rapport à la fiche

- `MoneyText` de la fiche s'appelle `MoneyAmount` (nom de `DESIGN_SYSTEM.md` §5.2).
- Composants non livrés : DatePicker, Avatar, Combobox, `ArchivedBanner` avec action « Restaurer » fournie par l'écran (le composant accepte l'action). DatePicker arrivera avec la première saisie de date (PHASE-04/05).
- `theme-init.js` est un fichier statique et non un script inline (CSP `script-src 'self'`).
- Point de rupture desktop à 768 px (`DESIGN_SYSTEM.md` §4.2) et non 1024 px (fiche §3).
- La langue `en` est listée mais désactivée dans les préférences (seul `fr` est livré).
- `formatMoney` groupe les milliers avec U+202F (`Intl` `fr-FR`) alors que `DESIGN_SYSTEM.md` §8.1 demande U+00A0 et un formatage sans `Intl` : à aligner dans `@orbit/money` (PHASE-05 au plus tard).
- **Budget de taille non tenu** : JS initial 232 Ko gzip pour un budget de 170 Ko (`FRONTEND.md` §12). Le découpage par route est fait ; le reste est le socle du shell (react-dom, react-router, zod des contrats, TanStack Query, Radix, i18next). `size-limit` n'est pas encore en CI. Pistes : `zod/mini` pour les schémas lus par le shell, retrait de `tailwind-merge`, chargement différé de Sonner et du Tooltip.

## 9. Tests exécutés (sorties réelles, Windows 11)

- `apps/web` : 100 tests Vitest (unitaires, composants, intégration de l'application complète avec MSW) ; couverture (passage `pnpm ci:local`) lignes 93,75 %, instructions 91,5 %, branches 84,8 %, fonctions 89,9 %.
- `pnpm ci:local` complet (audit, format, lint, types, depcruise, couverture de tous les paquets, architecture, isolation, build, E2E sur base Docker dédiée) : **SUCCÈS** le 14 octobre 2026.
- `pnpm lint` (avec la nouvelle règle `WEB_UI`), `tsc`, `depcruise` (451 modules, 0 violation), `vite build` (service worker et manifeste générés, 24 entrées précachées) : verts.
- E2E Playwright (desktop et mobile, API réelle et Mailpit) : voir §9.1.

### 9.1 E2E

- 8 tests Playwright (desktop Chromium et Pixel 7), API compilée, PostgreSQL et Mailpit locaux : 8 réussis.
  - Inscription → lien Mailpit → vérification → connexion → onboarding → accueil → Paramètres > Sécurité → `/admin` « Introuvable ».
  - Mot de passe oublié → lien Mailpit → nouveau mot de passe → connexion.
  - Identifiants faux → message générique.
  - Fumée PHASE-00 sur `/status`.
- axe-core (WCAG 2.0, 2.1, 2.2 A/AA) sur inscription, connexion, onboarding, accueil et sécurité : aucune violation sérieuse ou critique.
- Premier passage : 2 échecs desktop par délai (connexion encore en cours à 5 s : argon2id réel et workers parallèles) ; attente portée à 15 s après une requête d'authentification, puis tout est vert.
- Non couverts en E2E : révocation d'une session depuis un second navigateur, désactivation d'un module, mode hors ligne (couverts par les tests d'intégration Vitest, sauf le hors ligne).

## 10. Revues ECC

`react-reviewer` (sécurité côté client, correction React, accessibilité) : 0 CRITICAL, 2 HIGH, 6 MEDIUM, 6 LOW. Points vérifiés conformes : service worker sans cache `/api`, client HTTP, vidage du cache à la déconnexion, messages génériques, aucun `dangerouslySetInnerHTML`.

| Constat | Traitement |
|---|---|
| **H** curseur de `MoneyInput` avec un point décimal (« 12. » puis « 5 » donnait 125) | **Corrigé** + test |
| **H** tout 401 (dont `INVALID_CREDENTIALS`) déconnectait | **Corrigé** : seul `UNAUTHENTICATED` déconnecte + test |
| M `ref` écrasée dans `MoneyInput` | **Corrigé** (`useImperativeHandle`) |
| M ré-authentification : promesses orphelines, mot de passe conservé, annulation pendant la vérification, démontage | **Corrigé** (file d'attente partagée, effacement, annulation bloquée pendant la vérification, rejet au démontage) |
| M connexion sans vidage du cache | **Corrigé** |
| M raccourci `N` actif sous un dialogue, rôles de saisie ARIA ignorés | **Corrigé** ; option de désactivation du raccourci (WCAG 2.1.4) **ouverte** pour les préférences |
| M `radiogroup` de capture sans tabindex itinérant ni flèches | **Corrigé** |
| M jeton du fragment : effet de bord dans `useState`, breadcrumbs Sentry | Breadcrumbs **corrigés** ; lecture du jeton dans un loader de route **ouverte** (comportement actuel correct en usage normal) |
| LOW `safeNextPath` (tabulation, retour à la ligne, antislash encodé) | **Corrigé** + tests |
| LOW 401 simultanés | **Corrigé** (une seule redirection) |
| LOW `useOnce`, cibles de 40 et 36 px, `FormField` qui écrase `aria-describedby`, curseur périmé sur caractère refusé | Curseur **corrigé** ; les autres **ouverts** (faible impact) |

`a11y-architect` dédié : non lancé (axe-core en E2E ne relève aucune violation sérieuse ni critique).

## 11. Risques et limitations connus

- Budget JS dépassé (§8).
- PWA non vérifiée en E2E hors ligne (`vite preview` sans proxy `/api`) ; installabilité à vérifier manuellement sur Chrome Android.
- Le raccourci `/` et `Ctrl+K` (recherche) et `G` puis lettre ne sont pas implémentés (recherche en PHASE-07).
- La barre du bas ne se masque pas quand le clavier mobile est ouvert.

## 12. Reste à faire

- Revues `react-reviewer`, `a11y-architect`, `security-reviewer`.
- Test E2E hors ligne de la PWA (servir le build avec proxy) et `size-limit` en CI.
- Commits granulaires sur `phase-02/shell-design-system` dès autorisation.

## 13. Recette manuelle à faire par le propriétaire

1. `pnpm dev` avec `REGISTRATION_MODE=open`, parcours inscription → lien Mailpit → connexion → onboarding sur téléphone (ou mode mobile du navigateur).
2. Basculer le thème depuis le menu du compte ; désactiver Finances dans Paramètres → Modules et vérifier la barre du bas.
3. Construire (`pnpm --filter @orbit/web build`), servir `dist/` derrière un proxy `/api`, installer la PWA sur Chrome Android.

## 14. Point de reprise

Lancer les revues par agents de PHASE-02, puis commiter PHASE-01 (correctifs) et PHASE-02 sur autorisation. Prochaine phase : PHASE-03.

## 15. Confirmation sécurité

- [x] Aucun secret ajouté (clé HMAC E2E fictive, déjà présente).
- [x] Aucune migration.
- [x] Aucun service externe appelé.
