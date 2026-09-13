# Supabase cron authentication

## Architecture

Scheduled HTTP jobs use one function-specific credential per Edge Function. The scheduler reads the credential at execution time from Supabase Vault and sends it in `x-sweetgift-run-secret`. The Edge Function reads the matching value from Edge Function Secrets and authenticates before creating a service-role client, parsing expensive input, making network requests or causing side effects.

| Function | Vault name | Edge Function Secret |
|---|---|---|
| `import-yml-products` | `sweetgift_product_import_run_secret` | `PRODUCT_IMPORT_RUN_SECRET` |
| `import-articles-index` | `sweetgift_article_import_run_secret` | `ARTICLE_IMPORT_RUN_SECRET` |
| `classify-articles` | `sweetgift_classify_articles_run_secret` | `CLASSIFY_ARTICLES_RUN_SECRET` |
| `send-daily-report` | `sweetgift_daily_report_run_secret` | `DAILY_REPORT_RUN_SECRET` |

Secret names are safe to document. Secret values are never stored in Git, SQL text, cron command literals, logs, fixtures, examples, prompts or reports.

## Transitional contracts

- New calls use `x-sweetgift-run-secret`.
- Article import, classification and reporting temporarily accept the legacy `x-report-secret` value from `REPORT_RUN_SECRET`.
- Product import temporarily accepts its old bearer/`apikey` value only when it matches `PRODUCT_IMPORT_LEGACY_RUN_SECRET`.
- `verify_jwt=false` remains necessary for this custom service-to-service contract; handler authentication is mandatory and fail-closed.

The product legacy value is currently present only in the production scheduler. Before deploying the dual-token product function, an operator must provision the same value as `PRODUCT_IMPORT_LEGACY_RUN_SECRET` in Edge Function Secrets without exposing it in Git, chat, shell arguments or logs. Without that entry, the existing product cron call will be rejected and zero-downtime compatibility is not guaranteed.

## Deployment and cutover

1. Confirm all new Vault and Edge secret names exist without reading values.
2. Provision `PRODUCT_IMPORT_LEGACY_RUN_SECRET` through the Dashboard from the protected operator copy.
3. Run local/isolated auth tests.
4. Deploy dual-token Edge Functions one at a time. Do not alter cron yet.
5. Validate missing and incorrect tokens are rejected and each new token is accepted using a side-effect-free harness or isolated project.
6. Replace each production cron command with the reviewed Vault template, one job at a time.
7. Observe scheduled execution and sanitized technical logs.
8. Remove legacy acceptance only after every cron/admin caller uses its dedicated token.
9. Revoke legacy secrets and verify scheduler metadata contains no literal credentials.

## Rotation

For one function at a time:

1. Generate a replacement in approved secret tooling.
2. Store matching copies in Vault and Edge Function Secrets.
3. Temporarily allow old and new consumer values.
4. Validate in an isolated environment.
5. Switch only that cron job's Vault reference or Vault value.
6. Observe successful execution.
7. remove the old consumer value and revoke it.

Never rotate the shared legacy `REPORT_RUN_SECRET` until all known cron and admin callers have migrated.

## Rollback

- Before cron cutover: redeploy the previous function; cron still uses legacy auth.
- After one cron cutover: restore that job's sanitized prior command while dual-token acceptance remains active.
- If authentication fails: stop the affected cutover, retain both credentials, restore the last known-good function/job pair, and investigate without logging headers.
- A rollback that restores a literal scheduler credential is temporary, access-controlled and time-boxed.

## Validation

Required tests:

- missing token is rejected;
- incorrect token is rejected;
- legacy token is temporarily accepted;
- function-specific token is accepted;
- authentication completes before service-role client creation or side effects;
- recursive article-import calls forward only supported run-auth headers.

Do not manually trigger production imports or classification for auth testing. Use local mocks, an isolated Supabase project/branch with synthetic data, or a genuinely side-effect-free validation mechanism.

## Concurrency

Authentication is independent of single-flight protection. Existing jobs use job logs but do not provide an atomic distributed lock at the Edge boundary. Add a reviewed database advisory-lock/RPC design separately after migration-ledger reconciliation; do not improvise a racy “check then insert” lock.
