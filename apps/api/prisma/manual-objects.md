# Registre des objets SQL manuels

Objets que Prisma ne sait pas exprimer, écrits à la main dans les migrations (DATA_MODEL.md §2.2). Le test `test/integration/database/schema-manual-objects.int.spec.ts` échoue si l'un d'eux manque après `prisma migrate deploy`. Toute migration qui ajoute un objet manuel met ce registre **et** la liste du test à jour.

| Objet | Type | Table | Migration |
|---|---|---|---|
| `ck_users__email_format` | CHECK | users | 20261012091116_phase01_identity |
| `ck_users__failed_login_count` | CHECK | users | 20261012091116_phase01_identity |
| `ux_users__single_admin` | index unique partiel | users | 20261012091116_phase01_identity |
| `ck_sessions__token_hash_len` | CHECK | sessions | 20261012091116_phase01_identity |
| `ck_sessions__expiry` | CHECK | sessions | 20261012091116_phase01_identity |
| `ck_sessions__revocation` | CHECK | sessions | 20261012091116_phase01_identity |
| `ix_sessions__user_active` | index partiel | sessions | 20261012091116_phase01_identity |
| `ck_email_verification_tokens__token_hash_len` | CHECK | email_verification_tokens | 20261012091116_phase01_identity |
| `ck_email_verification_tokens__expiry` | CHECK | email_verification_tokens | 20261012091116_phase01_identity |
| `ux_email_verification_tokens__active` | index unique partiel | email_verification_tokens | 20261012091116_phase01_identity |
| `ck_password_reset_tokens__token_hash_len` | CHECK | password_reset_tokens | 20261012091116_phase01_identity |
| `ck_password_reset_tokens__ttl` | CHECK | password_reset_tokens | 20261012091116_phase01_identity |
| `ux_password_reset_tokens__active` | index unique partiel | password_reset_tokens | 20261012091116_phase01_identity |
| `ck_user_preferences__currency_format` | CHECK | user_preferences | 20261012091116_phase01_identity |
| `ck_user_preferences__week_starts_on` | CHECK | user_preferences | 20261012091116_phase01_identity |
| `ck_login_events__email_hmac_len` | CHECK | login_events | 20261012091116_phase01_identity |
| `ix_login_events__email_hmac_time` | index partiel | login_events | 20261012091116_phase01_identity |
| `ix_login_events__time_brin` | index BRIN | login_events | 20261012091116_phase01_identity |
| `ck_audit_logs__metadata_size` | CHECK | audit_logs | 20261012091116_phase01_identity |
| `ck_audit_logs__entity` | CHECK | audit_logs | 20261012091116_phase01_identity |
| `ix_audit_logs__time_brin` | index BRIN | audit_logs | 20261012091116_phase01_identity |
| `orbit_forbid_log_mutation()` | fonction | — | 20261012091116_phase01_identity |
| `trg_login_events__append_only` | déclencheur | login_events | 20261012091116_phase01_identity |
| `trg_login_events__no_truncate` | déclencheur | login_events | 20261012091116_phase01_identity |
| `trg_audit_logs__append_only` | déclencheur | audit_logs | 20261012091116_phase01_identity |
| `trg_audit_logs__no_truncate` | déclencheur | audit_logs | 20261012091116_phase01_identity |
| `REVOKE UPDATE, DELETE, TRUNCATE … FROM orbit_app` | droits | login_events, audit_logs | 20261012091116_phase01_identity |
| Rôle `orbit_app`, `REVOKE … FROM PUBLIC`, privilèges par défaut | droits | — | 20261011000100_phase00_roles_and_privileges |
