# ORBIT : design system et parcours UX

- **Statut :** référence. Applique ADR-002, ADR-008, ADR-016, ADR-022, ADR-023 et ADR-024 de `DECISIONS.md`, ainsi que `PRODUCT_SCOPE.md` §2 et §5.
- **Responsabilité :** identité visuelle (tokens), composants de base et métier, navigation, états d'interface, formats d'affichage, microcopie, accessibilité, et parcours UX détaillés.
- **Ne couvre pas :** l'architecture du code front (`FRONTEND.md`), les endpoints (`API.md`), les règles de calcul (`FINANCE_RULES.md`).
- **Documents liés :** `DECISIONS.md`, `PRODUCT_SCOPE.md`, `FRONTEND.md`, `FINANCE_RULES.md`, `API.md`, `TESTING.md`.
- **Remplace :** `PRODUCT_SPEC.md` §10.1 (navigation, remplacée par `PRODUCT_SCOPE.md` §5 et la section 4 ci-dessous) ; complète §4.2, §9.3, §10.2 à §10.4.

Les mots **DOIT**, **NE DOIT PAS** et **PEUT** sont prescriptifs.

---

## 1. Principes

| Principe | Ce que cela impose concrètement |
|---|---|
| **Calme** | Fond neutre, une seule couleur d'accent, pas de rouge pour une simple dépense (dépenser n'est pas une erreur). Pas de badge clignotant, pas de compteur anxiogène. Le bloc Alertes du dashboard disparaît quand il est vide. |
| **Dense mais lisible** | Listes à une ligne principale + une ligne secondaire ; hauteur de ligne de liste 56 px sur mobile, 44 px sur desktop. Chiffres alignés (`tabular-nums`). Pas de carte décorative autour de chaque élément. |
| **Mobile-first** | Chaque écran est conçu à 360 px de large d'abord. Actions principales dans la zone du pouce (bas de l'écran). Aucun survol nécessaire pour accéder à une fonction. |
| **Action d'abord** | Chaque écran répond à « que dois-je faire maintenant ? ». Un seul bouton primaire par écran. La capture (+) est accessible partout en un geste. Les états vides proposent l'action qui les remplit. |
| **L'argent est exact** | Un montant affiché vient du serveur. Pas d'optimisme sur les soldes, devise toujours visible, période toujours explicite. |
| **Rien de perdu** | Toute saisie survit à une erreur réseau ; toute action destructive se confirme ou s'annule. |

## 2. Thèmes

- Deux thèmes : **clair** (défaut) et **sombre**, plus « Automatique » (suit `prefers-color-scheme`). Préférence `theme` dans `user_preferences`.
- Implémentation : variables CSS dans `styles/tokens.css`, sélecteur `:root` (clair) et `.dark` sur `<html>` ; Tailwind en `darkMode: 'class'`. Le thème est appliqué avant le premier rendu (script inline dans `index.html`) pour éviter le flash.
- Les composants n'utilisent **que** des tokens sémantiques (`bg-surface`, `text-muted`), jamais une couleur brute.

## 3. Tokens

### 3.1 Couleurs de base

Contrastes calculés (WCAG 2.x) sur `background` / `surface`.

| Token | Usage | Clair | Sombre | Contraste clair | Contraste sombre |
|---|---|---|---|---|---|
| `--background` | Fond de l'application | `#F6F7F9` | `#0E1014` | — | — |
| `--surface` | Cartes, feuilles, dialogues | `#FFFFFF` | `#171A21` | — | — |
| `--surface-muted` | Zones secondaires, ligne survolée | `#EEF0F3` | `#1F232B` | — | — |
| `--foreground` | Texte principal | `#14171C` | `#E9EBEF` | 16,8 / 18,0 | 16,0 / 14,6 |
| `--muted-foreground` | Texte secondaire | `#576070` | `#A3A9B6` | 5,9 / 6,3 | 8,1 / 7,4 |
| `--border` | Séparateurs décoratifs | `#E3E6EB` | `#2A2F3A` | décoratif | décoratif |
| `--input-border` | Bordure des champs (non-texte ≥ 3:1) | `#858D9C` | `#6B7385` | 3,1 / 3,3 | 4,0 / 3,7 |
| `--primary` | Bouton primaire, lien, sélection | `#2B4BC0` | `#93ABFF` | 6,8 / 7,3 | 8,6 / 7,9 |
| `--primary-foreground` | Texte sur `primary` | `#FFFFFF` | `#0E1014` | 7,3 | 8,6 |
| `--ring` | Anneau de focus | `#2B4BC0` | `#93ABFF` | ≥ 3:1 | ≥ 3:1 |
| `--zone-dev` | Accent de la zone Dev (ADMIN) | `#6B3FA0` | `#C3A6F0` | ≥ 4,5:1 | ≥ 4,5:1 |

### 3.2 Couleurs sémantiques

| Token | Usage | Clair (texte) | Clair (fond) | Sombre (texte) | Sombre (fond) |
|---|---|---|---|---|---|
| `--success` | Opération réussie, statut terminé | `#067647` (5,3:1) | `#ECFDF3` | `#5BD39A` (10,2:1) | `#0B2A1C` |
| `--warning` | Échéance proche, non rapproché | `#8A4A00` (6,4:1) | `#FFF7E6` | `#F7C35C` (11,7:1) | `#2E2108` |
| `--danger` | Erreur, retard, action destructive | `#B42318` (6,1:1) | `#FEF3F2` | `#FF8A80` (8,3:1) | `#3A1513` |
| `--info` | Information neutre | `#2B4BC0` | `#EEF2FF` | `#93ABFF` | `#1A2140` |

Texte blanc sur `--danger` (bouton destructif) : 6,6:1.

### 3.3 Couleurs de l'argent (daltonisme)

Le couple entrée/sortie utilise **bleu pétrole / orange brûlé**, distinguable en protanopie, deutéranopie et tritanopie. **La couleur n'est jamais le seul signal** : le signe et l'icône sont obligatoires.

| Token | Sens | Clair | Sombre | Signe | Icône (lucide) |
|---|---|---|---|---|---|
| `--money-in` | Entrée d'argent (INCOME, crédit d'un compte) | `#0B6584` (6,1:1) | `#5EC4E6` (9,5:1) | `+` | `ArrowDownLeft` |
| `--money-out` | Sortie d'argent (EXPENSE, frais, débit) | `#A33B0B` (6,2:1) | `#F4A06A` (9,1:1) | `−` (U+2212) | `ArrowUpRight` |
| `--money-neutral` | Transfert interne, solde | `--foreground` | `--foreground` | aucun | `ArrowLeftRight` (transfert) |

Règles :
- Un **solde** s'affiche en `--foreground`, jamais en vert ou en orange. Un solde négatif (découvert autorisé, H3) s'affiche en `--danger` avec le signe `−` et la mention « découvert ».
- Une **dépense** n'utilise pas `--danger` : le rouge est réservé aux erreurs et aux retards.
- Un **transfert** est neutre ; dans la vue d'un compte, il apparaît en entrée ou en sortie selon le sens pour ce compte.

### 3.4 Typographie

- Police : **Inter** variable, auto-hébergée (sous-ensemble latin + latin étendu pour les accents et `−`, `·`, espaces insécables), `font-display: swap`. Repli : `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Montants et tableaux de chiffres : `font-variant-numeric: tabular-nums` (classe `tabular-nums`).
- Taille de texte des champs ≥ 16 px (évite le zoom automatique d'iOS).

| Token | Taille / interligne | Graisse | Usage |
|---|---|---|---|
| `text-display` | 30 / 36 | 600 | Solde total du bloc Argent |
| `text-h1` | 24 / 32 | 600 | Titre de page |
| `text-h2` | 20 / 28 | 600 | Titre de bloc, de dialogue |
| `text-h3` | 18 / 26 | 600 | Sous-section |
| `text-body` | 16 / 24 | 400 | Texte courant, champs |
| `text-body-strong` | 16 / 24 | 500 | Ligne principale d'une liste, montants |
| `text-small` | 14 / 20 | 400 | Ligne secondaire, aides |
| `text-caption` | 12 / 16 | 500 | Badges, horodatage. Jamais pour une information essentielle. |

### 3.5 Espacements, rayons, ombres

- **Espacements** : base 4 px. Échelle Tailwind standard (`1` = 4 px). Usages : padding de page 16 px (mobile) / 24 px (desktop) ; espace entre blocs 16 px / 24 px ; entre champs de formulaire 16 px ; padding interne de carte 16 px.
- **Rayons** : `--radius-sm` 6 px (badges), `--radius-md` 10 px (boutons, champs), `--radius-lg` 14 px (cartes, dialogues), `--radius-sheet` 20 px (coins hauts des feuilles mobiles), `full` (pastilles, bouton +).
- **Ombres** (clair ; en sombre, remplacées par une bordure `--border` + surface plus claire) :
  - `--shadow-sm` : `0 1px 2px rgb(16 24 40 / 0.06)` — cartes.
  - `--shadow-md` : `0 4px 12px rgb(16 24 40 / 0.10)` — popovers, menus.
  - `--shadow-lg` : `0 12px 32px rgb(16 24 40 / 0.16)` — dialogues, feuilles, bouton +.

### 3.6 Mouvement

| Token | Valeur | Usage |
|---|---|---|
| `--duration-fast` | 120 ms | Survol, pression, bascule |
| `--duration-base` | 200 ms | Apparition de popover, toast |
| `--duration-slow` | 300 ms | Feuille mobile, dialogue |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Entrées |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Sorties |

- Animer uniquement `transform` et `opacity`.
- `prefers-reduced-motion: reduce` : durées ramenées à 0 ms, sauf les fondus d'opacité ≤ 120 ms.
- Aucune animation sur un montant (pas de compteur qui défile).

### 3.7 Points de rupture et couches

| Nom | Largeur | Navigation |
|---|---|---|
| `base` | < 768 px | Barre du bas + menu « Plus » |
| `md` | ≥ 768 px | Barre latérale réduite (icônes + infobulles), bouton + flottant |
| `lg` | ≥ 1024 px | Barre latérale complète (240 px) |
| `xl` | ≥ 1280 px | Contenu centré, largeur max 1200 px |

z-index : `base 0`, `sticky 10`, `nav 20`, `fab 30`, `overlay 40`, `modal 50`, `toast 60`.

## 4. Navigation

### 4.1 Mobile (< 768 px) : barre du bas

Cinq emplacements, hauteur 64 px + `env(safe-area-inset-bottom)` :

| Position | Libellé | Icône | Route |
|---|---|---|---|
| 1 | Accueil | `House` | `/` |
| 2 | Finances | `Wallet` | `/finance` |
| 3 | **+** (capture) | `Plus` dans un cercle `--primary` de 56 px, légèrement surélevé | ouvre `QuickCaptureSheet` |
| 4 | Tâches | `CheckSquare` | `/tasks` |
| 5 | Plus | `Menu` | `/more` |

- Libellés toujours visibles sous les icônes (pas d'icône seule). Onglet actif : icône pleine + texte `--primary` + `aria-current="page"`.
- Le bouton + a `aria-label="Capture rapide"` et une pastille de compte si la file hors ligne n'est pas vide (« 3 en attente »).
- Si le module Finances est désactivé, l'emplacement 2 devient **Idées** ; si Tâches est désactivé, l'emplacement 4 devient **Notes**.
- La barre se masque quand le clavier est ouvert.

**Menu « Plus »** (`/more`), liste groupée, dans cet ordre : Idées · Projets · Notes et documents · Calendrier · Objectifs · Pro · Automatisations · Intégrations · Paramètres ; puis, pour ADMIN uniquement, un groupe séparé **Dev** (Inventaire, Coffre-fort) et **Admin**, marqué de l'accent `--zone-dev` et du badge « ADMIN ». Les modules désactivés (ADR-024) n'apparaissent pas.

### 4.2 Desktop (≥ 768 px) : barre latérale

- Haut : logo ORBIT, champ « Rechercher » (`Ctrl/⌘ K`), bouton « Capture » (`N`).
- Sections : **Accueil** ; **Organisation** (Tâches, Idées, Projets, Notes et documents, Calendrier, Objectifs) ; **Argent** (Finances, Dettes et créances, Pro) ; **Système** (Automatisations, Intégrations, Paramètres) ; **Dev** (ADMIN : Inventaire, Coffre-fort, Admin).
- Pied : avatar, e-mail, bouton « Masquer les soldes » (œil), thème, déconnexion.
- Raccourcis clavier globaux : `N` capture, `/` ou `Ctrl/⌘ K` recherche, `G` puis `A`/`F`/`T`/`I` (Accueil, Finances, Tâches, Idées), `?` aide des raccourcis. Désactivés quand le focus est dans un champ.

### 4.3 En-tête de page (`PageHeader`)

Titre (`h1`), sous-titre facultatif (période, compte), une action primaire à droite (desktop) ou un bouton flottant secondaire (mobile, si l'action n'est pas la capture). Bouton retour sur mobile pour les pages de détail.

## 5. Composants

### 5.1 Composants de base (`components/ui`, shadcn/Radix)

Button (variantes `primary`, `secondary`, `ghost`, `destructive`, `link` ; tailles `sm` 36 px, `md` 44 px, `lg` 52 px ; état `loading`), Input, Textarea, Select, Combobox (Command), Checkbox, Switch, RadioGroup, SegmentedControl (ToggleGroup), Dialog, AlertDialog, Sheet (bas sur mobile, droite sur desktop), Drawer, Popover, DropdownMenu, Tooltip (jamais seul porteur d'information), Tabs, Badge, Avatar, Skeleton, Toast (Sonner), Progress, Separator, ScrollArea.

Règles communes : hauteur tactile ≥ 44 px, focus visible (`--ring`, 2 px + décalage 2 px), état désactivé avec raison accessible (texte ou `aria-describedby`), pas de bouton-icône sans `aria-label`.

### 5.2 `MoneyAmount`

Affiche un montant. **Seul** composant autorisé à afficher de l'argent.

| Prop | Type | Défaut | Effet |
|---|---|---|---|
| `minor` | `string` | — | Montant en unités mineures (chaîne de l'API) |
| `currency` | `CurrencyCode` | — | Devise ISO 4217 |
| `kind` | `'balance' \| 'in' \| 'out' \| 'neutral'` | `'neutral'` | Couleur, signe et icône (§3.3) |
| `size` | `'sm' \| 'md' \| 'lg' \| 'display'` | `'md'` | Taille typographique |
| `sensitive` | `boolean` | `true` pour `balance`, sinon `false` | Soumis au mode « masquer les soldes » |
| `pending` | `boolean` | `false` | Mutation en cours : montant à 50 % d'opacité + spinner 12 px + texte SR « mise à jour » |
| `showIcon` | `boolean` | `true` pour `in`/`out` | Icône de sens |

- Formatage via `formatMoney` de `@orbit/money` (§8.1).
- **Mode « masquer les soldes »** : bascule globale (icône œil dans le bloc Argent, la page Finances et l'en-tête desktop). Quand il est actif, tout `MoneyAmount` `sensitive` affiche `•••••• FCFA` (devise conservée), avec `aria-label="Montant masqué"`. Un appui long (mobile) ou un clic sur le montant le révèle 5 s. Les montants saisis dans un formulaire en cours ne sont pas masqués. Les montants des toasts sont masqués si le mode est actif.
- Accessibilité : le texte lu par les lecteurs d'écran est complet, ex. « sortie, 5 000 francs CFA » (via `aria-label`, avec `−` remplacé par « sortie » ou « moins »).

### 5.3 `MoneyInput`

- `inputMode="numeric"` (XOF) ou `decimal` (devises à exposant 2), `enterKeyHint="next"`.
- Affiche les groupes de milliers pendant la frappe (`1 250 000`) tout en conservant une valeur interne de chiffres ; le curseur reste à la bonne position.
- Suffixe de devise non éditable à droite (« FCFA »).
- Collage : supprime espaces, points et « FCFA » ; refuse les lettres avec un message.
- Raccourcis de saisie : chips facultatives « +1 000 », « +5 000 », « +10 000 » sous le champ dans la capture rapide.
- Erreurs : « Saisissez un montant », « Le montant doit être supérieur à 0 », « Le FCFA n'a pas de centimes », « Montant trop élevé ».

### 5.4 `AccountPicker`

- Liste des comptes actifs : icône par type (Espèces `Banknote`, Mobile money logo générique `Smartphone` + nom du fournisseur, Banque `Landmark`, autre `Wallet`), nom, solde (`MoneyAmount` `sensitive`), devise.
- Mobile : `Sheet` avec la liste ; desktop : `Combobox` filtrable.
- Ordre : compte par défaut, puis les plus utilisés dans les 30 derniers jours, puis alphabétique. Comptes archivés exclus (accessibles via « Afficher les comptes archivés » uniquement en consultation).
- Props : `value`, `onChange`, `currency?` (filtre), `exclude?` (pour l'autre côté d'un transfert), `showBalance` (défaut `true`).
- État vide : « Aucun compte. Créer un compte » (ouvre le formulaire de compte en feuille).

### 5.5 `CategoryPicker`

- Filtré par sens (`EXPENSE` ou `INCOME`). Grille de chips (icône + libellé) sur mobile, 8 catégories les plus utilisées d'abord + « Toutes les catégories » ; `Combobox` sur desktop.
- Création à la volée : « Créer « Pharmacie » » en dernière option de la recherche.
- Catégories système non supprimables : « Frais mobile money », « Ajustement de solde », « Remboursement de dette ».

### 5.6 `QuickCaptureSheet`

- Mobile : `Sheet` du bas, hauteur automatique (≈ 40 % de l'écran au repos), coins `--radius-sheet`, poignée de glissement ; desktop : `Dialog` centré de 560 px, ouvert par `N`.
- Contenu : un champ texte multiligne (autofocus, `enterKeyHint="send"`), une **ligne d'aperçu** de l'interprétation, des chips de type (Idée · Tâche · Note · Dépense · Entrée), le bouton « Enregistrer ».
- Comportement : §11.1.

### 5.7 `EmptyState`

Icône (48 px, `--muted-foreground`), titre (une phrase), explication (une phrase, facultative), **une** action principale. Variante `compact` pour l'intérieur d'un bloc du dashboard. Exemple : « Aucune dépense ce mois-ci » / « Ajoutez votre première dépense pour suivre votre budget. » / [Ajouter une dépense].

### 5.8 `ErrorState`

Variantes : `network` (« Pas de connexion internet »), `server` (« ORBIT rencontre un problème »), `forbidden` (« Vous n'avez pas accès à cette page »), `not-found` (« Élément introuvable »), `module-disabled`. Toujours : une action (Réessayer, Retour à l'accueil, Ouvrir les paramètres) ; pour `server`, la référence `requestId` en `text-caption`. Variante `inline` pour un bloc isolé.

### 5.9 `ConfirmDialog`

- Basé sur `AlertDialog` Radix. Titre = question précise (« Annuler cette dépense de 5 000 FCFA ? »), description = conséquence (« Elle sera marquée comme annulée et le solde de Wave sera recalculé. L'historique est conservé. »), boutons « Retour » (focus par défaut) et action nommée par son verbe (« Annuler la dépense »), variante `destructive` si irréversible.
- Variante `typed` pour les actions irréversibles majeures (suppression du compte utilisateur, révocation de toutes les sessions) : saisir un mot (« SUPPRIMER »).
- Préférer **Annuler a posteriori** (toast) à la confirmation pour les actions réversibles (archiver, changer un statut).

### 5.10 `DataList` (mobile) et `DataTable` (desktop)

- Un même composant `ResponsiveCollection` rend `DataList` sous 768 px et `DataTable` au-dessus, à partir d'une définition de colonnes unique (`primary`, `secondary`, `amount`, `meta`, `actions`).
- `DataList` : ligne de 56 px minimum ; à gauche icône/avatar, au centre ligne principale + secondaire (tronquées sur une ligne), à droite montant ou badge. Regroupement par jour pour les opérations (« Aujourd'hui », « Hier », « Lundi 6 octobre »), avec le total du jour en `text-small`.
- Actions de ligne : menu `⋯` (toujours présent) ; le balayage (swipe) PEUT doubler une action, jamais la remplacer.
- `DataTable` : en-têtes triables (`aria-sort`), colonne montant alignée à droite, ligne cliquable entière + lien réel sur la cellule principale, sélection multiple par cases à cocher, barre d'actions groupées.
- Pagination : « Charger plus » (bouton, pas de défilement infini qui masquerait le pied de page) ; nombre total affiché si fourni.
- États : `Skeleton` de 6 lignes, `EmptyState`, `ErrorState inline`.

### 5.11 `StatusBadge`

Texte toujours présent ; couleur = renfort. Correspondances :

| Domaine | Statut | Libellé | Ton |
|---|---|---|---|
| Idée | `INBOX` | À trier | `info` |
| | `TO_REVIEW` | À examiner | `neutral` |
| | `EVALUATED` | Évaluée | `neutral` |
| | `SELECTED` | Retenue | `info` |
| | `IN_PROGRESS` | En cours | `info` |
| | `REALIZED` | Réalisée | `success` |
| | `ABANDONED` | Abandonnée | `muted` |
| Transaction | `PENDING` | En attente | `warning` |
| | `VALIDATED` | (pas de badge) | — |
| | `CANCELLED` | Annulée | `muted` + montant barré |
| Dette | `OPEN` | Ouverte | `neutral` |
| | `PARTIALLY_PAID` | Partiellement réglée | `info` |
| | `PAID` | Soldée | `success` |
| | en retard (dérivé, ADR-020) | En retard | `danger` + icône `AlertTriangle` |
| | `CANCELLED` / `WRITTEN_OFF` | Annulée / Radiée | `muted` |
| Compte | non rapproché > 30 j | À rapprocher | `warning` |
| Tout élément | archivé | Archivé | `muted` + icône `Archive` |

Les enums exacts viennent de `@orbit/contracts` ; ce tableau fixe libellés et tons.

### 5.12 `DateInput`

- Champ texte masqué `jj/mm/aaaa` (`inputMode="numeric"`, insertion automatique des `/`) + bouton calendrier ouvrant un `Popover` (`Calendar` shadcn, semaine commençant le lundi, libellés français).
- Chips de raccourci : « Aujourd'hui », « Hier » (dates d'opération) ; « Demain », « Dans 1 semaine » (échéances).
- Valeur : `CivilDate` (`YYYY-MM-DD`), « aujourd'hui » calculé dans le fuseau de l'utilisateur (`FRONTEND.md` §8).
- Erreurs : « Date invalide », « La date ne peut pas être dans le futur » (opérations réalisées), « L'échéance doit suivre la date d'ouverture ».
- `DateTimeInput` (rendez-vous, rappels) : `DateInput` + champ heure `HH:mm` sur 24 h.

### 5.13 Autres composants métier

`TransactionRow`, `AccountCard` (nom, type, solde, badge « À rapprocher »), `DashboardBlock` (titre, période, lien « Voir », contenu, états), `FeeLine` (ligne de frais modifiable, §11.2), `TransferPreview` (§11.3), `ReauthDialog` (mot de passe, `FRONTEND.md` §3.4), `OfflineBanner`, `SyncQueueBadge`, `InstallPrompt`, `ZoneDevHeader`.

## 6. États d'interface obligatoires

Chaque page et chaque bloc autonome DOIT implémenter ces états (`PRODUCT_SPEC.md` §10.3). La fiche de phase liste les écrans ; les tests de composant vérifient chaque état.

| État | Rendu | Microcopie type |
|---|---|---|
| Chargement | `Skeleton` à la forme du contenu, après 150 ms seulement (pas de clignotement) ; au-delà de 10 s, texte « Toujours en cours… » | — |
| Liste vide | `EmptyState` avec action | « Aucune tâche pour aujourd'hui. » [Ajouter une tâche] |
| Résultat de filtre vide | `EmptyState` compact + « Effacer les filtres » | « Aucun résultat pour ces filtres. » |
| Erreur réseau | `ErrorState network` ; données en cache affichées si disponibles avec bandeau | « Pas de connexion. Les données affichées datent de 10 h 42. » |
| Erreur de validation | Message sous le champ (`--danger`, icône), résumé en haut si ≥ 3 erreurs, focus sur le premier champ | « Saisissez un montant. » |
| Accès refusé | `ErrorState forbidden` (ou « Introuvable » pour la zone Dev) | « Vous n'avez pas accès à cette page. » |
| Élément archivé | Bandeau `muted` en haut du détail, champs en lecture seule, action « Restaurer » | « Ce compte est archivé. Il reste visible dans l'historique. » |
| Succès | Toast (§7) ; pas de page de succès | « Tâche créée. » |
| Conflit de modification | Dialogue : « Cet élément a été modifié ailleurs. » [Voir la version actuelle] [Écraser avec mes changements] — **jamais** « Écraser » pour une donnée financière (rechargement obligatoire) | |
| Données périmées / synchronisation | Bandeau discret `OfflineBanner` ou indicateur « Mise à jour… » ; `MoneyAmount pending` | « Synchronisation en cours… » |
| Hors ligne (finance) | Boutons de création financière désactivés avec raison | « Connexion requise pour enregistrer une opération. » |

## 7. Retours d'action (toasts et confirmations)

- Toast en bas de l'écran (au-dessus de la barre du bas sur mobile), en haut à droite sur desktop. Un seul toast visible à la fois ; les suivants remplacent le précédent.
- Durées : succès simple 4 s ; succès avec « Annuler » 8 s ; erreur : reste jusqu'à fermeture.
- « Annuler » est un vrai bouton (focusable, `Alt+Z` sur desktop).
- Sémantique de « Annuler » : idée/tâche/note → suppression de l'élément créé ; transaction/transfert → **annulation auditée** (statut annulé, `FRONTEND.md` §17 F1), jamais une suppression silencieuse.
- Actions destructives : `ConfirmDialog` (§5.9) si irréversible, toast « Annuler » sinon.

## 8. Formats d'affichage

### 8.1 Argent

- Format : **`1 250 000 FCFA`** — chiffres groupés par 3, séparateur de milliers **U+00A0** (espace insécable), puis **U+00A0**, puis le symbole de la table `currencies`.
- XOF : jamais de décimale. EUR : `1 250,50 €` (virgule décimale, 2 décimales). USD : `1 250,50 $US`.
- Signe : `+` pour une entrée, `−` (U+2212, pas le tiret) pour une sortie, collé au nombre : `−5 000 FCFA`.
- Abréviation (cartes compactes uniquement, jamais dans un formulaire ou un détail) : `1,25 M FCFA`, `250 k FCFA` ; valeur complète en infobulle et pour les lecteurs d'écran.
- Le formatage est fait par `@orbit/money` (implémentation propre, sans `Intl`, pour un résultat identique sur tous les navigateurs et dans les exports). Tests de non-régression : `"0"`, `"5000"`, `"1250000"`, `"999999999999"`.
- Plusieurs devises : jamais additionnées sans conversion explicite ; le solde total est affiché **par devise** (« 1 250 000 FCFA · 320,00 € »).

### 8.2 Dates et heures

| Cas | Format | Exemple |
|---|---|---|
| Date complète | `jj/mm/aaaa` | `11/10/2026` |
| Date dans une liste (année courante) | jour + mois abrégé | `11 oct.` |
| Relative (≤ 1 jour d'écart) | Aujourd'hui · Hier · Demain | `Hier` |
| Heure | `HH:mm`, 24 h | `14:05` |
| Date et heure | `jj/mm/aaaa à HH:mm` | `11/10/2026 à 14:05` |
| Période | `du jj/mm au jj/mm/aaaa` | `du 01/10 au 31/10/2026` |
| Mois | Mois en toutes lettres + année | `Octobre 2026` |

Tous les calculs de « aujourd'hui » utilisent le fuseau de l'utilisateur (`Africa/Dakar` par défaut).

### 8.3 Nombres et texte

- Nombres non monétaires : mêmes séparateurs que l'argent (`12 500`), décimales avec virgule (`2,5`).
- Pourcentages : `12 %` (espace insécable avant `%`).
- Ponctuation française : espace insécable avant `:`, `;`, `?`, `!` et à l'intérieur des guillemets « ».

## 9. Accessibilité (WCAG 2.2 AA)

| Exigence | Règle ORBIT | Vérification |
|---|---|---|
| Contraste texte (1.4.3) | ≥ 4,5:1 (texte normal), ≥ 3:1 (≥ 24 px ou 19 px gras). Les tokens §3 sont conformes ; toute nouvelle couleur doit être recalculée. | Test unitaire sur les paires de tokens + axe |
| Contraste non-texte (1.4.11) | Bordures de champs, icônes porteuses de sens, anneau de focus ≥ 3:1 | Tokens `--input-border`, `--ring` |
| Couleur seule (1.4.1) | Jamais : signe + icône pour l'argent, texte pour les statuts, icône + texte pour les erreurs | Revue de composant |
| Taille des cibles (2.5.8) | **44 × 44 px minimum** pour toute cible tactile (au-delà du minimum AA de 24 px) ; espacement ≥ 8 px entre cibles adjacentes | Test Playwright sur la barre du bas, les listes, la capture |
| Focus visible (2.4.7, 2.4.11) | Anneau 2 px `--ring` + décalage 2 px, jamais masqué par la barre du bas ou un en-tête collant (`scroll-padding`) | axe + revue |
| Clavier (2.1.1) | Tout est utilisable au clavier ; ordre de tabulation = ordre visuel ; `Échap` ferme dialogues, feuilles et menus ; focus rendu à l'élément déclencheur à la fermeture | E2E clavier par parcours |
| Glisser (2.5.7) | Tout balayage ou glisser-déposer a une alternative par bouton | Revue |
| Noms et rôles (4.1.2) | Primitives Radix ; boutons-icônes avec `aria-label` ; `aria-current` pour la navigation ; `aria-invalid` + `aria-describedby` pour les champs en erreur | `jsx-a11y` + axe |
| Messages d'état (4.1.3) | Toasts et « 3 en attente » dans une région `aria-live` | Testing Library |
| Redimensionnement (1.4.4, 1.4.10) | Zoom 200 % et largeur 320 px sans défilement horizontal | Playwright |
| Aide cohérente (3.2.6) | Lien « Aide » au même endroit (menu Plus / pied de sidebar) | Revue |
| Authentification accessible (3.3.8) | Collage autorisé dans les champs de mot de passe, gestionnaires de mots de passe compatibles (`autocomplete`), pas de test cognitif | E2E |
| Saisie redondante (3.3.7) | Les informations déjà saisies dans un parcours (onboarding, transfert) sont reprises, jamais redemandées | Revue |
| Langue (3.1.1) | `<html lang="fr">` | Test |

## 10. Microcopie

### 10.1 Ton

- **Vouvoiement**, phrases courtes, verbes d'action. Neutre et calme : pas de point d'exclamation, pas d'emoji, pas de culpabilisation (« Vous avez trop dépensé » est interdit ; préférer « Dépenses d'octobre : 182 000 FCFA, contre 150 000 FCFA en septembre »).
- Boutons : verbe à l'infinitif décrivant le résultat (« Enregistrer la dépense », « Créer le compte »), jamais « OK » ou « Valider » seul.
- Vocabulaire fixe : **entrée** / **sortie** (ou **dépense**), **compte**, **transfert**, **frais**, **solde**, **dette** (je dois) / **créance** (on me doit), **idée**, **tâche**, **à trier** (INBOX). Mobile money : on écrit le nom de l'opérateur (Wave, Orange Money, Free Money).

### 10.2 Messages d'erreur

Structure : ce qui s'est passé + ce que l'utilisateur peut faire. Jamais de code technique, de trace ou de message brut de l'API.

| Code (`errors.<CODE>`) | Message |
|---|---|
| `NETWORK_ERROR` (client) | Pas de connexion internet. Vérifiez votre réseau et réessayez. |
| `INTERNAL_ERROR` | ORBIT rencontre un problème. Réessayez dans un instant. |
| `VALIDATION_FAILED` | Certains champs sont à corriger. |
| `UNAUTHENTICATED` | Votre session a expiré. Reconnectez-vous. |
| `INVALID_CREDENTIALS` | E-mail ou mot de passe incorrect. |
| `REAUTH_REQUIRED` | Pour continuer, confirmez votre mot de passe. |
| `NOT_FOUND` | Cet élément est introuvable. Il a peut-être été supprimé. |
| `RATE_LIMITED` | Trop de tentatives. Réessayez dans {{seconds}} secondes. |
| `INSUFFICIENT_FUNDS` | Solde {{account}} insuffisant (disponible : {{available}}). |
| `DUPLICATE_EXTERNAL_REFERENCE` | Cette opération {{provider}} est déjà enregistrée ({{date}}, {{amount}}). |
| `SAME_ACCOUNT_TRANSFER` | Choisissez deux comptes différents. |
| `CURRENCY_MISMATCH` | Ces comptes n'ont pas la même devise. Indiquez le montant reçu. |
| `CONFLICT_STALE_VERSION` | Cet élément a été modifié ailleurs. Rechargez pour voir la dernière version. |
| `MODULE_DISABLED` | Ce module est désactivé. Vous pouvez le réactiver dans les paramètres. |

La liste exhaustive des codes est l'enum de `@orbit/contracts` ; ce tableau fixe le ton et les cas principaux.

## 11. Parcours UX détaillés

Chaque parcours a un test E2E Playwright (projet `mobile`) qui suit exactement les étapes numérotées.

### 11.1 Capture rapide (< 5 s)

**Objectif :** de l'appui sur + à l'enregistrement en moins de 5 s pour « 5000 taxi wave ».

**Étapes :**
1. L'utilisateur appuie sur **+** (barre du bas) ou `N` (desktop), ou ouvre le raccourci « Dépense » / « Idée » de l'icône PWA.
2. `QuickCaptureSheet` s'ouvre en ≤ 300 ms, champ focalisé, clavier ouvert.
3. Il tape `5000 taxi wave`. À chaque frappe (anti-rebond 100 ms), le parseur local met à jour la **ligne d'aperçu** :
   `Dépense · −5 000 FCFA · Transport · Wave · Aujourd'hui`
   Chaque élément de l'aperçu est un chip modifiable (appui → `MoneyInput`, `CategoryPicker`, `AccountPicker`, `DateInput`).
4. Il appuie sur **Enregistrer** (ou `Entrée`).
5. Envoi `POST /api/v1/finance/transactions` avec `Idempotency-Key`. Le bouton passe en `loading` ; la feuille reste ouverte jusqu'à la réponse.
6. Succès : la feuille se ferme, toast 8 s : « Dépense enregistrée · −5 000 FCFA · Wave » [Annuler]. Les soldes sont rechargés depuis le serveur.
7. « Annuler » → annulation auditée de la transaction, toast « Dépense annulée ».

**Règles du parseur local** (`features/capture/lib/parse-capture.ts`, pur, sans réseau) :
- Normalisation : minuscules, accents retirés pour la comparaison, espaces multiples réduits.
- **Montant** : premier nombre reconnu — `5000`, `5 000`, `5.000`, `5k` / `5K` (× 1 000), `2,5k` (= 2 500) ; suffixes ignorés : `f`, `fr`, `frs`, `fcfa`, `cfa`. Un nombre collé à une unité non monétaire (`2h`, `3x`, `10kg`, `15min`) n'est **pas** un montant.
- **Sens** : sortie par défaut ; entrée si le texte commence par `+` ou contient `reçu`, `recu`, `salaire`, `paiement reçu`, `remboursé par`.
- **Compte** : correspondance avec les alias `wave` → compte du fournisseur Wave ; `om`, `orange`, `orange money` → Orange Money ; `free`, `free money` → Free Money ; `cash`, `espèces`, `especes`, `liquide`, `main` → compte de type CASH ; puis le nom exact d'un compte de l'utilisateur. Plusieurs comptes candidats → chip « Compte ? » à choisir. Aucun → compte par défaut (`preferences.defaultAccountId`), sinon chip « Compte ? ».
- **Catégorie** : dictionnaire de mots-clés versionné (`taxi`, `clando`, `bus`, `ddd`, `tata`, `brt`, `ter`, `yango`, `heetch`, `essence`, `carburant` → Transport ; `repas`, `déjeuner`, `dej`, `dîner`, `petit-déj`, `riz`, `pain`, `marché`, `boutique` → Alimentation ; `loyer` → Logement ; `pharmacie`, `médicament`, `hôpital` → Santé ; `netflix`, `spotify`, `abonnement` → Abonnement ; etc.), puis correspondance avec le nom d'une catégorie de l'utilisateur. Aucun mot-clé → « Autre dépense » / « Autre entrée », chip mis en évidence.
- **Date** : `hier` → veille, `avant-hier` → l'avant-veille, sinon aujourd'hui (fuseau utilisateur).
- **Description** : les mots restants (`taxi`), première lettre en majuscule.
- **Sans montant** → **idée**, statut `INBOX`, titre = texte saisi (`POST /api/v1/ideas`). Toast « Idée ajoutée à trier » [Annuler].
- Préfixes explicites : `t:` ou `tâche:` → tâche ; `n:` ou `note:` → note ; `i:` → idée même si un nombre est présent (ex. « i: 3 idées de vidéo »).
- Les chips de type au-dessus du champ **forcent** l'interprétation ; un raccourci PWA présélectionne le chip.

**Règles de l'écran :**
- Une transaction exige montant, compte, date, sens et catégorie (`PRODUCT_SPEC.md` §10.2) ; s'il en manque un, le bouton devient « Compléter » et met le chip manquant en évidence, sans erreur rouge.
- `INSUFFICIENT_FUNDS` → la feuille reste ouverte, message sous l'aperçu, chip Compte mis en évidence.
- **Hors ligne** : l'aperçu reste calculé, mais une transaction ne peut pas être enregistrée. Bouton « Garder comme idée à traiter » (idée INBOX avec le texte brut, mise en file hors ligne) + mention « Les opérations d'argent nécessitent une connexion. » Idées, tâches et notes sont mises en file normalement : toast « Enregistré sur l'appareil · sera envoyé dès le retour du réseau ».
- Le texte saisi n'est jamais perdu : en cas d'erreur, il reste dans le champ ; fermer la feuille avec du texte non enregistré demande « Abandonner cette saisie ? ».
- Le compte et la catégorie choisis manuellement pour un mot-clé ne sont pas mémorisés automatiquement dans cette version (voir §12).

### 11.2 Saisie d'une transaction mobile money (formulaire complet)

Route `/finance/transactions/new` (ou « Compléter » depuis la capture).

1. **Sens** : `SegmentedControl` Dépense / Entrée.
2. **Montant** : `MoneyInput` (ex. `10 000`).
3. **Compte** : `AccountPicker` → Wave. Si le compte est de type `MOBILE_MONEY`, la section « Mobile money » apparaît.
4. **Nature de l'opération** (mobile money uniquement) : Paiement marchand · Envoi à une personne · Réception. (« Retrait » et « Dépôt » redirigent vers le transfert, §11.3.)
5. **Frais** : `FeeLine` affiche les frais **pré-calculés** selon la grille du compte (`feePolicy` fournie par l'API, `FRONTEND.md` §17 F3) pour le fournisseur, la nature et le montant : « Frais : 100 FCFA · calculés selon la grille Wave » [Modifier]. Modifier ouvre un `MoneyInput` (0 autorisé, « Sans frais ») et remplace la mention par « saisis manuellement ». Les frais sont recalculés quand le montant change, sauf s'ils ont été modifiés à la main.
6. **Récapitulatif** sous les frais : « Total débité de Wave : −10 100 FCFA ».
7. **Catégorie**, **date** (`DateInput`, défaut aujourd'hui), **contrepartie** (facultative, saisie libre avec suggestions), **description**.
8. **ID de transaction de l'opérateur** (facultatif mais recommandé) : champ « ID de transaction Wave », aide « Visible dans le reçu de l'application Wave ou dans le SMS. », collage accepté, espaces retirés.
9. **Enregistrer la dépense** → `POST /api/v1/finance/transactions` (avec `Idempotency-Key`). Le serveur crée la dépense et la dépense de frais séparée liée (`parent_transaction_id`, catégorie « Frais mobile money »).
10. Toast « Dépense enregistrée · −10 100 FCFA (dont 100 FCFA de frais) · Wave » [Annuler] ; retour à l'écran précédent.

**Règles :**
- L'ID opérateur est l'**anti-doublon** : unique par compte. `409 DUPLICATE_EXTERNAL_REFERENCE` → erreur sous le champ avec la date et le montant de l'opération existante + lien « Voir l'opération ». Aucune option « enregistrer quand même ».
- Sans ID opérateur, un avertissement non bloquant apparaît si une opération du même compte, même montant et même jour existe déjà : « Une dépense de 10 000 FCFA sur Wave existe déjà aujourd'hui. Continuer ? ».
- Les frais sont toujours une ligne séparée dans l'historique (affichée indentée sous l'opération parente, catégorie « Frais mobile money »).
- Une entrée (Réception) n'a pas de frais par défaut ; la ligne de frais reste disponible (« Ajouter des frais »).

### 11.3 Transfert (ex. retrait Wave → Espèces)

Route `/finance/transfers/new`. Raccourcis en haut : chips **Retrait** (mobile money → espèces), **Dépôt** (espèces → mobile money), **Entre comptes**.

1. Chip **Retrait** : « De » est pré-rempli avec le compte mobile money par défaut (Wave), « Vers » avec le compte Espèces.
2. **Montant** : `20 000`.
3. **Frais** : `FeeLine` pré-calculée selon la grille de retrait (ex. 200 FCFA), modifiable ; « Frais payés par : compte d'origine » (seule option dans cette version).
4. **Aperçu** (`TransferPreview`), mis à jour en direct :
   - `Wave        −20 200 FCFA  (dont 200 FCFA de frais)`
   - `Espèces     +20 000 FCFA`
   - Chaque ligne montre aussi le solde après opération **à titre indicatif**, étiqueté « solde estimé », calculé avec `@orbit/money` à partir du dernier solde serveur.
5. Date, ID opérateur (facultatif, même règle anti-doublon), note.
6. **Enregistrer le transfert** → `POST /api/v1/finance/transfers` (`Idempotency-Key`). Le serveur crée le transfert (2 écritures) et la dépense de frais liée.
7. Toast « Transfert enregistré · Wave → Espèces · 20 000 FCFA » [Annuler].

**Règles :**
- Bouton ⇅ pour inverser les comptes. « Vers » exclut le compte « De » (`AccountPicker exclude`).
- Un transfert n'est **ni** une dépense **ni** une entrée : il n'apparaît pas dans les totaux de dépenses ; seuls les frais y apparaissent.
- Devises différentes : champ supplémentaire « Montant reçu » obligatoire, taux affiché en lecture (« 1 € = 655,957 FCFA ») ; pas de conversion automatique silencieuse.
- Découvert refusé par défaut (H3) : `INSUFFICIENT_FUNDS` affiche le solde disponible de Wave et propose de corriger le montant.

### 11.4 Dashboard « centre d'attention »

Route `/`. Données : `GET /api/v1/dashboard` (un appel, blocs indépendants ; un bloc en erreur affiche `ErrorState inline` sans casser les autres). Les blocs s'étendent à chaque phase (`PRODUCT_SCOPE.md` §4).

**Ordre** (mobile : une colonne dans cet ordre ; desktop ≥ 1024 px : deux colonnes, Maintenant + 7 prochains jours à gauche, Argent + À trier + Alertes à droite) :

1. **Maintenant** — « Aujourd'hui, samedi 11 octobre ».
   - Tâches dues aujourd'hui et en retard (max 5, retard en premier, badge « En retard »), case à cocher directe (optimiste autorisé).
   - Prochain rendez-vous du jour (dès PHASE-09).
   - Vide : « Rien d'urgent aujourd'hui. » [Ajouter une tâche].
2. **Argent** — période explicite « Octobre 2026 · du 01/10 au 11/10 ».
   - Solde total **par devise** (`MoneyAmount size="display" kind="balance"`), bouton œil (mode masqué).
   - Soldes des 4 comptes principaux (`AccountCard` compacte), lien « Tous les comptes ».
   - « Sorties ce mois-ci » et « Entrées ce mois-ci » (hors transferts).
   - Boutons rapides : [Dépense] [Transfert].
   - Pas d'optimisme : après une saisie, le bloc affiche « Mise à jour… » jusqu'au retour serveur.
   - Vide (aucun compte) : « Ajoutez vos comptes pour suivre votre argent. » [Ajouter un compte].
3. **7 prochains jours** — liste groupée par jour : échéances de dettes et créances, opérations récurrentes prévues (avec montant estimé, libellé « prévu »), tâches avec échéance, rendez-vous, puis factures (PHASE-10) et renouvellements de domaines (ADMIN, PHASE-12).
   - Vide : « Rien de prévu cette semaine. »
4. **À trier** — nombre d'idées en `INBOX` + les 3 plus récentes, bouton [Trier (12)] → `/ideas/inbox` ; captures hors ligne en échec (« 1 capture n'a pas pu être envoyée » [Voir]).
   - Vide : « Tout est trié. »
5. **Alertes** — dettes en retard, comptes non rapprochés depuis plus de 30 jours, synchronisations ou automatisations en échec (PHASE-14/15), solde négatif. Chaque alerte : icône + phrase + action (« Rapprocher Wave »). **Bloc masqué s'il est vide.** Si une alerte est de gravité haute (retard de dette, solde négatif), un bandeau d'une ligne apparaît en haut du dashboard et renvoie au bloc.

**Règles :** chaque bloc a un titre `h2`, un lien « Voir » vers le détail, ses propres états (§6). Pas de graphique sur le dashboard mobile (lisibilité) ; un mini-graphique de tendance PEUT apparaître sur desktop (PHASE-07). Rafraîchissement : à l'ouverture, au retour au premier plan, après toute mutation (invalidation `dashboardKeys`).

### 11.5 Rapprochement du solde avec l'application de l'opérateur

Route `/finance/accounts/:id/reconcile`, accessible depuis la fiche du compte (« Rapprocher ») et depuis l'alerte « À rapprocher ».

1. L'écran affiche le **solde ORBIT** du compte (serveur) à la date et l'heure courantes.
2. Champ « Solde affiché dans l'application Wave » (`MoneyInput`), aide « Ouvrez Wave et recopiez le solde affiché. ».
3. Calcul de l'écart (`@orbit/money`) : solde déclaré − solde ORBIT, affiché en direct.
4. **Écart nul** : message « Votre compte Wave est à jour. » → [Confirmer] enregistre le rapprochement (date) ; le badge « À rapprocher » disparaît.
5. **Écart non nul** : « Écart de −3 500 FCFA (ORBIT indique plus que Wave). » Deux choix :
   - **Chercher les opérations manquantes** (recommandé, en premier) : liste des 10 dernières opérations du compte + [Ajouter une opération] (ouvre §11.2 avec le compte pré-rempli). Au retour, l'écart est recalculé.
   - **Créer un ajustement** : `ConfirmDialog` « Créer un ajustement de −3 500 FCFA sur Wave ? » avec champ **motif obligatoire** (ex. « Frais non enregistrés »). Crée une transaction `ADJUSTMENT` catégorie « Ajustement de solde », auditée.
6. Toast « Wave rapproché · solde 46 500 FCFA ».

**Règles :** le solde initial n'est **jamais** modifié pour corriger un écart (`PRODUCT_SPEC.md` §4.9) ; un ajustement est une transaction visible dans l'historique avec son badge « Ajustement ». Le rapprochement nécessite une connexion. Les comptes non rapprochés depuis 30 jours portent le badge « À rapprocher » (seuil configurable plus tard).

### 11.6 Onboarding du premier lancement (< 3 min)

Route `/onboarding`, déclenchée tant que `onboardingCompletedAt` est nul. Barre de progression « Étape 2 sur 5 ». Chaque étape a « Passer » ; chaque étape validée est enregistrée immédiatement (reprise possible après fermeture).

1. **Bienvenue et région** (≈ 20 s) — « Bienvenue sur ORBIT. Réglons l'essentiel en 3 minutes. » Fuseau pré-rempli (`Africa/Dakar`, ou fuseau de l'appareil s'il est différent, avec choix), devise principale **FCFA (XOF)** pré-sélectionnée. → `PATCH /api/v1/me/preferences`.
2. **Vos comptes** (≈ 60 s) — cases pré-proposées : Espèces ✓, Wave ✓, Orange Money, Free Money, Banque, + « Autre compte ». Pour chaque compte coché : nom (pré-rempli, modifiable) et **solde actuel** (`MoneyInput`, 0 accepté, aide « Recopiez le solde affiché dans l'application de l'opérateur. »). Choix du **compte par défaut** pour la capture rapide. → un `POST /api/v1/finance/accounts` par compte, chacun avec `Idempotency-Key` (un double appui ne crée pas deux comptes). Les soldes saisis deviennent les soldes d'ouverture datés du jour.
3. **Catégories** (≈ 30 s) — catégories par défaut (`PRODUCT_SPEC.md` §4.10 + « Frais mobile money ») affichées en chips, toutes cochées ; décocher masque, « + Ajouter » crée. Aucun écran de configuration détaillée.
4. **Installer l'application** (≈ 20 s) — Android/Chrome : bouton « Installer ORBIT » (`beforeinstallprompt`) ; iOS : illustration en 2 étapes « Partager → Sur l'écran d'accueil » ; déjà installée : étape sautée. Mention des raccourcis « Dépense » et « Idée » (appui long sur l'icône).
5. **Prêt** (≈ 10 s) — « Essayez : appuyez sur + et tapez « 5000 taxi wave ». » [Commencer] → `/` avec une bulle d'aide pointant le bouton + (affichée une seule fois).

**Règles :** aucune étape n'est bloquante, sauf la région (valeurs par défaut acceptées en un appui). Les données saisies pendant l'onboarding (comptes, soldes) sont modifiables ensuite dans Paramètres et Finances. Si le module Finances est désactivé, les étapes 2 et 3 sont sautées. Objectif mesuré en E2E : parcours complet par un utilisateur scripté < 3 min, < 25 interactions.

### 11.7 Tri de la boîte INBOX

Route `/ideas/inbox`. Objectif : vider la boîte en traitant une idée en un geste.

1. En-tête : « À trier · 12 idées », progression « 3 / 12 traitées » pendant la session.
2. Mobile : une **carte à la fois** (titre, description tronquée, source, date de capture, tags). Desktop : liste à gauche, détail à droite.
3. Actions sous la carte (boutons de 44 px, icône + texte) :
   - **Tâche** → conversion en tâche (titre repris, idée liée conservée) ; feuille légère pour l'échéance facultative.
   - **Projet** → conversion en projet (`PRODUCT_SPEC.md` §4.14 : l'idée d'origine est conservée, statut `IN_PROGRESS`).
   - **Note** → conversion en note.
   - **Garder** → statut `TO_REVIEW` (« À examiner plus tard »).
   - **Abandonner** → statut `ABANDONED`.
   - Menu `⋯` : Modifier, Ajouter des tags, Priorité, Supprimer.
4. Après chaque action : carte suivante, toast 8 s « Idée convertie en tâche » [Annuler].
5. Fin : `EmptyState` « Tout est trié. » [Retour à l'accueil].

**Règles :** balayage gauche = Abandonner, droite = Garder (mobile), **toujours** doublés par les boutons ; raccourcis desktop `T` tâche, `P` projet, `N` note, `K` garder, `A` abandonner, `E` modifier, `↑`/`↓` pour naviguer. Les mutations de statut sont optimistes (hors finance). Une idée contenant un montant (capture hors ligne d'une dépense) affiche une action supplémentaire en premier : **« Enregistrer comme dépense »**, qui ouvre §11.1 pré-rempli et passe l'idée en `REALIZED` après succès. Doublons potentiels (même titre normalisé) signalés par un badge « Doublon possible », jamais fusionnés automatiquement.

### 11.8 Zone Dev (ADMIN)

Visible et accessible **uniquement** pour le rôle `ADMIN` (ADR-002). Un `USER` ne voit aucune entrée de menu et obtient « Introuvable » sur `/dev/*` et `/admin/*`.

- **Identification visuelle** : groupe de navigation « Dev » avec l'accent `--zone-dev` et le badge « ADMIN » ; `ZoneDevHeader` (bande de 4 px `--zone-dev` en haut de chaque page de la zone + libellé « Zone Dev »). L'admin sait toujours qu'il est dans un espace technique.
- **Inventaire** (`/dev/applications`, `/dev/domains`, `/dev/servers`, `/dev/services`, PHASE-12) : `ResponsiveCollection` avec badges d'échéance (« Expire dans 12 jours » `warning`, « Expiré » `danger`), filtres par environnement et statut.
- **Coffre-fort** (`/dev/vault`, PHASE-13), parcours de révélation :
  1. Liste des items : nom, type, environnement, dernière rotation ; **valeur jamais affichée** (`••••••••`).
  2. « Révéler » → `ReauthDialog` (mot de passe) puis code TOTP (6 chiffres, `inputMode="numeric"`, `autocomplete="one-time-code"`).
  3. Valeur affichée en police monospace dans un champ en lecture seule, compte à rebours visible « Masqué dans 30 s », bouton « Copier » (toast « Copié. Pensez à vider le presse-papiers. »).
  4. Masquage automatique à 30 s, au changement d'onglet et à la mise en arrière-plan de l'application.
  5. Chaque révélation est auditée (côté API) ; l'écran rappelle « Cette consultation est enregistrée ».
- **Console d'administration** (`/admin`, PHASE-17) : métadonnées de compte uniquement (e-mail, date d'inscription, statut, volumétrie agrégée). Aucune vue, aucun lien, aucun champ de recherche ne donne accès aux données privées d'un autre utilisateur ; l'en-tête le rappelle : « Vous voyez uniquement des métadonnées de compte. »

## 12. Points ouverts

| # | Sujet | Proposition | Décideur |
|---|---|---|---|
| D1 | Apprentissage des choix de la capture (mot-clé → catégorie/compte préféré) | Mémoriser côté serveur après 2 corrections identiques | Propriétaire, PHASE-07 |
| D2 | Collage d'un SMS de confirmation mobile money pour pré-remplir montant, frais et ID | Hors périmètre ; à étudier avec la capture multicanale | PHASE-16 |
| D3 | Seuil « À rapprocher » (30 jours) configurable par compte | Valeur fixe au départ | `FINANCE_RULES.md` |
| D4 | Catégorie par défaut « Téléphone et internet » (crédit, pass) absente du cahier | L'ajouter aux catégories initiales | Propriétaire |
| D5 | Logo et icônes PWA définitifs | Monogramme provisoire « O » en `--primary` | Propriétaire |
