# SweetGift Admin release

The existing Tilda page `155657526`, block `2494701881`, project `10826787`
embeds `admin-dashboard` from Supabase project `rvgvbxipccbkytmhltmi`.
The browser uses the existing `app.sweetgift.ru` EDGE gateway to avoid direct
cross-border connections from clients. No DNS, firewall or VPN changes are needed.

Before release, fetch the repository and publish the reviewed commit. Compare
the live Edge Function with its source; preserve any unreviewed differences.
Back up the live function, Tilda block and EDGE Caddyfile in protected storage.
Do not copy runtime customer data, sessions or secrets into the repository.

1. Run `node --test tests/admin-dashboard.test.cjs`, syntax checks and
   `git diff --check`.
2. Install the exact published `deploy/sweetgift-admin.caddy` on EDGE as
   `/etc/caddy/snippets/sweetgift-admin.caddy`. Import it only inside the existing
   `app.sweetgift.ru` block, before the application's fallback proxy. Validate
   a complete candidate configuration, then reload Caddy without restarting it.
3. Check gateway shell `200`, dashboard without a token `401`, CORS preflight
   `204`, invalid refresh token `400`, and disallowed paths/grants `404`.
   Confirm there is exactly one CORS allow-origin header, `Cache-Control:
   no-store`, and unchanged application/telephony service health.
4. Deploy the same commit's `supabase/functions/admin-dashboard/index.ts`.
   Preserve the existing `verify_jwt=false`: the shell and code request are
   public, while protected APIs independently call `auth.getUser` and require
   `app_metadata.role === "admin"`.
5. Replace only the Tilda block's `code` with `deploy/admin-shell.html`.
   Compare draft against the published block first; do not publish unrelated
   drafts. Re-read the saved block, publish just this page and fetch it publicly.
6. Verify the actual email-code sign-in and dashboard load in the owner's browser.
   Do not request codes in chat or log tokens, email addresses or request bodies.

For rollback, restore and redeploy the backed-up function and Tilda block, then
remove only this gateway import/snippet after confirming no client still needs
it. Validate and reload the backed-up Caddy configuration. Keep all existing
application routes and runtime data intact. A temporary network failure must
not clear a successfully established browser session, and retries must never
repeat an OTP, email or administrative write automatically.
