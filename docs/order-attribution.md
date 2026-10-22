# Browser order attribution

`sweetgift-order-attribution.js` records first-touch ClientID, `_ym_uid`, yclid,
UTM source/medium/campaign/content/term, visit time, landing path and an explicit
`campaign_id` URL parameter when present. It runs only on sweetgift.ru and
www.sweetgift.ru. Queries/fragments and customer data are excluded from landing
URLs. It requests counter 18246130's getClientID early, preserves string IDs,
uses the genuine cookie as fallback, and retains context in memory if storage
is unavailable. First-touch context expires after 90 days; missing values stay
missing. A later ad click is not substituted for an already recorded first touch.

The existing tracker copies the context to `sg_original_*` hidden form fields
and submits an `attribution` object with `p_order` after Tilda's successful
checkout event. Tilda/CRM form mapping may ignore custom fields; the durable
Supabase record therefore supplies the backend independently of that mapping.
No token, contact, order note or payment assertion is captured by this module.
It does not call order_created/order_paid goals.

Migration `20261022094858_order_attribution_capture.sql` creates the closed
`neuromaria.order_attribution` table and augments the deployed product RPC
without replacing its item processing. The migration fails if the deployed
function's expected final-return marker has changed. Original payloads without
attribution remain valid. Identifiers on an order cannot be overwritten by a
retry. Service-only RPCs support server capture and unambiguous lookup by native
ORDERID or Tilda's TYYYYMM-number alias in the verified CRM creation month.

Validate locally:

```sh
node --test tests/sweetgift-order-attribution.test.js tests/sweetgift-order-tracker.test.js
node --check sweetgift-order-attribution.js
node --check sweetgift-order-tracker.js
npm install --prefix /private/tmp/sweetgift-attribution-verification --no-save @electric-sql/pglite
PGLITE_MODULE=/private/tmp/sweetgift-attribution-verification/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-order-attribution-db.mjs
git diff --check
```

The database script uses an isolated PostgreSQL/WASM instance and real roles,
grants and PL/pgSQL. It checks RPC compatibility, product deduplication, immutable
identity, PII allowlisting, anon denial, service access and ambiguous aliases.
It never connects to production.

Before rollout, compare remote migration history, back up the deployed RPC
definition/grants, apply the reviewed migration from pushed main, and verify
restricted access in staging or a rolled-back synthetic transaction. Then
release the main manifest/module SHA and verify actual jsDelivr contents.
The backend feature is in sweetgift-order-status-bot branch
`codex/metrika-order-attribution`; its `docs/order-attribution-metrika.md` defines
the protected webhook, existing amoCRM field mappings, proposed metadata field,
single active transport, old/new cohort split, payment evidence, rollout gates
and rollback. This capture release does not activate any Metrika sender or
disable the working ALBATO integration. Preserve private captured records on
rollback; restore only the backed-up RPC/module version as needed.
