# ORBIT : sécurité

- **Statut :** référence. Subordonné à `DECISIONS.md` (ADR) puis à `PRODUCT_SCOPE.md`. Remplace `PRODUCT_SPEC.md` §8 et complète §2.3, §4.1, §4.8, §4.17, §4.21 à §4.25, §12.4.
- **Responsabilité :** modèle de menace, contrôles de sécurité obligatoires, gestion des clés, audit, réponse à incident, checklist par phase. Les formats d'API sont dans `API.md` ; le schéma des tables dans `DATA_MODEL.md` ; l'exploitation dans `INFRASTRUCTURE.md` ; les intégrations dans `INTEGRATIONS.md`.
- **Documents liés :** `DECISIONS.md` (ADR-001, 002, 006, 007, 008, 010, 012, 013, 015, 019, 025), `PRODUCT_SCOPE.md` §3–§4, `API.md`, `DATA_MODEL.md`, `TESTING.md`, `INFRASTRUCTURE.md`, `INTEGRATIONS.md`, `CODING_STANDARDS.md`.
- **Conventions :** « DOIT » = obligatoire, bloque la Definition of Done ; « DEVRAIT » = attendu sauf justification écrite dans le rapport de phase. Toute dérogation passe par une nouvelle ADR.

---

## 1. Périmètre et hypothèses

| Élément | Valeur |
|---|---|
| Modèle | SaaS à inscription ouverte, **un espace personnel par utilisateur** (ADR-001), isolation par `user_id` (ADR-007). |
| Rôles | `USER`, `ADMIN` (ADR-002). ADMIN ne lit **jamais** les données privées d'un autre utilisateur. |
| Actifs critiques | Données financières (M04, M05, M09), coffre-fort (M12), jetons OAuth (M13), contenu personnel (notes, journal, documents), identifiants de connexion, clés maîtres. |
| Surface exposée | Pour le navigateur, une seule origine HTTPS : le front sur Vercel, qui réécrit `/api/*` vers l'API (ADR-006, ADR-038). Sur le VPS, Caddy expose `api.<domaine>` (réécriture Vercel, webhooks, n8n) et `n8n.<domaine>` (authentifié, éditeur restreint par IP). Postgres, Redis et Uptime Kuma jamais exposés. |
| Échelle | Un VPS OVH UE, une instance API, un worker, n8n (ADR-012, ADR-015, ADR-038) ; front sur Vercel ; suivi d'erreurs Sentry SaaS (UE). Pas de KMS cloud : les clés sont des fichiers secrets montés (ADR-019). |
| Hors périmètre | Certification de gestionnaire de mots de passe (§4.8 « Limite »), conformité fiscale, comptabilité réglementaire. |

---

## 2. Modèle de menace (STRIDE priorisé)

Priorité : **P0** = contrôle requis avant la phase concernée, sinon blocage ; **P1** = requis avant mise en production publique (fin PHASE-03 pour le socle, sinon fin de la phase du module) ; **P2** = durcissement planifié (PHASE-17 au plus tard).

| ID | Menace | STRIDE | Probabilité | Impact | Prio | Contrôles (sections) |
|---|---|---|---|---|---|---|
| T01 | Accès horizontal aux données d'un autre utilisateur (IDOR, oubli de filtre `user_id`, `findUnique` non scopé, FK vers la donnée d'autrui) | I, E | Élevée | Critique | P0 | §6, §7, ADR-007 |
| T02 | Vol ou rejeu de session (XSS, poste partagé, cookie intercepté) | S | Moyenne | Critique | P0 | §3.2, §3.9, §3.10 |
| T03 | Credential stuffing, force brute, pulvérisation de mots de passe | S | Élevée | Élevé | P0 | §3.3, §3.7 |
| T04 | Énumération de comptes (inscription, connexion, mot de passe oublié, changement d'e-mail) | I | Élevée | Moyen | P0 | §3.8 |
| T05 | CSRF sur une mutation authentifiée | T, E | Moyenne | Élevé | P0 | §3.9 |
| T06 | Mass assignment : `userId`, `role`, `status`, `balance` injectés dans un corps de requête | T, E | Moyenne | Critique | P0 | §6.5, ADR-010 |
| T07 | Injection SQL (raw SQL, recherche plein texte, tri dynamique) | T, I | Faible | Critique | P0 | §6.6, ADR-007 §5 |
| T08 | XSS stocké (notes, noms de fichiers, contenu e-mail, sortie IA) | T, E | Moyenne | Critique | P0 | §3.10, §10, §13 |
| T09 | Fuite de données dans les logs, Redis, messages d'erreur, traces, analytics | I | Élevée | Élevé | P0 | §9.3, §9.4, §17 |
| T10 | Compromission du VPS (accès root, conteneur évadé, SSH faible) | S, T, I, E | Faible | Critique | P1 | §15, §16 |
| T11 | Perte ou vol de la clé maître du coffre (KEK) | I, D | Faible | Critique | P0 (PHASE-13) | §8.4, §16 |
| T12 | Sauvegardes exposées ou non restaurables | I, D | Moyenne | Critique | P1 | §16, ADR-015 |
| T13 | Chaîne d'approvisionnement npm (paquet malveillant, typosquatting, script `postinstall`, image Docker altérée) | T, E | Moyenne | Critique | P0 | §17 |
| T14 | Agents IA de développement : secret commité, code non sûr généré, prompt injection via dépendance ou document, accès accidentel à la production | T, I, E | Élevée | Élevé | P0 | §17.4 |
| T15 | Swagger/OpenAPI exposé en production, cartographie de l'API | I | Moyenne | Faible | P0 | §3.11, `API.md` §13 |
| T16 | Host header poisoning (liens de reset ou de vérification pointant vers un domaine attaquant, empoisonnement de cache) | S, T | Moyenne | Élevé | P0 | §3.12 |
| T17 | Téléphone volé ou perdu (PWA ouverte, cache local, IndexedDB) | S, I | Moyenne | Élevé | P1 | §3.13 |
| T18 | Abus d'ADMIN : lecture de données privées, usurpation, action non tracée | I, R, E | Faible | Critique | P0 | §7.2, §18 |
| T19 | Vol de jetons OAuth Google (base, logs, sauvegarde) | I, E | Faible | Élevé | P1 (PHASE-14) | §9.5 |
| T20 | Webhook forgé, rejoué ou dupliqué | S, T | Moyenne | Élevé | P0 (PHASE-14) | §12 |
| T21 | SSRF via URL fournie (environnements, intégrations, automatisations) | I, E | Faible | Élevé | P0 (PHASE-12) | §11 |
| T22 | Upload malveillant (polyglotte, HTML/SVG actif, zip bomb, nom de fichier piégé) | T, E, D | Moyenne | Élevé | P0 (PHASE-09) | §10 |
| T23 | Prompt injection (notes, e-mails, WhatsApp, documents) menant à une exfiltration ou à une écriture non voulue | T, I, E | Élevée | Élevé | P0 (PHASE-16) | §13 |
| T24 | Erreur d'automatisation : boucle, double exécution, action financière non confirmée | T, D | Moyenne | Élevé | P0 (PHASE-15) | §14 |
| T25 | Export non autorisé ou injection de formules CSV | I, T | Moyenne | Élevé | P0 (PHASE-07) | §9.6 |
| T26 | Déni de service applicatif (argon2 saturant la RAM, requêtes non bornées, uploads, IA coûteuse) | D | Moyenne | Moyen | P1 | §3.3, §3.7, `API.md` §11 |
| T27 | Répudiation : action sensible sans trace exploitable | R | Moyenne | Moyen | P1 | §18 |
| T28 | Contournement de la MFA par la réinitialisation de mot de passe | S, E | Faible | Élevé | P0 (PHASE-13) | §3.5, §5 |

**Règle :** une nouvelle surface (route, intégration, job, upload) ajoute une ligne à ce tableau dans la même PR.

---

## 3. Authentification

### 3.1 Principes (ADR-006)

- Session serveur ; cookie `__Host-orbit_sid` ; **pas de JWT navigateur, pas de `/auth/refresh`, pas de jeton en `localStorage`**.
- Le front et l'API partagent l'origine : Vercel réécrit `/api/:path*` vers `https://api.<domaine>/api/:path*` (ADR-038). Le cookie est lié au seul domaine du front : un appel direct à `api.<domaine>` n'emporte jamais de cookie de session.
- Toutes les routes sont authentifiées par défaut (guard global). Une route publique porte `@Public()` et figure dans la liste blanche de `API.md` §14.1 ; un test CI échoue si une route `@Public()` n'y figure pas.

### 3.2 Cycle de vie des sessions

| Paramètre | Valeur |
|---|---|
| Jeton | 32 octets de `crypto.randomBytes`, encodés base64url (43 caractères). Jamais journalisé. |
| Stockage | Table `sessions` : `id`, `user_id`, `token_hash` (SHA-256, index unique), `created_at`, `last_seen_at`, `idle_expires_at`, `absolute_expires_at`, `reauth_at`, `mfa_verified_at`, `mfa_pending` (bool, PHASE-13), `ip_prefix`, `user_agent` (tronqué à 256), `revoked_at`, `revoked_reason`. |
| Cookie | `__Host-orbit_sid=<jeton>; Path=/; Secure; HttpOnly; SameSite=Lax` ; `Max-Age` = durée absolue restante. Pas d'attribut `Domain`. |
| Inactivité | 7 jours glissants : `idle_expires_at = now + 7 j` à chaque requête, écriture limitée à une fois par minute et par session. |
| Durée absolue | 30 jours, jamais prolongée. |
| Rotation | Nouveau jeton à la connexion, après vérification MFA, après changement de mot de passe. L'ancien jeton est révoqué dans la même transaction. Aucun jeton fourni par le client n'est jamais adopté (anti-fixation). |
| Limite | 20 sessions actives par utilisateur ; au-delà, la plus ancienne est révoquée (`revoked_reason = 'LIMIT'`). |
| Révocation | Unitaire (`DELETE /me/sessions/:id`), « toutes sauf courante », globale lors d'un reset, d'un changement de mot de passe, d'une suspension par ADMIN ou d'un incident (§19). |
| Déconnexion | Révocation en base, `Set-Cookie` d'expiration, en-tête `Clear-Site-Data: "cache"`. Le front vide la file IndexedDB **après** synchronisation (§3.13). |
| Résolution | Le guard calcule `SHA-256(jeton)`, charge la session non révoquée et non expirée, puis l'utilisateur actif. Échec → `401 UNAUTHENTICATED` sans distinguer la cause. |
| Purge | Job quotidien (PHASE-08) : suppression des sessions expirées depuis plus de 30 jours. Avant PHASE-08, purge au démarrage de l'API. |
| `ip_prefix` | IPv4 tronquée en /24, IPv6 en /48 (minimisation, §9.1). |

### 3.3 Mots de passe

- **Algorithme :** argon2id, `m = 65536 KiB` (64 MiB), `t = 3`, `p = 1`, sel 16 octets, sortie 32 octets, format PHC (ADR-006). Calibrer en PHASE-03 sur le VPS cible : 200 à 500 ms par hachage ; consigner la valeur retenue dans `INFRASTRUCTURE.md`.
- **Rehachage :** à la connexion réussie, si les paramètres stockés diffèrent des paramètres courants.
- **Concurrence :** sémaphore de 4 hachages simultanés par processus (4 × 64 MiB) ; au-delà, file d'attente de 2 s puis `503 SERVICE_UNAVAILABLE`. Protège contre T26.
- **Politique :** longueur 12 à 128 caractères (mesurée en points de code), tout caractère Unicode accepté après normalisation NFC, aucune règle de composition. Refus si présent dans une liste locale de 100 000 mots de passe courants (fichier versionné, aucun appel externe) ou s'il contient l'adresse e-mail. Indicateur de force côté front (zxcvbn-ts) à titre d'aide seulement.
- **Pas de poivre (pepper) :** décision de simplicité ; la sécurité repose sur argon2id et le rate limiting. À réévaluer en PHASE-17.
- **Comparaison temporelle :** si l'e-mail est inconnu, vérifier contre un hachage factice précalculé pour égaliser le temps de réponse.

### 3.4 Inscription et vérification d'e-mail

1. `POST /auth/register` valide le schéma, normalise l'e-mail (trim, minuscules du domaine et de la partie locale, NFC). Réponse **toujours** `202` avec le même message.
2. Compte nouveau : création `users.status = PENDING_VERIFICATION`, envoi d'un jeton de vérification. Compte existant : envoi d'un e-mail « une inscription a été tentée avec votre adresse » ; aucune modification du compte. Les deux branches envoient un e-mail de manière synchrone pour égaliser le temps (PHASE-01) puis via la file (PHASE-08+).
3. Jeton de vérification : 32 octets aléatoires, stocké en SHA-256 dans `email_verification_tokens`, valable **24 heures**, usage unique, invalidé par l'émission d'un nouveau jeton.
4. Connexion d'un compte non vérifié : refusée par `403 EMAIL_NOT_VERIFIED` **uniquement après** vérification correcte du mot de passe (aucune fuite d'existence).
5. Lien envoyé : `${APP_ORIGIN}/verify-email#token=<jeton>` (fragment : le jeton ne part ni dans les logs Caddy ni dans le `Referer`). Le front le poste à `POST /auth/email/verify`.

### 3.5 Réinitialisation du mot de passe

- `POST /auth/password/forgot` répond toujours `202`. E-mail envoyé seulement si le compte existe et est actif.
- Jeton : 32 octets, SHA-256 en base (`password_reset_tokens`), **30 minutes**, usage unique, un seul jeton actif par compte. Lien en fragment d'URL comme §3.4.
- `POST /auth/password/reset` : consomme le jeton, applique la politique §3.3, **révoque toutes les sessions**, invalide tous les jetons de reset, notifie l'adresse du compte, audite `auth.password.reset`.
- **Après PHASE-13 :** si l'utilisateur a une MFA active, le reset exige aussi un code TOTP ou un code de secours (T28). Sans les deux, la procédure de récupération §5.4 s'applique.
- Le reset ne connecte pas l'utilisateur : il doit se reconnecter.

### 3.6 Changement d'e-mail et de mot de passe

- **E-mail :** ré-authentification (§4) ; jeton envoyé à la **nouvelle** adresse (24 h) ; notification à l'ancienne adresse avec la date et l'IP tronquée ; bascule à la confirmation ; audit. Si la nouvelle adresse appartient déjà à un compte, la réponse reste `202` et un e-mail d'avertissement est envoyé à cette adresse.
- **Mot de passe :** mot de passe actuel obligatoire dans le corps (vaut ré-authentification) ; rotation de la session courante ; révocation des autres sessions ; notification par e-mail ; audit.

### 3.7 Rate limiting

**Moteur :** PHASE-01 à PHASE-07, compteurs en mémoire (`@nestjs/throttler`, instance unique) **plus** verrouillage persistant calculé depuis `login_events`. À partir de PHASE-08, stockage Redis (ADR-012). Les clés de compteur n'enregistrent jamais l'IP ni l'e-mail en clair : `HMAC-SHA256(RATE_LIMIT_HMAC_KEY, valeur)`.

**Réponse :** `429 RATE_LIMITED` avec `Retry-After` (secondes). Le verrouillage par compte est appliqué **que l'e-mail existe ou non** (clé = HMAC de l'e-mail normalisé), donc indistinguable.

| Route / action | Par IP | Par compte ou e-mail | Remarque |
|---|---|---|---|
| `POST /auth/login` | 20 / 10 min | 10 échecs / h → verrou 15 min ; 50 échecs / 24 h → verrou 24 h + e-mail d'alerte | Délai progressif après 3 échecs (250 ms × échecs, max 2 s). |
| `POST /auth/register` | 5 / h | 3 / h par e-mail | |
| `POST /auth/email/verify` | 20 / h | — | |
| `POST /auth/email/verify/resend` | 10 / h | 3 / h | Réponse `202` uniforme. |
| `POST /auth/password/forgot` | 10 / h | 3 / h | Réponse `202` uniforme. |
| `POST /auth/password/reset` | 10 / h | — | |
| `POST /auth/reauth` | — | 5 / 15 min par session ; 10 échecs → révocation de la session | |
| `POST /auth/mfa/verify` (PHASE-13) | 20 / 10 min | 5 / 15 min par utilisateur ; 10 échecs / h → verrou 1 h + alerte | |
| `POST /dev/vault/items/:id/reveal` | — | 10 / h, 30 / 24 h | Dépassement → alerte sécurité à ADMIN. |
| `POST /exports` | — | 5 / 24 h | |
| `POST /documents` | — | 30 / h, quota de volume (PHASE-17) | |
| `GET /search` | — | 60 / min | |
| `POST /ai/requests` | — | 30 / h et budget quotidien de jetons (PHASE-16) | |
| `POST /webhooks/:provider` | 600 / min par fournisseur | — | Au-delà, `429` ; le fournisseur réessaie. |
| Requêtes avec clé d'API (PHASE-14) | — | 600 / min par clé | |
| Toute autre route authentifiée | — | 300 / min par utilisateur | |
| Toute autre route publique | 60 / min | — | |

### 3.8 Réponses uniformes (anti-énumération)

| Situation | Réponse |
|---|---|
| E-mail inconnu ou mot de passe faux | `401 INVALID_CREDENTIALS`, même message, même temps (hachage factice). |
| Compte suspendu (`users.status = SUSPENDED`) | `401 INVALID_CREDENTIALS` (l'information n'est donnée qu'à l'utilisateur, par e-mail). |
| Inscription, mot de passe oublié, renvoi de vérification, changement d'e-mail | `202` avec message générique, que le compte existe ou non. |
| Verrouillage | `429 RATE_LIMITED`, identique pour un e-mail existant ou non. |

### 3.9 CSRF, CORS, origine

- **CSRF (ADR-006) :** pour toute méthode non sûre (`POST`, `PUT`, `PATCH`, `DELETE`) authentifiée par cookie :
  1. en-tête `X-Requested-With: orbit` obligatoire ;
  2. `Origin` égal à `APP_ORIGIN` ; si `Origin` absent, `Sec-Fetch-Site` doit valoir `same-origin` ; si les deux sont absents, refus ;
  3. échec → `403 CSRF_REJECTED`, audité au niveau `warn`.
- Les routes `GET`, `HEAD`, `OPTIONS` ne modifient **jamais** l'état (règle de revue). Exception unique : `GET /integrations/:provider/callback`, protégée par le paramètre `state` lié à la session (§9.5).
- Les requêtes authentifiées par clé d'API (`Authorization: Bearer`, PHASE-14) ignorent le cookie et ne sont pas soumises au contrôle CSRF. Une requête portant **à la fois** un cookie de session et une clé d'API est refusée (`400 VALIDATION_FAILED`).
- Les webhooks (`/webhooks/*`) sont exemptés de CSRF et authentifiés par signature (§12).
- **CORS :** désactivé. Aucun en-tête `Access-Control-Allow-*` n'est émis ; les clients non navigateurs n'en ont pas besoin.

### 3.10 En-têtes HTTP de sécurité

Posés par Vercel pour le front (`apps/web/vercel.json`, ADR-038), par `helmet` (et Caddy en complément) pour l'API ; un test E2E et les smoke tests vérifient leur présence.

| En-tête | Valeur |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` ; ajouter `preload` après 30 jours de production stable. |
| `Content-Security-Policy` (front) | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://<hôte-du-stockage>; font-src 'self'; connect-src 'self' https://*.ingest.de.sentry.io; media-src 'self' blob:; worker-src 'self'; manifest-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; upgrade-insecure-requests` |
| CSP (API) | `default-src 'none'; frame-ancestors 'none'; sandbox` |
| Trusted Types | `require-trusted-types-for 'script'` en `Content-Security-Policy-Report-Only` dès PHASE-02, en mode bloquant en PHASE-17. |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `camera=(), geolocation=(), payment=(), usb=(), microphone=()` ; `microphone=(self)` à partir de PHASE-16 (capture vocale). |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Cache-Control` (API) | `no-store` sur toutes les réponses `/api/v1` sauf téléchargements explicitement marqués `private, max-age=0`. |
| `X-Powered-By` | supprimé. |

- Aucun `<script>` inline, aucun `eval`, aucun `dangerouslySetInnerHTML` hors du composant `SafeMarkdown` (DOMPurify, liste blanche de balises, pas d'images externes, liens en `rel="noopener noreferrer nofollow"`).
- Si une dépendance UI injecte des `<style>`, ajouter `'unsafe-inline'` **à `style-src` seulement**, par ADR. Jamais à `script-src`.

### 3.11 Swagger et OpenAPI

- OpenAPI généré depuis Zod (ADR-010). L'UI `/api/docs` et le JSON ne sont montés que si `NODE_ENV !== 'production'` **et** `OPENAPI_UI_ENABLED=true`.
- Staging : UI accessible uniquement à une session ADMIN.
- Production : aucune route de documentation. Le fichier `openapi.json` est un artefact de CI, pas une ressource servie.

### 3.12 Host header et URL publiques

- Caddy ne sert que les hôtes déclarés (`api.<domaine>`, `api-staging.<domaine>`, `n8n.<domaine>`) ; tout autre `Host` reçoit une réponse vide (`abort`).
- Express : `trust proxy` limité aux sauts connus (Caddy, puis Vercel pour le trafic réécrit ; nombre réglé en PHASE-03 après vérification des en-têtes `X-Forwarded-*` transmis par Vercel). Comme `api.<domaine>` est aussi joignable directement, `X-Forwarded-For` peut être forgé : le rate limiting combine IP et identifiant de compte ou de session.
- Tout lien absolu (e-mails, callbacks OAuth, push) est construit depuis la variable `APP_ORIGIN` validée au démarrage, **jamais** depuis `Host` ou `X-Forwarded-Host`.

### 3.13 Appareils mobiles et PWA (téléphone volé)

- Le service worker ne met **jamais** en cache les réponses `/api/v1/*` (stratégie `NetworkOnly`).
- Le cache TanStack Query n'est pas persisté sur disque. La file hors ligne IndexedDB (ADR-016) ne contient que des créations d'idées, de notes et de tâches, jamais de donnée financière.
- `GET /me/sessions` affiche appareil, date et IP tronquée ; la révocation à distance est disponible dès PHASE-01.
- Alerte e-mail à chaque connexion depuis un nouvel appareil (empreinte = user-agent normalisé + préfixe IP).
- Les actions sensibles exigent la ré-authentification (§4), donc un téléphone déverrouillé ne suffit pas pour exporter, changer l'e-mail ou supprimer le compte.

---

## 4. Ré-authentification

- `POST /auth/reauth` avec `{ password }` (et `{ totpCode }` si MFA active, PHASE-13) met à jour `sessions.reauth_at` (et `mfa_verified_at`).
- Décorateur `@RequireReauth(maxAgeSeconds)` ; à défaut, `403 REAUTH_REQUIRED` avec `details.maxAgeSeconds`.

| Action | Fenêtre | MFA (après PHASE-13) |
|---|---|---|
| Changement d'e-mail | 10 min | si active |
| Export de données (`POST /exports`) | 10 min | si active |
| Demande de suppression du compte | 10 min | si active |
| Activation, désactivation de la MFA, régénération des codes de secours | 10 min | code TOTP courant exigé |
| Création de clé d'API (PHASE-14) | 10 min | obligatoire |
| Connexion ou déconnexion d'une intégration (PHASE-14) | 10 min | si active |
| Actions ADMIN de console : suspension, révocation de sessions d'un tiers (PHASE-17) | 10 min | obligatoire |
| Création, rotation, suppression d'un secret du coffre (PHASE-13) | 10 min | obligatoire |
| **Révélation d'un secret du coffre** | **5 min** | **obligatoire, `mfa_verified_at` ≤ 5 min** (ADR-019) |

---

## 5. MFA TOTP et codes de secours (PHASE-13)

### 5.1 TOTP

- RFC 6238 : SHA-1, 6 chiffres, pas de 30 s, tolérance ±1 pas.
- Anti-rejeu : `user_mfa_factors.last_used_step` ; un pas déjà consommé est refusé.
- Secret : 20 octets aléatoires, chiffré au repos par `DATA_KEK` (§8.6), AAD `user_id|factor_id|purpose=totp`.
- Enrôlement : `POST /me/mfa/totp/setup` (ré-auth) renvoie l'URI `otpauth://` une seule fois ; le facteur reste `PENDING` jusqu'à `POST /me/mfa/totp/activate` avec un code valide. Un facteur `PENDING` expire après 15 min.
- Connexion avec MFA active : `POST /auth/login` crée une session `mfa_pending = true` qui n'autorise que `POST /auth/mfa/verify` et `POST /auth/logout` ; durée de vie 5 min. Après vérification : rotation du jeton, `mfa_pending = false`.

### 5.2 Codes de secours

- 10 codes de 16 caractères base32 (80 bits), affichés **une seule fois** à l'activation et à la régénération.
- Stockés en SHA-256 (entropie suffisante, argon2 inutile) dans `mfa_recovery_codes`, usage unique, `used_at`.
- Utilisation d'un code : e-mail d'alerte ; à moins de 3 codes restants, bannière de régénération.

### 5.3 Politique

- La MFA est facultative pour `USER` et **obligatoire pour révéler un secret du coffre** (ADR-006, ADR-019).
- **Proposition à acter par ADR :** rendre la MFA obligatoire pour toute connexion du rôle `ADMIN` dès PHASE-13 (compte le plus exposé, porte la zone Dev).

### 5.4 Récupération d'un compte MFA sans facteur

Pas de récupération automatique. Procédure manuelle tracée : demande via e-mail du compte, délai de 72 h avec e-mail d'alerte et lien d'annulation, désactivation de la MFA par une commande CLI d'exploitation (jamais une route HTTP), audit `auth.mfa.recovery_override`. Pour le compte ADMIN lui-même : seulement via les codes de secours ou l'accès console au VPS.

---

## 6. Autorisation

### 6.1 Chaîne de guards (ordre fixe)

1. `RequestContextMiddleware` : génère `requestId` (UUIDv7).
2. `AuthGuard` (global) : résout la session ou la clé d'API ; peuple nestjs-cls `{ userId, role, requestId, authType, sessionId, apiKeyId }` (ADR-007 §2).
3. `CsrfGuard` (§3.9).
4. `RolesGuard` : `@Roles('ADMIN')`.
5. `ModuleEnabledGuard` : `user_preferences.enabled_modules` (ADR-024), sauf zone ADMIN.
6. `ApiKeyScopeGuard` : portée de la clé (PHASE-14).
7. `ReauthGuard` / `MfaGuard` (§4).
8. Pipe Zod (`nestjs-zod`) sur `params`, `query`, `body`.
9. Service applicatif : **policy** de propriété et de transition d'état.

### 6.2 Rôles et codes de réponse

| Cas | Réponse |
|---|---|
| Pas de session valide | `401 UNAUTHENTICATED` |
| Rôle insuffisant (`/dev/*`, `/admin/*`, `/api-keys`) | **`404 NOT_FOUND`** : un `USER` ne doit pas distinguer une route ADMIN d'une route inexistante. Audit `authz.role_denied`. |
| Ressource d'un autre utilisateur ou inexistante | **`404 NOT_FOUND`** (ADR-007 §7). Audit `authz.cross_user_attempt` si l'identifiant existe chez un autre utilisateur. |
| Module désactivé par l'utilisateur | `403 MODULE_DISABLED` (l'utilisateur connaît son propre réglage, aucune fuite). |
| Portée de clé d'API insuffisante | `403 API_KEY_SCOPE_DENIED` |
| Ré-authentification ou MFA manquante | `403 REAUTH_REQUIRED` / `403 MFA_REQUIRED` |
| Transition d'état interdite | `422 INVALID_STATE_TRANSITION` |

**403 n'est jamais utilisé pour signaler l'existence d'une ressource d'autrui.**

### 6.3 Policies de propriété

- Chaque service charge la ressource par `findFirst({ where: { id, userId } })` via le repository scopé ; absence → `NotFoundError`.
- Toute référence entrante (`accountId`, `projectId`, `categoryId`, `clientId`, `tagIds[]`…) est vérifiée de la même façon **avant** écriture ; les FK composites `(user_id, id)` (ADR-007 §4) sont le filet de sécurité, pas le contrôle principal. Une violation de FK composite est convertie en `404 NOT_FOUND`, jamais en `500`.
- Les policies de transition (facture émise non modifiable, transaction validée non supprimable…) vivent dans le domaine, pas dans le contrôleur. Voir `FINANCE_RULES.md`.

### 6.4 Clés d'API (PHASE-14)

- Format : `orbit_<prefix8>_<secret43>` ; stockage `prefix` en clair et `SHA-256(secret)` ; affichage unique à la création.
- Portées explicites, par exemple `ideas:write`, `notes:write`, `tasks:write`, `automations:run`, `calendar:read`. **Aucune portée** sur le coffre, l'administration, les exports, `/me`, les clés d'API, les opérations financières d'écriture.
- Expiration obligatoire (90 jours par défaut, 365 max) ; `last_used_at` ; révocation immédiate ; liste blanche d'IP facultative.
- Création réservée à `ADMIN` (PRODUCT_SCOPE M13) ; voir l'incohérence signalée en §22.

### 6.5 Mass assignment

- Chaque corps est validé par un schéma Zod **`.strict()`** : toute clé inconnue → `400 VALIDATION_FAILED`.
- Les schémas d'entrée ne contiennent jamais `userId`, `role`, `id`, `createdAt`, `updatedAt`, `version`, `status` dérivé, `balance`, `numéro de facture`, `keyVersion`. Ces valeurs viennent du contexte ou du domaine.
- Interdit : passer `dto` ou `req.body` tel quel à Prisma (`data: dto`). Les repositories reçoivent des commandes typées explicites. Règle de lint et de revue.
- Réponses : `select` explicite + schéma de réponse qui retire les clés inconnues (ADR-010). Champs jamais sérialisés : `password_hash`, `token_hash`, `wrapped_dek`, `ciphertext`, `nonce`, jetons OAuth, secrets TOTP.

### 6.6 Injection

- Prisma paramétré uniquement ; `$queryRaw` et `$executeRaw` limités à `platform/database/raw/` et écrits avec le gabarit `Prisma.sql` (jamais `$queryRawUnsafe`). Lint bloquant (ADR-007 §5).
- Recherche plein texte : `websearch_to_tsquery('simple', unaccent($1))` paramétré ; longueur de requête ≤ 200 caractères.
- Tri et filtres : listes blanches par endpoint (`API.md` §8) ; jamais de nom de colonne venant du client.

---

## 7. Isolation par `user_id` et confidentialité ADMIN

### 7.1 Couches de défense (ADR-007)

| Couche | Contrôle | Test qui la prouve |
|---|---|---|
| 1. Schéma | `user_id NOT NULL` sur toute table métier ; FK composites `(user_id, id)`. | Test de migration : liste des tables métier sans `user_id` = vide. |
| 2. Contexte | nestjs-cls `{ userId }` posé par `AuthGuard` ; jobs et webhooks le rejouent (ADR-007 §8). | Test unitaire : accès base sans contexte → exception. |
| 3. Extension Prisma `tenantScope` | Injection `user_id` dans `where` et `data` ; erreur si contexte absent ; `findUnique` par `id` seul interdit. | Tests unitaires de l'extension, y compris `update`, `delete`, `upsert`, `createMany`, `count`, `aggregate`, `groupBy`, transactions interactives. |
| 4. Policies de service | Vérification des références entrantes (§6.3). | Tests d'intégration par cas d'usage. |
| 5. Raw SQL confiné | Dossier `raw/`, revue obligatoire, `user_id` en premier paramètre de chaque fonction. | Lint + test d'intégration de chaque requête brute avec deux utilisateurs. |
| 6. Test d'isolation généré | Pour **chaque route** : l'utilisateur B tente lecture, modification, suppression et action sur la ressource de A → `404` et état de A inchangé (ADR-021). | Suite `isolation.e2e` générée depuis le registre des routes ; bloque la CI ; une route sans test fait échouer la CI. |
| 7. RLS PostgreSQL | Non activée ; réévaluation en PHASE-17 (ADR-007 §6). | — |

Tables globales sans `user_id` (liste fermée) : `currencies`, `feature_flags`, `webhook_events` avant résolution du destinataire. Toute autre exception exige une ADR.

### 7.2 Zone Dev et confidentialité ADMIN

- `@Roles('ADMIN')` sur tous les contrôleurs `/dev/*` et `/admin/*` (ADR-002). Les données Dev appartiennent à l'ADMIN et restent scopées par son `user_id`.
- La console `/admin/*` lit uniquement : `users.id`, e-mail, date d'inscription, statut, rôle, dernière connexion, compteurs agrégés (`usage_counters`). Elle utilise un **repository dédié non scopé** (`AdminAccountsRepository`) dont le `select` est figé et testé : un test échoue si un champ hors de cette liste apparaît.
- **Interdits absolus :** endpoint d'usurpation d'identité (« impersonation »), lecture du contenu d'un module d'un autre utilisateur, export du compte d'un tiers, accès aux documents d'un tiers. Aucune exception, y compris pour le support : l'aide se fait avec l'utilisateur, sur son écran.
- Accès base de données de production : réservé à la procédure d'incident (§19), en lecture, journalisé dans le registre d'incident ; jamais pour consulter des données personnelles par curiosité.
- Toute action de console est auditée (§18) avec `actor_user_id` = ADMIN et `user_id` = compte cible.

---

## 8. Coffre-fort (PHASE-13, ADMIN)

### 8.1 Chiffrement par enveloppe (ADR-019)

| Élément | Spécification |
|---|---|
| Bibliothèque | `libsodium-wrappers-sumo` (ou `sodium-native`), jamais d'implémentation maison. |
| Algorithme | `crypto_aead_xchacha20poly1305_ietf` pour le contenu et pour l'enveloppe de la DEK. |
| DEK | 32 octets aléatoires **par version de secret** ; jamais persistée en clair ; effacée de la mémoire (`sodium_memzero`) après usage. |
| Nonce | 24 octets aléatoires par chiffrement (aucune réutilisation possible en pratique). |
| KEK | 32 octets, versionnée (`key_version`), chargée au démarrage depuis `/run/secrets/vault_kek_v<n>`. |
| AAD | Chaîne canonique `orbit.vault|v=<format_version>|u=<user_id>|i=<item_id>|k=<key_version>` (UTF-8), identique pour le contenu et la DEK enveloppée. Un payload déplacé vers un autre item ou utilisateur échoue au déchiffrement. |
| Stockage | `vault_secret_payloads` : `item_id`, `user_id`, `version`, `ciphertext`, `nonce`, `wrapped_dek`, `dek_nonce`, `key_version`, `format_version`, `created_at`, `destroyed_at`. Métadonnées dans `vault_items` (titre, type, identifiant non secret, ressource liée, expiration, dates de rotation, notes **non sensibles**). |
| Taille max | 64 Kio par secret (clés SSH, certificats). |

### 8.2 Opérations

- **Création / rotation :** valeur reçue une seule fois dans le corps, chiffrée immédiatement, jamais renvoyée. La rotation crée une nouvelle version ; l'ancienne est conservée **30 jours** puis détruite par effacement de `wrapped_dek` et `ciphertext` (crypto-shredding).
- **Révélation :** `POST /dev/vault/items/:id/reveal` ; exige ré-auth ≤ 5 min et MFA ≤ 5 min ; rate limit §3.7 ; réponse `Cache-Control: no-store` ; valeur jamais journalisée ; le front masque la valeur après 30 s et efface le presse-papiers après 60 s ; les clés privées ne sont jamais affichées par défaut (bouton « afficher » explicite).
- **Suppression :** ré-auth ; destruction immédiate de toutes les versions (crypto-shredding) ; métadonnées en soft delete 30 jours pour l'audit.
- **Exclusions :** le coffre est exclu des exports ordinaires, de la recherche, du dashboard, des notifications, des automatisations, de l'IA, des clés d'API (§4.8).
- **Détection d'anomalie :** plus de 5 révélations en 10 min, révélation depuis un nouvel appareil, ou échec de déchiffrement → notification sécurité à l'ADMIN et audit `warn`.

### 8.3 Rotation de la KEK

1. Générer `vault_kek_v<n+1>` hors ligne ; le déposer comme secret monté ; redémarrer API et worker (les deux versions sont chargées).
2. Commande CLI `vault:rewrap --to <n+1>` (pas de route HTTP) : déchiffre chaque DEK avec l'ancienne KEK, la ré-enveloppe avec la nouvelle, dans une transaction par item, de manière idempotente et reprenable.
3. Vérifier `SELECT count(*) WHERE key_version < n+1` = 0 ; retirer l'ancienne KEK du serveur ; conserver sa copie hors ligne 90 jours.
4. Auditer `vault.kek.rotated`. Fréquence : annuelle, et immédiatement en cas de suspicion de compromission.

### 8.4 Garde de la clé maître

- Fichier `vault_kek_v<n>` : propriétaire = UID du processus API dans le conteneur, mode `0400`, monté en lecture seule ; jamais dans l'image, le dépôt, l'environnement (`process.env`), les logs ou la sauvegarde restic de la base (ADR-019).
- **Copie hors ligne :** impression papier (base64 + empreinte SHA-256) et clé USB chiffrée, conservées en deux lieux physiques distincts du propriétaire. Testée en PHASE-13 par une restauration sur staging.
- **Perte de la KEK sans copie = perte définitive de tous les secrets du coffre.** C'est un risque accepté, documenté dans l'interface du coffre.

### 8.5 Démarrage

L'API refuse de démarrer si une KEK attendue est absente, de mauvaise taille ou lisible par « others ». Le coffre est désactivé (`503`) plutôt que de fonctionner en mode dégradé.

### 8.6 Autres clés applicatives

| Clé | Usage | Emplacement | Perte |
|---|---|---|---|
| `DATA_KEK_v<n>` | Jetons OAuth, secrets TOTP, jetons de canaux webhook | Secret monté, même règles que §8.4 | Intégrations à reconnecter, MFA à réenrôler (§5.4). |
| `RATE_LIMIT_HMAC_KEY` | Pseudonymisation IP/e-mail dans les compteurs | Secret monté | Compteurs remis à zéro, sans gravité. |
| `AUDIT_PSEUDONYM_KEY` | Pseudonymisation des journaux après suppression de compte | Secret monté + copie hors ligne | Pseudonymes non recalculables. |

La même enveloppe XChaCha20-Poly1305 est utilisée, avec un `purpose` distinct dans l'AAD. Une clé ne sert qu'à un seul usage.

---

## 9. Protection des données

### 9.1 Minimisation

- Collecter : e-mail, nom d'affichage facultatif, préférences. Pas de téléphone avant PHASE-16 (WhatsApp, avec consentement).
- IP stockée tronquée (§3.2) ; user-agent tronqué ; aucune géolocalisation.
- Les données de tiers saisies par l'utilisateur (contreparties, clients, contacts) sont sous sa responsabilité ; elles ne sont jamais réutilisées hors de son espace.

### 9.2 Classification

| Classe | Exemples | Règles |
|---|---|---|
| C4 Secret | Valeurs du coffre, KEK, jetons OAuth, secrets TOTP, mots de passe, jetons de session/reset | Chiffré ou haché ; jamais en log, export, IA, notification, Redis. |
| C3 Sensible | Finances, journal, notes, documents, e-mails importés, messages WhatsApp | Scopé `user_id` ; jamais dans Redis (sauf identifiants) ; IA seulement sur demande de l'utilisateur. |
| C2 Personnel | E-mail, nom, IP tronquée, contreparties | Minimisé ; masqué dans les logs. |
| C1 Interne | Identifiants UUID, statuts, compteurs | Libre en logs. |

### 9.3 Logs (pino)

- JSON structuré, `requestId`, `userId` (UUID seul), route **paramétrée** (`/finance/transactions/:id`), statut, durée.
- **Jamais journalisés :** corps de requête et de réponse, query string complète, cookies, en-têtes `Authorization`, `Cookie`, `Set-Cookie`, `X-Hub-Signature-256`, `X-Goog-Channel-Token`.
- Configuration `redact` obligatoire (remplacement par `[REDACTED]`) :

```ts
redact: {
  paths: [
    'req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]',
    'req.headers["x-hub-signature-256"]', 'req.headers["x-goog-channel-token"]',
    '*.password', '*.currentPassword', '*.newPassword', '*.token', '*.accessToken',
    '*.refreshToken', '*.secret', '*.value', '*.totpCode', '*.recoveryCode',
    '*.apiKey', '*.email', '*.iban', '*.content', '*.body',
  ],
  censor: '[REDACTED]',
}
```

- Les erreurs renvoyées au client ne contiennent ni pile, ni message Prisma, ni SQL (`API.md` §5). La pile est journalisée côté serveur, avec `requestId`.
- Test CI : une requête de connexion, de reset, de création de secret et de connexion OAuth est rejouée et la sortie de log est analysée ; la présence d'une valeur de test (`TEST_SECRET_…`) fait échouer la CI.
- Rétention : 30 jours (fichiers ou agrégateur), puis suppression.

### 9.4 Redis (PHASE-08+)

- Contenu autorisé : payloads de jobs conformes à ADR-012 (identifiants uniquement), compteurs de rate limit pseudonymisés, verrous. **Aucune donnée C3/C4.**
- Les `failed` jobs BullMQ conservent leur erreur : les messages d'erreur sont nettoyés de toute donnée (même règle que les logs). Rétention : 7 jours (`removeOnFail: { age: 604800 }`), succès 24 h.

### 9.5 Jetons OAuth (PHASE-14)

- Chiffrés par `DATA_KEK` (§8.6), AAD `user_id|integration_id|purpose=oauth`. Refresh token jamais renvoyé au front.
- Flux : Authorization Code + PKCE (S256) + `state` aléatoire de 32 octets stocké côté serveur, lié à la session et au fournisseur, valable 10 min, usage unique.
- Scopes minimaux (§4.21) ; liste exacte dans `INTEGRATIONS.md`. **Attention :** les scopes Gmail sont « restricted » chez Google et imposent une vérification d'application et une évaluation de sécurité tierce pour une application publique ; à arbitrer avant PHASE-14.
- Déconnexion : révocation auprès du fournisseur, puis destruction locale des jetons ; audit.

### 9.6 Exports

- Ré-authentification ; rate limit ; audit `export.requested` et `export.downloaded`.
- Contenu : données de l'utilisateur seulement ; **coffre exclu** ; jetons, hachages et secrets exclus.
- CSV : toute cellule commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot est préfixée par `'` (injection de formules).
- Fichier stocké privé (ADR-013), disponible 24 h, puis supprimé.

---

## 10. Uploads (PHASE-09)

| Contrôle | Règle |
|---|---|
| Transport | Multipart via l'API (Multer, stockage disque temporaire hors webroot), pas d'URL de dépôt présignée. |
| Taille | 20 Mio par fichier ; 1 fichier par requête ; quota par utilisateur en PHASE-17. Rejet → `413 PAYLOAD_TOO_LARGE`. |
| Type | Détection par octets magiques (`file-type`), jamais par extension ni `Content-Type` déclaré. Liste blanche : PDF, PNG, JPEG, WebP, HEIC, TXT, CSV, DOCX, XLSX, ODT, ODS. Refus explicite : SVG, HTML, XML, JS, exécutables, archives. Rejet → `415 FILE_TYPE_NOT_ALLOWED`. |
| Documents Office | Ouverture zip bornée (taille décompressée ≤ 100 Mio, ≤ 1 000 entrées) ; refus si macros (`vbaProject.bin`). |
| Nom | Le nom d'origine est normalisé (NFC, caractères de contrôle et `/\:*?"<>|` retirés, 255 octets max) et stocké en métadonnée seulement. Clé de stockage = `u/<user_id>/d/<uuidv7>`, générée par le serveur. |
| Intégrité | SHA-256 calculé côté serveur (`documents.checksum`). |
| Antivirus | ClamAV (`clamd`) en conteneur si la RAM du VPS le permet (≥ 4 Gio libres) ; sinon décision écrite dans le rapport de PHASE-09. Fichier détecté → refus et audit. |
| Service | URL signée ≤ 5 min (ADR-013), `Content-Disposition: attachment; filename*=UTF-8''…`, `Content-Type` = type détecté, `X-Content-Type-Options: nosniff`. Affichage inline autorisé seulement pour PNG/JPEG/WebP/PDF. |
| Images | Métadonnées EXIF retirées à l'upload (position GPS). |
| Suppression | Soft delete 30 jours, puis suppression physique de l'objet (job PHASE-09) ; politique documentée (§4.17). |

---

## 11. SSRF

- **Aucune fonctionnalité ne télécharge une URL arbitraire fournie par l'utilisateur.** Les URL des environnements et applications (M11) sont stockées et affichées, jamais appelées par le serveur.
- Tout appel sortant passe par un unique `SafeHttpClient` :
  - HTTPS uniquement ; liste blanche d'hôtes par intégration (Google, Meta, Anthropic, fournisseur e-mail, stockage) ;
  - résolution DNS puis refus des plages privées, loopback, link-local, CGNAT, multicast, `169.254.169.254`, IPv6 ULA ; connexion à l'IP vérifiée (anti DNS rebinding) ;
  - redirections désactivées (ou revalidées à chaque saut, 3 max) ;
  - timeout 10 s, réponse ≤ 5 Mio ;
  - en-têtes sortants sans cookie ni secret non requis.
- Les automatisations (PHASE-15) n'ont **pas** d'action « requête HTTP libre » ; seules les intégrations autorisées sont appelables (§4.22).
- Le réseau Docker du worker n'accède pas à l'API d'administration de Docker ni aux métadonnées du fournisseur.

---

## 12. Webhooks entrants (PHASE-14, PHASE-16)

| Étape | Règle |
|---|---|
| Corps brut | `express.raw({ type: '*/*', limit: '256kb' })` monté **uniquement** sur `/api/v1/webhooks/*`, avant le parseur JSON. |
| Authentification | HMAC-SHA256 sur le corps brut avec le secret du fournisseur, comparaison `crypto.timingSafeEqual`. Variantes par fournisseur : WhatsApp Cloud API = `X-Hub-Signature-256` (secret d'application) ; Google Calendar push = `X-Goog-Channel-Token` (32 octets aléatoires par canal, chiffré par `DATA_KEK`) + `X-Goog-Channel-ID` connu. Échec → `401 WEBHOOK_SIGNATURE_INVALID`, audit `warn`, pas de détail. |
| Fraîcheur | Si le fournisseur signe un horodatage : tolérance ±5 min. Sinon : rejet des événements dont l'horodatage métier a plus de 24 h. |
| Déduplication | `webhook_events` avec contrainte unique `(provider, external_event_id)` ; doublon → `200` sans retraitement. |
| Traitement | Enregistrer l'événement (identifiants + empreinte SHA-256 du corps, contenu C3 limité au strict nécessaire), répondre `200` en < 2 s, puis traiter en job avec `userId` résolu côté serveur (ADR-007 §8). Le corps n'est **jamais** source de vérité pour Google : le worker relit l'état via l'API Google. |
| Résolution du destinataire | Par identifiant externe connu (canal Google, numéro WhatsApp vérifié). Inconnu → `200` et abandon journalisé (aucune indication à l'émetteur). |
| Contenu | Données non fiables : jamais exécutées comme commande ; aucune écriture financière sans proposition confirmée (§13). |
| Rétention | Lignes `webhook_events` : 30 jours. |

---

## 13. IA et prompt injection (PHASE-16, ADR-025)

### 13.1 Règle du « trifecta »

Une même exécution d'agent ne doit **jamais** combiner les trois : (1) accès à des données privées, (2) exposition à du contenu non fiable (notes, e-mails, WhatsApp, documents, pages web), (3) un canal capable de faire sortir des données (requête HTTP, envoi d'e-mail ou de message, rendu d'image ou de lien distant, écriture visible par un tiers).

Conséquences dans ORBIT :
- Le modèle n'a **aucun outil de sortie** : pas de requête HTTP, pas d'envoi d'e-mail ou de WhatsApp, pas de webhook. Les brouillons d'e-mail restent des brouillons.
- La sortie du modèle est rendue en **texte** ou via `SafeMarkdown` **sans images distantes ni liens cliquables automatiques** (anti-exfiltration par URL).
- Les outils sont en lecture seule sur les données de l'utilisateur courant (mêmes repositories scopés, mêmes policies), ou produisent des **propositions**.

### 13.2 Outils et propositions

- Outils à schéma Zod strict ; aucun SQL, aucune requête libre ; résultats tronqués (≤ 50 éléments, ≤ 20 000 caractères).
- Toute écriture produit une ligne `ai_proposals` (`PENDING`, payload validé, expiration 24 h). L'utilisateur confirme via `POST /ai/proposals/:id/confirm` ; le serveur **revalide** le payload et les policies au moment de la confirmation, avec clé d'idempotence. Écriture financière : toujours confirmée (ADR-025), sans exception configurable avant une ADR dédiée.
- Contexte transmis : minimal, construit par le serveur ; jamais de secret du coffre, de jeton, de hachage, d'e-mail d'un tiers inutile. Le contenu non fiable est délimité et étiqueté comme données.
- Le prompt système n'est **pas** une frontière de sécurité : les contrôles sont dans le code.

### 13.3 Confidentialité IA

- IA **désactivée par défaut** ; activation explicite par l'utilisateur (consentement), désactivable à tout moment (`user_preferences`).
- Rétention : contenu des `ai_requests` 30 jours, puis métadonnées seules (jetons consommés, statut).
- Vérifier et documenter dans `INTEGRATIONS.md` la politique de conservation d'Anthropic et la région de traitement avant activation (§8.3).
- Audit : `ai.request`, `ai.proposal.confirmed`, `ai.proposal.rejected`.

### 13.4 Capture multicanale

- WhatsApp : seul un numéro vérifié par code (lien explicite au compte) est accepté ; tout autre émetteur est ignoré. Un message crée au plus une capture (idée, note, tâche) ou une proposition.
- Voix : transcription en étape séparée, audio supprimé après transcription (ou 24 h au plus), consentement préalable.

---

## 14. Automatisations (PHASE-15)

- Chaque exécution porte `userId`, `ruleVersion`, une clé d'idempotence `(rule_id, trigger_event_id, action_index)`.
- Retries : 5 au maximum, backoff exponentiel ; puis dead-letter et notification. Timeout 30 s par action.
- Garde anti-boucle : une exécution déclenchée par une automatisation porte `depth` ; refus au-delà de 3. Plafond de 100 exécutions par règle et par heure.
- Actions financières : uniquement « proposer une transaction » (proposition à confirmer). Actions destructives : interdites.
- Une règle désactivée ne lance plus rien ; les exécutions en cours se terminent puis s'arrêtent avant l'action suivante.

---

## 15. Durcissement de l'infrastructure

### 15.1 VPS

- Debian stable ou Ubuntu LTS ; `unattended-upgrades` actif pour la sécurité ; redémarrage planifié si noyau mis à jour.
- SSH : clé ed25519 seulement, `PermitRootLogin no`, `PasswordAuthentication no`, utilisateur de déploiement dédié, port standard derrière pare-feu ; `fail2ban` sur SSH.
- Pare-feu (nftables/ufw) : entrants 22, 80, 443 uniquement. **Attention :** Docker contourne ufw ; ne publier aucun port de conteneur autre que Caddy (`ports:` absent partout ailleurs, y compris pour n8n et Uptime Kuma).
- Accès console du fournisseur protégé par MFA ; alerte de connexion.
- Horloge NTP synchronisée (TOTP, expirations).

### 15.2 Docker

- Images de base épinglées par digest ; utilisateur non root (`USER node`) ; `read_only: true` + `tmpfs` pour `/tmp` ; `cap_drop: [ALL]` ; `security_opt: [no-new-privileges:true]` ; limites mémoire et CPU.
- Socket Docker jamais monté dans un conteneur.
- Réseaux : `edge` (Caddy ↔ API, Caddy ↔ n8n) et `internal` (API, worker, Postgres, Redis, ClamAV) avec `internal: true`. n8n n'est **jamais** sur le réseau `internal` : il n'atteint ORBIT que par `api.<domaine>` avec une clé d'API.
- `mem_limit` sur chaque service, selon le budget mémoire d'`INFRASTRUCTURE.md` §10.1.
- Secrets via `secrets:` Docker (fichiers), jamais via `environment:` pour les clés C4.
- Scan Trivy de chaque image en CI (échec sur `CRITICAL` corrigeable).

### 15.3 PostgreSQL

- Version majeure supportée ; `listen_addresses` sur le réseau interne ; `password_encryption = scram-sha-256` ; `pg_hba.conf` limité au sous-réseau Docker.
- Rôles : `orbit_migrator` (DDL, utilisé seulement par le job de migration), `orbit_app` (DML sur les tables métier, aucun DDL, pas de `SUPERUSER`, pas de `CREATEROLE`), `orbit_backup` (lecture pour `pg_dump`).
- `audit_logs` : `REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM orbit_app` + trigger qui lève une exception sur `UPDATE`/`DELETE` (§18). La purge de rétention s'exécute avec un rôle de maintenance.
- `statement_timeout = 15s` pour `orbit_app` ; `log_min_duration_statement` sans paramètres (`log_parameter_max_length = 0`) pour ne pas journaliser de données.

### 15.4 Redis

- Réseau interne uniquement, `protected-mode yes`, ACL avec utilisateur dédié et mot de passe long ; `default` désactivé.
- Commandes interdites pour l'utilisateur applicatif : `FLUSHALL`, `FLUSHDB`, `CONFIG`, `KEYS`, `DEBUG`, `SHUTDOWN`, `MODULE`.
- `maxmemory-policy noeviction` (exigence BullMQ) ; persistance AOF.

### 15.5 Caddy

- TLS automatique, TLS 1.2 minimum ; redirection HTTP → HTTPS ; en-têtes de l'API §3.10 ; `request_body max_size` = 25 Mio (uploads) ; journaux d'accès sans query string. Caddy ne sert plus le front (Vercel, ADR-038).
- `n8n.<domaine>` : authentification n8n obligatoire (MFA), inscription fermée, éditeur restreint par IP ou VPN ; seuls les chemins `/webhook/*` restent publics si un workflow en a besoin.

### 15.6 Vercel et Sentry

- Vercel : compte protégé par MFA ; aucune variable secrète exposée au navigateur (seulement `VITE_*` publiques) ; préversions protégées (*Deployment Protection*) et branchées sur l'API de staging, jamais sur la production ; `vercel.json` relu par `security-reviewer`.
- Sentry SaaS (région UE) : `sendDefaultPii: false`, `beforeSend` qui retire cookies, en-têtes d'auth, corps et chaînes de requête ; nettoyage côté serveur activé ; Session Replay désactivé.

---

## 16. Sauvegardes et clés

- restic (ADR-015) : `pg_dump` chiffré + objets de stockage + volume n8n, vers un fournisseur différent du VPS (si OD-7 retient Neon : sauvegardes Neon, plus un export logique hebdomadaire hors Neon chiffré par restic) ; rétention 7 quotidiennes, 4 hebdomadaires, 6 mensuelles.
- **Exclus de la sauvegarde restic :** `/run/secrets/*` (KEK, `DATA_KEK`, clés HMAC). Ils ont leur propre procédure de copie hors ligne (§8.4).
- Mot de passe du dépôt restic et identifiants du stockage de sauvegarde : gestionnaire de mots de passe du propriétaire + copie papier ; jamais sur le VPS en dehors du fichier secret de la tâche.
- Identifiants d'écriture de sauvegarde **sans droit de suppression** (append-only / object lock si le fournisseur le permet) : un VPS compromis ne peut pas effacer l'historique.
- Restauration testée avant la production (PHASE-03), puis **trimestriellement** sur staging, avec vérification du déchiffrement d'un secret de coffre de test (PHASE-13+). Compte rendu daté dans `INFRASTRUCTURE.md`.
- Alerte si aucune sauvegarde réussie depuis 26 h.
- Après suppression d'un compte, ses données disparaissent des sauvegardes à l'expiration de la rétention (6 mois au plus) ; cette durée est annoncée dans la politique de confidentialité.

---

## 17. Chaîne d'approvisionnement et agents IA de développement

### 17.1 Dépendances

- `pnpm-lock.yaml` versionné ; CI en `pnpm install --frozen-lockfile`.
- Scripts d'installation bloqués par défaut (pnpm 10) ; liste blanche explicite `onlyBuiltDependencies` (par exemple `argon2`, `prisma`, `@swc/core`, `esbuild`, `sodium-native`).
- Délai de maturité : Renovate `minimumReleaseAge: "7 days"` (et `minimumReleaseAge` de pnpm si disponible dans la version utilisée).
- `pnpm audit --audit-level=high` bloquant en CI ; exception seulement avec justification datée dans le rapport de phase.
- Nouvelle dépendance : justification dans la PR (besoin, popularité, mainteneurs, licence, alternative native). Pas de dépendance pour moins de 50 lignes de code évidentes.
- Renovate : regroupement hebdomadaire, fusion automatique interdite pour les dépendances de production.

### 17.2 Secrets dans le dépôt

- `gitleaks` en hook pre-commit et en CI (bloquant). `.env*` ignorés sauf `.env.example` sans valeur réelle.
- Jeux de tests : valeurs fictives préfixées `TEST_` (§4.8).

### 17.3 CI/CD

- GitHub Actions épinglées par SHA ; permissions `contents: read` par défaut ; secrets de déploiement limités à l'environnement `production` avec approbation manuelle.
- Artefacts : SBOM CycloneDX généré à chaque build de release.

### 17.4 Agents IA de développement

- Les agents n'ont **jamais** accès aux secrets de staging ou de production, ni au VPS, ni aux sauvegardes. Ils travaillent avec `.env.local` de développement (valeurs factices) et Mailpit.
- Tout code produit par un agent passe : lint, tests, `pnpm audit`, gitleaks, revue `security-reviewer` pour les zones listées en §20, puis validation humaine avant fusion sur la branche principale.
- Le contenu lu par un agent (documentation de dépendance, issue, page web) est une donnée non fiable : un agent n'exécute pas une instruction trouvée dans un fichier tiers et ne modifie jamais `SECURITY.md`, `DECISIONS.md`, la CI ou les règles de lint sans demande explicite du propriétaire.
- Interdit aux agents : désactiver un test d'isolation, ajouter `@Public()`, utiliser `$queryRawUnsafe`, assouplir la CSP, ajouter un scope OAuth, sans ADR.

---

## 18. Audit

### 18.1 Principes

- Table `audit_logs`, **append-only** (§15.3), écrite dans la même transaction que l'action lorsque l'action est en base.
- Champs : `id`, `occurred_at`, `user_id` (propriétaire concerné), `actor_user_id`, `actor_type` (`USER`, `ADMIN`, `SYSTEM`, `API_KEY`, `AUTOMATION`, `AI`), `action` (code stable), `resource_type`, `resource_id`, `request_id`, `ip_prefix`, `user_agent_hash`, `outcome` (`SUCCESS`, `DENIED`, `FAILED`), `metadata` (JSON, liste blanche de clés par action, **jamais** de valeur C3/C4).
- `resource_type`/`resource_id` sont des références de journal sans clé étrangère (la trace doit survivre à la suppression de la ressource) : exception assumée à ADR-018, à acter (§22).

### 18.2 Événements tracés (codes stables)

| Domaine | Actions |
|---|---|
| Authentification | `auth.register`, `auth.email.verified`, `auth.login.success`, `auth.login.failure`, `auth.login.locked`, `auth.logout`, `auth.session.revoked`, `auth.password.changed`, `auth.password.reset_requested`, `auth.password.reset`, `auth.email.change_requested`, `auth.email.changed`, `auth.reauth.success`, `auth.reauth.failure` |
| MFA | `auth.mfa.enrolled`, `auth.mfa.disabled`, `auth.mfa.verify_failure`, `auth.mfa.recovery_code_used`, `auth.mfa.recovery_codes_regenerated`, `auth.mfa.recovery_override` |
| Autorisation | `authz.cross_user_attempt`, `authz.role_denied`, `security.csrf_rejected`, `security.rate_limited` (échantillonné) |
| Finance | `finance.account.created/updated/archived`, `finance.transaction.created/validated/cancelled/updated`, `finance.transfer.created`, `finance.debt.*`, `finance.repayment.created`, `finance.recurring.*`, `finance.occurrence.confirmed` |
| Pro | `pro.invoice.issued/cancelled/updated`, `pro.invoice.payment_recorded`, `pro.contract.status_changed` |
| Données | `data.export.requested/downloaded`, `document.uploaded/deleted/purged`, `task.due_date_changed` |
| Coffre | `vault.item.created/updated/deleted`, `vault.secret.rotated`, `vault.secret.revealed`, `vault.decrypt_failure`, `vault.kek.rotated` |
| Intégrations | `integration.connected/disconnected/token_refresh_failed`, `webhook.signature_invalid`, `api_key.created/revoked/used_from_new_ip` |
| Automatisations / IA | `automation.rule.enabled/disabled`, `automation.run.failed`, `ai.request`, `ai.proposal.confirmed/rejected` |
| Administration | `admin.user.suspended/reactivated`, `admin.user.sessions_revoked`, `admin.feature_flag.changed`, `account.deletion.requested/cancelled/executed` |

### 18.3 Rétention

| Données | Durée |
|---|---|
| Audit sécurité et authentification | 24 mois |
| Audit finance, Pro, coffre | Durée de vie du compte |
| `login_events` | 12 mois |
| Logs applicatifs | 30 jours |
| `webhook_events` | 30 jours |
| Contenu `ai_requests` | 30 jours |
| Après suppression de compte | Audit conservé 12 mois avec `user_id` remplacé par `HMAC(AUDIT_PSEUDONYM_KEY, user_id)` et métadonnées C2 supprimées, puis purgé |

L'utilisateur consulte ses propres événements de sécurité (`GET /me/login-events`). ADMIN ne consulte que les événements d'administration et les métriques agrégées, jamais l'audit métier d'un autre utilisateur.

---

## 19. Réponse à incident

| Sévérité | Exemples | Délai de prise en charge |
|---|---|---|
| SEV1 | Fuite de données, accès inter-utilisateurs confirmé, compromission du VPS ou d'une clé | Immédiat |
| SEV2 | Vulnérabilité exploitable non exploitée, sauvegarde manquante > 48 h, intégration compromise | 24 h |
| SEV3 | Anomalie de sécurité sans exposition | 7 jours |

**Procédure :** 1. Détecter et ouvrir un registre d'incident daté (`INFRASTRUCTURE.md` §incidents). 2. Contenir : bascule en mode maintenance (Caddy), révocation globale des sessions (commande CLI `sessions:revoke-all`), révocation des clés d'API, déconnexion des intégrations, coupure de l'IA (`feature_flags`). 3. Préserver les preuves (copie des logs et de l'audit, instantané disque) avant correction. 4. Éradiquer : correctif, rotation des secrets touchés (base, Redis, OAuth client secret, clés fournisseurs, `DATA_KEK`, KEK du coffre si exposée). 5. Restaurer depuis sauvegarde vérifiée si l'intégrité est douteuse. 6. Notifier les utilisateurs concernés et évaluer l'information de la CDP (§20) ; avis juridique requis pour les délais. 7. Post-mortem sous 7 jours : cause racine, ligne ajoutée au modèle de menace (§2), test de non-régression.

**Contacts :** propriétaire (unique opérateur), fournisseur VPS, fournisseur de sauvegarde, Google/Meta/Anthropic pour la révocation des identifiants d'application.

---

## 20. Conformité : loi sénégalaise n° 2008-12 et CDP

**Ceci n'est pas un avis juridique.** Les points suivants sont à faire valider par une personne compétente avant l'ouverture publique des inscriptions (fin PHASE-17), et de préférence avant PHASE-03 pour l'hébergement.

| # | Point à faire valider | Hypothèse de travail technique |
|---|---|---|
| L1 | Formalités préalables auprès de la Commission de protection des données personnelles (CDP) : déclaration ou demande d'autorisation selon la nature des traitements (finances personnelles, journal, éventuelles données de santé dans les habitudes). | Préparer le registre des traitements (finalité, données, durée, destinataires, sous-traitants). |
| L2 | **Transfert hors du Sénégal** : hébergement UE (ADR-015), sous-traitants aux États-Unis (Anthropic, Google, fournisseur e-mail). Conditions de transfert vers un État assurant un niveau de protection suffisant ou autorisation de la CDP. | Lister pays et sous-traitants ; IA désactivée par défaut (§13.3). |
| L3 | Information des personnes : politique de confidentialité, finalités, durées (§18.3), droits. | Page publique avant PHASE-17. |
| L4 | Droits d'accès, de rectification, d'opposition, de suppression. | Export de compte et suppression (PHASE-17), modification du profil (PHASE-01). |
| L5 | Obligation de sécurité et de confidentialité ; éventuelle obligation de notification de violation. | Ce document ; procédure §19. |
| L6 | Données de tiers saisies par l'utilisateur (contacts, contreparties, clients) : rôle d'ORBIT (sous-traitant vs responsable). | Usage strictement personnel, aucune réutilisation. |
| L7 | Contrats de sous-traitance avec hébergeur, stockage, e-mail, IA, sauvegarde. | Accepter les DPA des fournisseurs ; les lister. |
| L8 | Mineurs : âge minimal d'inscription. | Case de confirmation d'âge (≥ 18 ans) à l'inscription, à confirmer. |
| L9 | Évolution du cadre : vérifier si un nouveau texte a remplacé ou complété la loi 2008-12 au moment de l'ouverture. | — |
| L10 | Utilisateurs résidant dans l'UE : applicabilité du RGPD. | Mêmes mesures ; registre commun. |

---

## 21. Checklist de sécurité par phase

Chaque case est une condition de la Definition of Done de la phase (voir `DEVELOPMENT_METHOD.md`). Le rapport de phase reprend la liste et la coche.

| Phase | Contrôles exigés |
|---|---|
| **PHASE-00** Socle | gitleaks pre-commit + CI ; `pnpm audit` bloquant ; lockfile figé ; `onlyBuiltDependencies` ; Renovate ; lint interdisant `$queryRaw*` hors `raw/`, `findUnique` métier, `dangerouslySetInnerHTML`, `Number()` sur montants ; pino + `redact` ; filtre d'exception global au format `API.md` §5 ; helmet ; Zod `.strict()` par défaut ; OpenAPI désactivé en production ; Actions épinglées par SHA ; `.env.example` sans secret. |
| **PHASE-01** Identité | Sessions §3.2 ; argon2id §3.3 avec sémaphore ; vérification e-mail, reset ; réponses uniformes §3.8 ; rate limits §3.7 ; CSRF §3.9 ; ré-authentification §4 ; `tenantScope` + nestjs-cls ; registre des routes publiques ; générateur de tests d'isolation ; audit `auth.*` ; test « secret absent des logs ». |
| **PHASE-02** Shell | CSP stricte §3.10 + Trusted Types en report-only ; service worker `NetworkOnly` pour `/api` ; pas de persistance du cache de requêtes ; `SafeMarkdown` (DOMPurify) ; gestion `401` → écran de connexion, `403 REAUTH_REQUIRED` → modale de ré-auth. |
| **PHASE-03** Production | Durcissement VPS, Docker, Postgres, Redis, n8n (§15) ; en-têtes du front dans `vercel.json`, préversions protégées, `Set-Cookie` vérifié à travers la réécriture (ADR-038) ; Sentry UE sans données personnelles ; HSTS ; Host strict ; `APP_ORIGIN` ; argon2 calibré ; sauvegardes restic chiffrées hors fournisseur, append-only, **restauration testée** ; alertes de sauvegarde ; Trivy ; secrets distincts par environnement ; validation juridique L1–L2 lancée. |
| **PHASE-04** Organisation | Tests d'isolation de toutes les routes ; FK composites sur tags et liens ; notes rendues via `SafeMarkdown` uniquement ; Idempotency-Key accepté pour la file hors ligne ; dépendances circulaires refusées. |
| **PHASE-05** Finance | Idempotency-Key obligatoire (§`API.md` §9) ; montants en chaîne, aucun `float` ; transactions SQL pour opérations composées ; validées non supprimables ; audit `finance.*` ; fast-check sur invariants ; aucune écriture financière hors ligne. |
| **PHASE-06** Dettes, récurrences | Idempotence par occurrence ; refus de sur-remboursement ; audit ; isolation. |
| **PHASE-07** Dashboard, recherche, exports | Recherche paramétrée et scopée ; coffre jamais indexé ; exports : ré-auth, rate limit, anti-injection CSV, expiration 24 h, audit. |
| **PHASE-08** Async | Payloads de jobs sans donnée (ADR-012) ; rejeu du contexte `userId` dans le worker ; Redis ACL interne ; rate limit migré vers Redis ; outbox ; notifications sans donnée sensible ; purge des sessions et jetons expirés. |
| **PHASE-09** Calendrier, documents | Uploads §10 ; URL signées ≤ 5 min ; ClamAV ou décision écrite ; EXIF retiré ; tests upload dangereux (SVG, polyglotte, zip bomb). |
| **PHASE-10** Pro | Totaux recalculés serveur ; facture émise non modifiable ; numérotation atomique ; paiements idempotents ; audit `pro.*` ; `If-Match` sur brouillons. |
| **PHASE-11** Objectifs, journal | Journal traité en C3 (pas d'aperçu dans les notifications) ; isolation. |
| **PHASE-12** Zone Dev | `@Roles('ADMIN')` sur tous les contrôleurs `/dev/*` ; test : un `USER` reçoit `404` sur chaque route Dev ; URL jamais appelées (SSRF) ; refus de secrets dans les notes (détection de motifs de clés, avertissement). |
| **PHASE-13** Coffre, MFA | §5 et §8 complets ; KEK hors base et hors sauvegarde, copie hors ligne testée ; tests : déchiffrement avec AAD altéré échoue, révélation sans MFA refusée, rate limit, aucun secret en log ; reset avec MFA (T28) ; revue `security-reviewer` obligatoire ; **aucun secret réel avant validation**. |
| **PHASE-14** Intégrations | PKCE + `state` ; jetons chiffrés `DATA_KEK` ; scopes minimaux validés ; `SafeHttpClient` ; webhooks §12 (signature, déduplication, rejeu) ; clés d'API §6.4 ; tests webhook forgé et rejoué. |
| **PHASE-15** Automatisations | Idempotence par action ; anti-boucle ; retries bornés ; aucune action HTTP libre ; actions financières en proposition. |
| **PHASE-16** IA, multicanal | §13 complet ; IA opt-in ; outils sans canal de sortie ; propositions confirmées et revalidées ; tests de prompt injection (note, e-mail, message WhatsApp contenant des instructions) ; numéro WhatsApp vérifié ; rétention 30 jours. |
| **PHASE-17** SaaS, conformité | Console ADMIN limitée aux métadonnées (test de `select`) ; aucune usurpation ; suppression de compte (délai de grâce 7 jours, purge, pseudonymisation de l'audit) ; export complet ; quotas ; Trusted Types bloquant ; réévaluation RLS (ADR-007 §6) et du poivre ; pentest externe ou revue indépendante ; validation juridique L1–L10 close ; `preload` HSTS. |

---

## 22. Incohérences et points à arbitrer

| # | Constat | Proposition |
|---|---|---|
| S1 | ADR-019 impose une KEK `root:600`, mais les conteneurs tournent en non-root : le processus ne pourrait pas la lire. | Propriétaire = UID applicatif, mode `0400` (§8.4). Nouvelle ADR. |
| S2 | PRODUCT_SCOPE M13 réserve les clés d'API à ADMIN, alors qu'ADR-006 les destine à n8n et aux intégrations et que M13 (intégrations) est ouvert à tous : un `USER` ne peut pas brancher n8n. | Confirmer ADMIN seul (H-hypothèse) ou ouvrir des portées limitées aux `USER`. |
| S3 | `audit_logs` a besoin d'une référence polymorphe (`resource_type`, `resource_id`), interdite par ADR-018. | Exception explicite pour l'audit, sans FK. |
| S4 | §4.25 (import avec prévisualisation) n'a ni module ni phase dans PRODUCT_SCOPE. | Assigner (PHASE-07 ou PHASE-17) ou exclure. |
| S5 | La MFA n'est pas obligatoire pour ADMIN, compte qui porte la zone Dev et la console. | ADR rendant la MFA obligatoire pour ADMIN dès PHASE-13. |
| S6 | Les scopes Gmail « restricted » imposent une vérification Google et un audit de sécurité tiers pour une application publique. | Arbitrer avant PHASE-14 (Gmail réservé à l'ADMIN en mode « test », ou budget d'audit). |
| S7 | `PRODUCT_SPEC.md` §5.5 prévoit `vault_access_logs`, absente de PRODUCT_SCOPE M12. | L'audit du coffre utilise `audit_logs` (§18). |
