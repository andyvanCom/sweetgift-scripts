# SweetGift Scripts project guide

## Purpose and architecture

- Public repository of frontend modules, Supabase Edge Functions, migrations and automations layered onto the existing SweetGift.ru Tilda site.
- Tilda remains responsible for pages, catalog, articles and checkout. The repository adds a manifest-driven loader, analytics/SEO/selection modules, Supabase-backed imports and RPC, precomputed article-product JSON, admin functions and scheduled reporting.
- Start with `README.md`; durable design references are `ARCHITECTURE.md`, `DATABASE.md`, `SCHEMA.md`, `FUNCTIONS.md` and `GIFT_QUIZ.md`. `APOLLO1_HANDOFF.md` is machine-transfer context, not a substitute for these source-of-truth documents.
- Infrastructure identity is maintained in the operational backend repository at `docs/infrastructure.md`: `95.84.134.160` is the Rostelecom home Keenetic address, `edge.voropaev.ru` is the Timeweb data-centre server at `201.24.53.162`, and `147.45.255.88` is the France data-centre server hosting NeuroMaria. Never identify the home address as the edge server or confuse the France server with the retired `3dhpv` host.

## Key contracts

- `sweetgift-manifest.json` is the source of truth for enabled frontend modules and versions. After changing a frontend asset, increment its manifest version so jsDelivr/Tilda clients receive it.
- `sweetgift-order-tracker.js` enriches the Tilda cart form before submission so connected CRM receivers get meaningful order context. Custom CRM fields use the `sg_` prefix, preserve genuine current/first-touch attribution and must never invent absent advertising identifiers. Keep personal fields in Tilda's native form flow; custom tracking may add only non-sensitive order, page and attribution context.
- `sweetgift-proposal.js` owns the verified-email PDF proposal dialog on the two composition selectors and the gift quiz. Producers publish only `source`, up to 12 catalog `productKeys`, and the target DOM mount through `sg:proposal-selection`; all names, prices, photos and composition are reloaded server-side. The JWT-protected `proposal-mailer` sends both verification codes and PDFs through the same protected Yandex SMTP secrets and sender used by the existing selector/admin mail flows. Keep SMTP and verification secrets out of this public repository.
- The Tilda gift quiz must load its browser core from the public `sweetgift-scripts` CDN asset `gift-quiz-core.v1.js`, not from `app.sweetgift.ru`. This keeps the selector UI available during an application-server or reverse-proxy outage; bump both the quiz module version and core query version when the browser core changes.
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
