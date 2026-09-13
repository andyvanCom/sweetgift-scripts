# SweetGift Scripts project guide

## Purpose and architecture

- Public repository of frontend modules, Supabase Edge Functions, migrations and automations layered onto the existing SweetGift.ru Tilda site.
- Tilda remains responsible for pages, catalog, articles and checkout. The repository adds a manifest-driven loader, analytics/SEO/selection modules, Supabase-backed imports and RPC, precomputed article-product JSON, admin functions and scheduled reporting.
- Start with `README.md`; durable design references are `ARCHITECTURE.md`, `DATABASE.md`, `SCHEMA.md`, `FUNCTIONS.md` and `GIFT_QUIZ.md`. `APOLLO1_HANDOFF.md` is machine-transfer context, not a substitute for these source-of-truth documents.

## Key contracts

- `sweetgift-manifest.json` is the source of truth for enabled frontend modules and versions. After changing a frontend asset, increment its manifest version so jsDelivr/Tilda clients receive it.
- Supabase schema, RPC and cron changes must be represented by ordered files in `supabase/migrations/`; compare them with the remote migration history before applying anything.
- Article recommendations are precomputed by the backend and exported to `article-products-cache/`; frontend uses jsDelivr first and Edge/RPC only as fallback. The scheduled GitHub workflow may commit cache changes directly to `main`.
- This is a public repository. Never commit service-role/JWT values, SMTP credentials, tokens, cron secrets, customer data or production exports containing personal data. Runtime secrets belong in Supabase Secrets or protected environments.

## Verification and release

- Run syntax checks for every changed JavaScript file, validate `sweetgift-manifest.json`, run the relevant script tests, and finish with `git diff --check` and `git status --short`. Baseline examples are in `README.md`.
- After an approved push, verify the published page and the actual versioned JS/JSON URL served by jsDelivr. Do not edit production/Tilda or apply Supabase migrations unless the task explicitly authorizes it.
- Preserve generated cache files unless the task is specifically refreshing them; avoid hand-editing large generated sets when their exporter is the source.

## Working rules

- Read this guide first and then only the relevant linked document and files. Preserve unrelated work and keep task history out of permanent project documentation.
- Update this file after durable changes to the loader/manifest contract, data ownership, migrations, automation, deployment or security boundaries.
