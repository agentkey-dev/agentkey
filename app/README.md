# AgentKey V1

Hosted multi-tenant SaaS for provisioning SaaS tool access to AI agents at agentkey.dev. Human admins sign up, create an organization, register agents, approve tool requests, and audit every credential vend.

## Stack

- Next.js App Router
- Cloudflare Workers + Workers Assets via OpenNext
- Cloudflare D1 + Drizzle for app data
- Native email magic-link authentication with D1-backed sessions
- Cloudflare Workers AI for AI-assisted tool drafting
- Cloudflare Email Service and Turnstile
- AES-256-GCM encryption for stored credentials

## Required Environment

Copy `.env.example` to `.env.local` and set:

- `ENCRYPTION_KEY`
- `APP_URL` (required in production; optional in local development)
- `TURNSTILE_SECRET_KEY` (production)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (production)
- `NEXT_PUBLIC_BRANDFETCH_CLIENT_ID` (optional, enables Brandfetch logos on tool cards)

Generate the encryption key with:

```bash
openssl rand -base64 32
```

## Local Development

```bash
cd ..
npm install
npm run db:generate
npm run db:migrate:local
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

This repo is managed from the workspace root. Run the commands above from the root directory unless you are debugging the Next.js app package in isolation.

## Product Flows

- Sign up, create an organization, and land on `/dashboard`
- Invite teammates from `/dashboard/organization`
- Create agents and capture API keys once
- Add tools in either `shared` or `per_agent` credential mode
- Let agents call:
  - `GET /api/tools`
  - `POST /api/tools/:id/request`
  - `POST /api/tools/suggest`
  - `GET /api/tools/:id/credentials`
- Review pending access requests and tool suggestions from `/dashboard/requests`
- Configure Slack/Discord request alerts from `/dashboard/notifications`
- Inspect audit history from `/dashboard/audit`

## Scripts

- Root workspace commands are the default entrypoint:
  - `npm run dev`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run db:generate`
  - `npm run db:migrate`
  - `npm run db:migrate:local`
  - `npm run preview`
  - `npm run deploy`
- `npm run dev`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:migrate:local`
- `npm run preview`
- `npm run deploy`

## Notes

- App data is isolated per AgentKey organization.
- All organization members are full admins in V1.
- Shared tool credentials are rotated centrally; per-agent credentials are stored on approval.
