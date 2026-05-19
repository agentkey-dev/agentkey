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

## Email Sending Check

Confirm `AUTH_EMAIL_FROM` is `AgentKey <login@agentkey.dev>` in
`app/wrangler.jsonc`, then request a magic link from `/sign-in`. In production
the app fails closed if the `EMAIL` binding is unavailable.

## Turnstile Check

Confirm `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are present as
Worker secrets, then submit `/sign-in` with the Turnstile widget. A missing or
invalid token must return a 400 response.

## Rollback By Worker Version

Rollback is version-only: use the Cloudflare Workers dashboard or API to promote
the previous known-good `agentkey` Worker version. Do not route traffic back to
Vercel, Neon, Clerk, or Upstash.
