# PHASE-13 : Coffre-fort de secrets et MFA TOTP

- **Statut :** À faire
- **Dépend de :** PHASE-01, PHASE-03, PHASE-08, PHASE-12
- **Accès :** TOTP : Tous ; coffre-fort : ADMIN
- **Estimation :** 7 à 9 jours effectifs

## 1. Objectif
Livrer l'authentification à deux facteurs TOTP pour tous les utilisateurs, puis un coffre-fort de secrets réservé à l'ADMIN, chiffré par enveloppe (XChaCha20-Poly1305, ADR-019), dont chaque révélation exige une ré-authentification et un code TOTP, est limitée en débit et auditée.

## 2. Contexte à charger
1. `AGENTS.md`, `DECISIONS.md` (ADR-002, ADR-006, ADR-007, ADR-015, ADR-019), `PRODUCT_SCOPE.md` §4 (M12) et §6 (amendement §4.1).
2. `docs/progress/PHASE-12-REPORT.md`.
3. `SECURITY.md` : **en entier** pour cette phase (modèle de menace, cryptographie, gestion des clés, rate limiting, journalisation, réponse à incident).
4. `DATA_MODEL.md` : sections `user_mfa_factors`, `mfa_recovery_codes`, `vault_items`, `vault_secret_payloads`, `sessions`, `audit_logs`.
5. `INFRASTRUCTURE.md` : montage de fichiers secrets, sauvegardes restic (exclusions), procédure de restauration.
6. `API.md` : ré-authentification (`REAUTH_REQUIRED`), `MFA_REQUIRED`, rate limiting, `Cache-Control: no-store`.
7. `FRONTEND.md`, `DESIGN_SYSTEM.md` : flux d'enrôlement, affichage masqué.
8. `TESTING.md` : tests de sécurité, données fictives.
9. `PRODUCT_SPEC.md` §4.8, §8 (pour mémoire).

## 3. Périmètre
### Inclus
- **Module `crypto`** partagé : chiffrement par enveloppe avec libsodium (`sodium-native` ou `libsodium-wrappers-sumo`), trousseau de KEK versionnées chargé depuis des fichiers montés, usages séparés (`VAULT`, `MFA` ; `INTEGRATIONS` réservé à PHASE-14).
- **TOTP (RFC 6238)** pour tous : enrôlement (QR + clé manuelle), confirmation, 10 codes de secours à usage unique, vérification à la connexion, régénération des codes, désactivation sous ré-authentification, procédure de récupération en cas de perte.
- **Exigence de TOTP** pour les actions sensibles quand il est activé (export, suppression de compte, changement d'e-mail) — en complément de la ré-authentification par mot de passe d'ADR-006.
- **Coffre ADMIN** : types (mot de passe, clé SSH privée, jeton d'API, clé d'accès cloud, certificat, identifiant+secret, autre), métadonnées non sensibles, rattachement facultatif à une ressource Dev, expiration, CRUD des métadonnées, révélation, rotation du secret (nouvelle version), suppression, rotation de la KEK (ré-encapsulation des DEK) par commande d'exploitation.
- Audit complet, rate limiting, détection d'anomalies, notifications de sécurité.
- Tests de sécurité dédiés et **procédure de validation** avant tout stockage de secret réel.

### Exclu (et phase où ces éléments seront traités)
- Clés de sécurité matérielles WebAuthn/passkeys : non retenues (ADR à créer si souhaité).
- Chiffrement des jetons OAuth : PHASE-14 (réutilise le module `crypto`, usage `INTEGRATIONS`).
- Partage de secrets, export du coffre : **jamais** (un export ordinaire n'inclut aucun secret).
- KMS cloud : non retenu (fichier monté, ADR-019) ; réévaluable en PHASE-17.

## 4. Modèle de données
Migration : `phase13_vault_mfa`. Détail : `DATA_MODEL.md`.

| Table | Action | Points clés |
|---|---|---|
| `user_mfa_factors` | création | `user_id`, `type` (`TOTP`), `status` (`PENDING`, `ACTIVE`, `DISABLED`), `secret_ciphertext` (BYTEA, enveloppe usage `MFA`), `secret_nonce`, `wrapped_dek`, `dek_nonce`, `kek_version`, `format_version`, `last_used_step` (BIGINT, anti-rejeu), `confirmed_at`, `disabled_at`, timestamps. Unique partiel : un seul facteur `ACTIVE` par utilisateur. |
| `mfa_recovery_codes` | création | `user_id`, `factor_id`, `code_hash` (SHA-256 d'un code de 80 bits d'entropie), `used_at`, `created_at`. |
| `vault_items` | création | `user_id`, `title`, `secret_type`, `username` nullable, `notes` (non sensibles, détecteur de secrets de PHASE-12), `expires_at`, `last_rotated_at`, `current_version`, FK nullables `application_id`, `environment_id`, `server_id`, `domain_id`, `service_subscription_id` avec `CHECK num_nonnulls(...) <= 1`, timestamps, `deleted_at`. **Aucune valeur secrète.** |
| `vault_secret_payloads` | création | `user_id`, `vault_item_id`, `version`, `ciphertext` (BYTEA), `nonce` (24 octets), `wrapped_dek`, `dek_nonce`, `kek_version`, `format_version`, `created_at`, `superseded_at`. Unique `(vault_item_id, version)`. Conservation : version courante + 1 précédente, les plus anciennes sont détruites. |
| `sessions` | modification | Ajout `mfa_verified_at` nullable et `mfa_pending` (bool) ; une session `mfa_pending` n'accède qu'aux routes `/auth/mfa/*` et `/auth/logout`. |

Pas de table `vault_access_logs` : les accès au coffre sont tracés dans `audit_logs` (canonique, PHASE-01) avec des actions dédiées (`vault.item.revealed`, `vault.item.reveal_denied`, …).

## 5. API
Routes sous `/api/v1`. Réponses du coffre et de l'enrôlement avec `Cache-Control: no-store`.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/me/mfa` | Tous | État : `enabled`, `confirmedAt`, codes de secours restants. |
| POST | `/me/mfa/totp/setup` | Tous | Ré-auth < 5 min requise. Crée un facteur `PENDING`, renvoie `otpauthUri` et la clé en base32 **une seule fois**. |
| POST | `/me/mfa/totp/confirm` | Tous | `{ code }` → `ACTIVE` ; renvoie 10 codes de secours (une seule fois). Notification de sécurité. |
| POST | `/me/mfa/recovery-codes/regenerate` | Tous | Ré-auth + TOTP ; invalide les anciens codes. |
| DELETE | `/me/mfa/totp` | Tous | Ré-auth + TOTP **ou** code de secours ; désactive, supprime le secret et les codes ; notification. |
| POST | `/auth/mfa/verify` | Tous (session `mfa_pending`) | `{ code }` ou `{ recoveryCode }` ; lève `mfa_pending`. |
| POST | `/auth/mfa/recovery/request` | Public (e-mail) | Récupération en cas de perte du téléphone et des codes : e-mail avec lien à usage unique, délai de sécurité de 72 h, notifications à chaque étape ; annulable. |
| POST | `/auth/reauth` | Tous | (Existant PHASE-01) ; accepte désormais `{ password, totpCode? }` et renseigne `reauth_at` et `mfa_verified_at`. |
| GET/POST | `/dev/vault/items` | ADMIN + TOTP actif | Liste des métadonnées / création `{ title, secretType, username?, secret, … }`. |
| GET/PATCH | `/dev/vault/items/:id` | ADMIN | Métadonnées seulement ; `PATCH` sans valeur secrète. |
| POST | `/dev/vault/items/:id/reveal` | ADMIN | Ré-auth < 5 min **et** `{ totpCode }` ; renvoie `{ secret, version }`. Rate limit. |
| POST | `/dev/vault/items/:id/rotate` | ADMIN | Ré-auth + TOTP ; `{ secret }` → nouvelle version. |
| DELETE | `/dev/vault/items/:id` | ADMIN | Ré-auth + TOTP ; destruction des payloads (voir §7). |

Codes d'erreur : `REAUTH_REQUIRED` (401), `MFA_REQUIRED` (401), `MFA_SETUP_REQUIRED` (403, coffre sans TOTP actif), `FORBIDDEN_ROLE` (403), `RATE_LIMITED` (429), `VAULT_KEY_UNAVAILABLE` (503, KEK absente : message générique, alerte d'exploitation).

## 6. Frontend
- **Routes :** `/settings/security` (MFA), `/login/mfa` (étape TOTP), `/dev/vault`, `/dev/vault/:id`.
- **Composants :** `TotpEnrollWizard` (QR généré **côté client** à partir de l'`otpauthUri`, jamais via un service tiers ; saisie manuelle ; confirmation), `RecoveryCodesSheet` (affichage unique, téléchargement `.txt`, case « je les ai sauvegardés » obligatoire), `ReauthDialog` (mot de passe + TOTP), `VaultItemForm` (champ secret de type mot de passe, multi-ligne pour clés SSH, sans autocomplétion), `RevealPanel` (valeur masquée par défaut, révélation explicite, bouton copier, **effacement automatique après 30 s** de l'affichage et tentative de vider le presse-papiers, compte à rebours visible).
- Les clés privées ne sont jamais affichées par défaut ; aucune valeur révélée n'est mise en cache TanStack Query (`gcTime: 0`, pas de persistance), ni en IndexedDB, ni dans l'état d'URL.
- **États obligatoires** : chargement, vide, erreur, ré-auth requise, MFA requise, débit dépassé (avec délai), clé indisponible.

## 7. Règles métier et cas limites
1. **TOTP** : SHA-1, 6 chiffres, pas de 30 s, fenêtre ±1 pas ; **anti-rejeu** : un pas déjà utilisé (`last_used_step`) est refusé ; comparaison en temps constant.
2. **Limitation** : 5 échecs TOTP / 15 min par utilisateur et par IP, puis verrouillage temporaire 15 min ; notification de sécurité au-delà de 10 échecs/24 h.
3. **Codes de secours** : 10 codes de 16 caractères (base32, 80 bits), hachés SHA-256, usage unique, utilisation notifiée par e-mail.
4. **Récupération** sans facteur : aucun contournement par l'ADMIN (ADR-002, l'ADMIN n'agit pas sur les comptes d'autrui au-delà de la suspension). Le flux e-mail + délai de 72 h + notifications est la seule voie ; il désactive le TOTP mais révoque toutes les sessions.
5. **Chiffrement par enveloppe (ADR-019)** :
   - DEK aléatoire de 32 octets par **version** de secret ; nonce aléatoire de 24 octets (`crypto_aead_xchacha20poly1305_ietf`) ;
   - AAD = `user_id ‖ item_id ‖ version ‖ key_version ‖ format_version` (sérialisation canonique) ; échanger un payload entre deux items doit échouer ;
   - DEK encapsulée par la KEK `kek_version` (même AEAD, AAD = `purpose ‖ item_id`) ;
   - buffers en clair effacés (`sodium_memzero`) après usage ; aucune valeur en clair dans les exceptions.
6. **KEK** : fichiers montés `/run/secrets/orbit_kek_<purpose>_v<n>` (root:600, lecture seule), **hors base, hors dépôt, hors sauvegarde restic de la base** ; copie hors ligne conservée séparément par le propriétaire (procédure dans `INFRASTRUCTURE.md`). Au démarrage, l'API vérifie la présence de la KEK active ; si absente, le coffre répond 503 sans faire tomber l'application.
7. **Rotation de KEK** : commande `pnpm --filter api vault:rewrap --purpose VAULT --to <n>` (worker), qui ré-encapsule les DEK par lots, de façon idempotente et reprenable, sans jamais déchiffrer les secrets eux-mêmes ; l'ancienne KEK n'est retirée qu'après vérification à 100 %.
8. **Rotation de secret** (`rotate`) : nouvelle version, l'ancienne marquée `superseded_at`, version N-2 détruite.
9. **Révélation** : rôle ADMIN + ré-auth < 5 min + TOTP valide **dans la même requête** ; 10 révélations / heure et 30 / jour maximum ; réponse `no-store` ; audit (`item_id`, résultat, IP tronquée, user-agent) **sans la valeur**.
10. **Détection d'anomalies** : révélations en rafale, échecs répétés, révélation depuis une nouvelle IP → notification de sécurité in-app + e-mail.
11. **Création d'un item** : refusée si l'ADMIN n'a pas de TOTP actif (`MFA_SETUP_REQUIRED`).
12. **Suppression** : suppression logique de l'item et **destruction immédiate** des payloads (lignes supprimées). Les sauvegardes chiffrées conservent les anciens payloads jusqu'à leur expiration (rétention dans `INFRASTRUCTURE.md`) ; ce point est documenté dans la politique de suppression.
13. **Fuites** : aucun secret dans les logs (pino `redact` sur `secret`, `password`, `totpCode`, `recoveryCode`, `ciphertext`), erreurs, traces, analytics, exports, recherche, notifications, prompts IA (PHASE-16 exclura tout le module).
14. **Interdiction de secrets réels** : aucun secret réel n'est enregistré, ni en local, ni en staging, ni en production, **avant** la validation finale de cette phase : tests de sécurité verts, revue `security-reviewer` sans constat ouvert, restauration de sauvegarde avec KEK testée, puis signature explicite du propriétaire consignée dans le rapport. Jusque-là, un bandeau « coffre en validation — valeurs fictives uniquement » est affiché (drapeau de configuration `VAULT_REAL_SECRETS_ALLOWED=false`).
15. Avertissement permanent dans l'interface : le coffre n'est pas un gestionnaire de mots de passe audité ou certifié (§4.8 du cahier).

## 8. Tests exigés
- **Unitaires** : vecteurs de test RFC 6238 ; fenêtre ±1 ; anti-rejeu ; chiffrement/déchiffrement aller-retour ; **altération** d'un octet du ciphertext, du nonce, de la DEK encapsulée → échec authentifié ; AAD différente (autre item, autre utilisateur, autre version) → échec ; KEK inconnue → `VAULT_KEY_UNAVAILABLE` ; unicité statistique des nonces (10 000 chiffrements).
- **Intégration** : enrôlement complet ; connexion en deux étapes (session `mfa_pending` limitée) ; codes de secours à usage unique ; ré-encapsulation de KEK reprenable après interruption ; aucune valeur en clair en base (recherche du motif fictif dans un `pg_dump` du conteneur de test).
- **Sécurité** : révélation sans ré-auth → 401 ; avec ré-auth expirée → 401 ; sans TOTP / TOTP rejoué → 401 ; rôle `USER` → 403 ; dépassement du débit → 429 ; capture des logs et des réponses d'erreur prouvant l'absence du secret et du code TOTP ; export utilisateur sans aucun payload ; brute force TOTP verrouillé.
- **Isolation entre utilisateurs** : test généré pour chaque route ; deux ADMIN de test — A ne liste ni ne révèle un item de B (404) ; facteur MFA de A inutilisable pour B.
- **Restauration** : restauration de la sauvegarde de staging + montage de la KEK → déchiffrement d'un secret fictif réussi ; sans KEK → échec contrôlé.
- **E2E** : enrôlement TOTP (code calculé par le test avec le secret de l'URI), connexion avec TOTP, création d'un secret fictif, révélation autorisée puis refusée (mauvais code), effacement après 30 s.

## 9. Découpage en tâches
| # | Tâche | Dépend de |
|---|---|---|
| T1 | Module `crypto` : trousseau de KEK (fichiers), API `seal/open` d'enveloppe, tests d'abord. | — |
| T2 | Migration `user_mfa_factors`, `mfa_recovery_codes`, colonnes de `sessions`. | — |
| T3 | Service TOTP (génération, vérification, anti-rejeu, limitation). | T1, T2 |
| T4 | Enrôlement, confirmation, codes de secours, désactivation. | T3 |
| T5 | Connexion en deux étapes, `reauth` étendue, exigence TOTP sur les actions sensibles. | T4 |
| T6 | Récupération par e-mail avec délai de 72 h. | T5 |
| T7 | Migration `vault_items`, `vault_secret_payloads` ; service métadonnées. | T1 |
| T8 | Création, révélation, rotation, suppression ; rate limit ; audit ; anomalies. | T5, T7 |
| T9 | Commande de ré-encapsulation de KEK + procédure d'exploitation dans le rapport. | T7 |
| T10 | Redaction des logs, exclusions d'export et de recherche, bandeau de validation. | T8 |
| T11 | Suite de tests de sécurité + test de restauration avec KEK sur staging. | T8, T9, T10 |
| T12 | Front : sécurité du compte (enrôlement, codes, désactivation), étape MFA de connexion. | T5, T6 |
| T13 | Front : coffre (liste, formulaire, `RevealPanel`, ré-auth). | T8 |
| T14 | E2E, revue de sécurité, validation finale par le propriétaire, rapport. | T11, T12, T13 |

## 10. Agents ECC à mobiliser
- `security-reviewer` : **à chaque tâche** et revue finale complète.
- `tdd-guide` : T1, T3, T8.
- `typescript-reviewer`, `code-reviewer`, `silent-failure-hunter` (aucune erreur cryptographique avalée).
- `database-reviewer` : migration.
- `react-reviewer` : effacement de la valeur révélée, absence de cache.
- `e2e-runner` : T14.

## 11. Definition of Done
- [ ] DoD générale de `DEVELOPMENT_METHOD.md` respectée.
- [ ] TOTP disponible pour tous ; vecteurs RFC 6238 verts ; anti-rejeu prouvé.
- [ ] Révélation impossible sans ré-auth + TOTP ; rate limit et audit vérifiés.
- [ ] Aucune valeur en clair en base, dans les logs, erreurs, exports ou recherche (tests).
- [ ] KEK hors base et hors sauvegarde de la base ; restauration avec KEK testée sur staging.
- [ ] Ré-encapsulation de KEK testée et documentée.
- [ ] Tests d'isolation verts pour toutes les nouvelles routes.
- [ ] `security-reviewer` : aucun constat ouvert (tous niveaux CRITICAL/HIGH/MEDIUM traités ou acceptés par écrit).
- [ ] Validation finale signée par le propriétaire avant passage de `VAULT_REAL_SECRETS_ALLOWED` à `true`.

## 12. Rapport de fin de phase
Rédiger `docs/progress/PHASE-13-REPORT.md` (gabarit dans `DEVELOPMENT_METHOD.md`), incluant : paramètres cryptographiques exacts, emplacement et procédure de la KEK (sans aucune valeur), procédure de rotation, résultat du test de restauration, décision du propriétaire sur l'autorisation des secrets réels.
