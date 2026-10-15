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
| `ideas_user_id_converted_project_id_fkey` | FK composite ON DELETE SET NULL (colonne) | ideas | 20261014000000_phase04_organization |
| `tasks_user_id_project_id_fkey` | FK composite ON DELETE SET NULL (colonne) | tasks | 20261014000000_phase04_organization |
| `tasks_user_id_idea_id_fkey` | FK composite ON DELETE SET NULL (colonne) | tasks | 20261014000000_phase04_organization |
| `f_unaccent(text)` | fonction IMMUTABLE | — | 20261014000000_phase04_organization |
| `ck_ideas__potential_score` | CHECK | ideas | 20261014000000_phase04_organization |
| `ck_ideas__description_len` | CHECK | ideas | 20261014000000_phase04_organization |
| `ck_ideas__title_not_blank` | CHECK | ideas | 20261014000000_phase04_organization |
| `ck_ideas__version` | CHECK | ideas | 20261014000000_phase04_organization |
| `ux_ideas__client_capture` | index unique partiel | ideas | 20261014000000_phase04_organization |
| `ix_ideas__user_captured` | index partiel | ideas | 20261014000000_phase04_organization |
| `ix_ideas__user_status` | index partiel | ideas | 20261014000000_phase04_organization |
| `ix_ideas__title_trgm` | index GIN trigramme | ideas | 20261014000000_phase04_organization |
| `ix_ideas__converted_project` | index partiel | ideas | 20261014000000_phase04_organization |
| `ck_projects__slug_format` | CHECK | projects | 20261014000000_phase04_organization |
| `ck_projects__dates` | CHECK | projects | 20261014000000_phase04_organization |
| `ck_projects__completed` | CHECK | projects | 20261014000000_phase04_organization |
| `ck_projects__color` | CHECK | projects | 20261014000000_phase04_organization |
| `ck_projects__version` | CHECK | projects | 20261014000000_phase04_organization |
| `ux_projects__slug` | index unique partiel | projects | 20261014000000_phase04_organization |
| `ix_projects__user_status` | index partiel | projects | 20261014000000_phase04_organization |
| `ck_tasks__done` | CHECK | tasks | 20261014000000_phase04_organization |
| `ck_tasks__due` | CHECK | tasks | 20261014000000_phase04_organization |
| `ck_tasks__not_own_parent` | CHECK | tasks | 20261014000000_phase04_organization |
| `ck_tasks__series` | CHECK | tasks | 20261014000000_phase04_organization |
| `ck_tasks__minutes` | CHECK | tasks | 20261014000000_phase04_organization |
| `ck_tasks__recurrence_complete` | CHECK | tasks | 20261014000000_phase04_organization |
| `ck_tasks__recurrence_syntax` | CHECK | tasks | 20261014000000_phase04_organization |
| `ck_tasks__description_len` | CHECK | tasks | 20261014000000_phase04_organization |
| `ck_tasks__title_not_blank` | CHECK | tasks | 20261014000000_phase04_organization |
| `ck_tasks__version` | CHECK | tasks | 20261014000000_phase04_organization |
| `ux_tasks__client_capture` | index unique partiel | tasks | 20261014000000_phase04_organization |
| `ux_tasks__series_occurrence` | index unique partiel | tasks | 20261014000000_phase04_organization |
| `ix_tasks__project` | index partiel | tasks | 20261014000000_phase04_organization |
| `ix_tasks__parent` | index partiel | tasks | 20261014000000_phase04_organization |
| `ix_tasks__next_occurrence` | index partiel | tasks | 20261014000000_phase04_organization |
| `ck_task_dependencies__not_self` | CHECK | task_dependencies | 20261014000000_phase04_organization |
| `orbit_task_dependencies_no_cycle()` | fonction | — | 20261014000000_phase04_organization |
| `trg_task_dependencies__no_cycle` | déclencheur (verrou consultatif par utilisateur) | task_dependencies | 20261014000000_phase04_organization |
| `ck_tags__name_len` | CHECK | tags | 20261014000000_phase04_organization |
| `ck_tags__color` | CHECK | tags | 20261014000000_phase04_organization |
| `ck_notes__content_len` | CHECK | notes | 20261014000000_phase04_organization |
| `ck_notes__version` | CHECK | notes | 20261014000000_phase04_organization |
| `ux_notes__client_capture` | index unique partiel | notes | 20261014000000_phase04_organization |
| `ix_notes__user_updated` | index partiel | notes | 20261014000000_phase04_organization |
| `ix_notes__pinned` | index partiel | notes | 20261014000000_phase04_organization |
| `ck_note_links__one_target` | CHECK | note_links | 20261014000000_phase04_organization |
| `ux_note_links__idea` | index unique partiel | note_links | 20261014000000_phase04_organization |
| `ux_note_links__project` | index unique partiel | note_links | 20261014000000_phase04_organization |
| `ux_note_links__task` | index unique partiel | note_links | 20261014000000_phase04_organization |
| `ix_tasks__open_due` | index partiel (tâches ouvertes, remplace `ix_tasks__user_status_due`) | tasks | 20261014000100_phase04_review_fixes |
| `ix_tasks__idea` | index partiel (FK `idea_id`) | tasks | 20261014000100_phase04_review_fixes |
| `ix_tasks__project_fk` | index partiel (FK `project_id`) | tasks | 20261014000100_phase04_review_fixes |
| `orbit_task_dependencies_no_cycle()` : `search_path` figé | fonction | — | 20261014000100_phase04_review_fixes |
| `ck_currencies__code` | CHECK | currencies | 20261015000000_phase05_finance_core |
| `ck_currencies__exponent` | CHECK | currencies | 20261015000000_phase05_finance_core |
| `ck_financial_accounts__opening` | CHECK | financial_accounts | 20261015000000_phase05_finance_core |
| `ck_financial_accounts__overdraft` | CHECK | financial_accounts | 20261015000000_phase05_finance_core |
| `ux_financial_accounts__name` | index unique partiel | financial_accounts | 20261015000000_phase05_finance_core |
| `orbit_financial_accounts_guard()` | fonction | — | 20261015000000_phase05_finance_core |
| `trg_financial_accounts__guard` | déclencheur (immutabilité devise et solde initial) | financial_accounts | 20261015000000_phase05_finance_core |
| `ck_transaction_categories__system` | CHECK | transaction_categories | 20261015000000_phase05_finance_core |
| `ck_transaction_categories__not_own_parent` | CHECK | transaction_categories | 20261015000000_phase05_finance_core |
| `ck_transaction_categories__class` | CHECK | transaction_categories | 20261015000000_phase05_finance_core |
| `ux_transaction_categories__name` | index unique NULLS NOT DISTINCT | transaction_categories | 20261015000000_phase05_finance_core |
| `ix_counterparties__name_trgm` | index GIN trigramme | counterparties | 20261015000000_phase05_finance_core |
| `ck_transactions__amount_positive` | CHECK | transactions | 20261015000000_phase05_finance_core |
| `ck_transactions__validated` | CHECK | transactions | 20261015000000_phase05_finance_core |
| `ck_transactions__cancelled` | CHECK | transactions | 20261015000000_phase05_finance_core |
| `ck_transactions__fee` | CHECK | transactions | 20261015000000_phase05_finance_core |
| `ck_transactions__refund` | CHECK | transactions | 20261015000000_phase05_finance_core |
| `ck_transactions__rate` | CHECK | transactions | 20261015000000_phase05_finance_core |
| `ck_transactions__economic_class` | CHECK | transactions | 20261015000000_phase05_finance_core |
| `ux_transactions__idempotency` | index unique partiel | transactions | 20261015000000_phase05_finance_core |
| `ix_transactions__description_trgm` | index GIN trigramme | transactions | 20261015000000_phase05_finance_core |
| `orbit_transactions_guard()` | fonction | — | 20261015000000_phase05_finance_core |
| `trg_transactions__guard` | déclencheur (garde transitions et fige champs clés) | transactions | 20261015000000_phase05_finance_core |
| `ck_ledger_entries__amount_positive` | CHECK | ledger_entries | 20261015000000_phase05_finance_core |
| `orbit_ledger_entries_guard()` | fonction | — | 20261015000000_phase05_finance_core |
| `trg_ledger_entries__guard` | déclencheur (append-only et insertion PENDING seule) | ledger_entries | 20261015000000_phase05_finance_core |
| `orbit_transactions_entries_shape()` | fonction | — | 20261015000000_phase05_finance_core |
| `trg_transactions__entries_shape` | déclencheur de contrainte déferrable | transactions | 20261015000000_phase05_finance_core |
| `trg_ledger_entries__entries_shape` | déclencheur de contrainte déferrable | ledger_entries | 20261015000000_phase05_finance_core |
| `ck_idempotency_keys__completed` | CHECK | idempotency_keys | 20261015000000_phase05_finance_core |
| `ck_projects__budget` | CHECK | projects | 20261015000000_phase05_finance_core |
| `ux_note_links__transaction` | index unique partiel | note_links | 20261015000000_phase05_finance_core |
| `ux_note_links__counterparty` | index unique partiel | note_links | 20261015000000_phase05_finance_core |
| `orbit_forbid_log_mutation()` : `search_path` figé | fonction | — | 20261015000000_phase05_finance_core |

`prisma migrate diff` signale toujours deux écarts attendus : les index BRIN (Prisma ne les modélise pas avec un nom fixe) et les trois FK `SET NULL (colonne)` (Prisma ne connaît que `SET NULL` sur toutes les colonnes, ce qui effacerait `user_id`). Toute migration générée doit être relue pour retirer les `DROP INDEX …_brin` et la réécriture de ces FK.
