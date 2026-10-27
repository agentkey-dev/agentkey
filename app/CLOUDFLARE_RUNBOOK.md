# Cloudflare Production Runbook

AgentKey runs on one production Cloudflare environment. Do not create a
persistent staging app; use local D1, `wrangler deploy --dry-run`, and
production smoke checks.

## Deploy

1. Run `npm run lint --workspace app`.
2. Run `npm test --workspace app`.
3. Run `npm run build --workspace app`.
4. Run `cd app && npx wrangler types ./cloudflare-env.d.ts --check --env-file /dev/null`.
5. Run `cd app && APP_URL=https://agentkey.dev npx opennextjs-cloudflare build`.
6. Run `cd app && APP_URL=https://agentkey.dev npx wrangler deploy --dry-run`.
7. Deploy with `npm run deploy --workspace app`.
8. Run `npm run smoke:production --workspace app`.

## D1 Migration

Generate migrations with `npm run db:generate --workspace app`, review the SQL,
then apply with `npm run db:migrate --workspace app`. Before destructive changes,
take a D1 backup or confirm D1 Time Travel coverage.

## Secret Rotation

Use `cd app && npx wrangler secret put NAME` for the replacement value, deploy if
the app code also changed, then run `cd app && npx wrangler secret list`. Only
these production secrets should remain: `ENCRYPTION_KEY`,
`NEXT_PUBLIC_BRANDFETCH_CLIENT_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
`TURNSTILE_SECRET_KEY`.

Do not replace `ENCRYPTION_KEY` alone: existing tool and webhook ciphertext
would become unreadable. Rotate that key only with a verified backup and a
coordinated migration that re-encrypts every stored secret and verifies it before
retiring the old key. Rotate individual tool credentials through the application.

## Email Sending Check

Confirm `AUTH_EMAIL_FROM` is `AgentKey <login@agentkey.dev>` in
`app/wrangler.jsonc`, then request a magic link from `/sign-in`. `APP_ENV` must
be `production` in Cloudflare. In production the app fails closed if the `EMAIL`
binding is unavailable.

## Turnstile Check

Confirm `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are present as
Worker secrets, then submit `/sign-in` with the Turnstile widget. A missing or
invalid token must return a 400 response. Production Turnstile responses must
have action `magic_link` and hostname `agentkey.dev`.

## Auth Model

AgentKey v1 has one organization role: `admin`. Every organization member is a
full admin and can approve grants, rotate agent keys, create/delete tools, and
manage credentials. Add RBAC before inviting users who should have read-only or
limited access.

Magic-link callback GET requests only display a confirmation page. A same-origin
POST consumes the one-time token and creates the session. Authentication forms
are limited to 8 KB. Administrative mutations must supply the configured
application Origin or valid same-origin Fetch Metadata; CLI diagnostics should
send `Origin: https://agentkey.dev` when exercising those browser endpoints.

The confirmation page uses `strict-origin` in both its Referrer-Policy header
and HTML meta tag. This keeps the token out of Referer headers while preserving
the Origin on native form submissions. Do not use `no-referrer` on that page:
browsers then submit `Origin: null`, which the sign-in origin check rejects.

Worker invocation logs redact query strings because callback URLs contain login
tokens. Keep `observability.redact_query_string` enabled. Credential vending logs
include the requesting client IP and bounded user agent, never credentials.

The production application has no organization-invitation sending or acceptance
flow. A third-party invitation using the AgentKey name is not evidence that an
application membership was created; inspect its destination and the production
membership records.

## Machine API Browser Integrity Check

Cloudflare Browser Integrity Check can reject normal Python `urllib` requests
with HTTP 403 and plain text `error code: 1010` before the Worker runs. This is
different from an application JSON 401/403, which indicates an authentication,
grant, or browser-origin failure.

Keep zone-wide Browser Integrity Check enabled and retain the zone custom WAF
rule with ref `agentkey_machine_api_skip_bic`. It skips only the `bic` product
for this expression:

```text
http.host eq "agentkey.dev" and http.request.method in {"GET" "POST" "OPTIONS"} and (http.request.uri.path in {"/api/me" "/api/tools"} or starts_with(http.request.uri.path, "/api/tools/"))
```

The rule uses `action: "skip"`, `action_parameters: { "products": ["bic"] }`,
and `logging: { "enabled": true }`. Do not add a phase or ruleset skip: managed
WAF, rate limits, and other custom rules must continue to run. Agent bearer-key,
organization, grant, and credential-origin checks remain enforced by the Worker.
The rule excludes browser authentication and admin routes. It is a zone setting,
so deploying or rolling back a Worker does not change it.

Run `npm run smoke:production --workspace app` after security-rule changes. It
checks Python, requests, curl, undici, and omitted User-Agent headers. Supplying
`AGENTKEY_API_KEY` in the environment also verifies authenticated catalog access
for those clients without printing credentials.

## D1 Mutation Semantics

Drizzle's D1 transaction path emits `BEGIN`, which the deployed Worker runtime
rejects. Production service mutations therefore run directly against the D1
executor today. Multi-write admin flows are not fully atomic until they are
rewritten around raw D1 `batch()`/SQL. Write authorization audit records before
enabling grants, and use conditional updates to avoid overwriting concurrent
decisions. A failed grant write can leave an audit record without enabling access.

## Rollback By Worker Version

Rollback is version-only: use the Cloudflare Workers dashboard or API to promote
the previous known-good `agentkey` Worker version. Do not route traffic back to
Vercel, Neon, Clerk, or Upstash.
