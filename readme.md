# AgentKey

> An experiment in access governance for AI agents — built by [elba](https://elba.security)'s [CTO](https://www.linkedin.com/in/antoine-berton-532519225/) to explore how agent identity and approval workflows might work.

Live demo: [agentkey.dev](https://agentkey.dev) · MIT licensed · Self-hostable on Vercel in three clicks.

AgentKey manages which SaaS tools (GitHub, Linear, Notion, Slack, Stripe, etc.) your AI agents can access — with human approval, encrypted credential vending, and full audit logging. Agents start with zero access and earn it through explicit human approval. Think of it as **Clerk for agent identity**.

Works with any agent framework, including OpenClaw, Claude Code, Cursor, Cline, the OpenAI Agents SDK, LangChain, and the Vercel AI SDK.

## Why AgentKey

Your AI agents need API keys for Stripe, GitHub, Linear, Slack. Today those keys are scattered across `.env` files with zero governance — no record of which agent has access to what, no approval workflow, no audit trail.

AgentKey's take:

- **Agent-driven catalog with human approval** — agents request tools they need, multiple agents can back the same suggestion, and a human approves before any credential is issued. Two agents independently request Linear? You see the demand and decide once.
- **Credentials are AES-256-GCM encrypted** and vended on demand — agents never store raw secrets
- **Every action is audited** — who requested what, who approved it, when credentials were fetched
- **One-click revoke** — immediate, no config changes needed
- **AI-powered setup guides** — step-by-step instructions for creating the right credential
- **Framework-agnostic** — any agent that can make HTTP requests works (OpenClaw, Claude Code, Cursor, Cline, the OpenAI & Vercel AI SDKs, LangChain, custom stacks)

### Why not just use Vault / Doppler / Infisical?

Those are secrets stores. AgentKey is an **approval and audit layer for agent identity**. The agent-driven catalog (agents request tools, humans approve once, demand surfaces naturally) doesn't exist in any secrets manager — they assume secrets are already provisioned and someone else decided who gets what. AgentKey can sit in front of any secrets store; it's the layer between "I have credentials" and "this specific agent should be able to use them."

## How it works

```
Agent boots up
  → checks AgentKey catalog ("what tools are available?")
  → requests access to Linear ("I need to create issues")
  → admin approves in the dashboard
  → agent fetches credential + usage guide on demand
  → everything is logged
```

Agents can also **suggest tools** that don't exist in the catalog yet. Multiple agents can back the same suggestion. The admin sees the demand and decides.

## Quick start

### Hosted demo

[agentkey.dev](https://agentkey.dev) — the running instance of this repo. Free to try. No guarantees on uptime; this is an experiment.

### Self-hosted — one-click on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/agentkey-dev/agentkey&env=DATABASE_URL,ENCRYPTION_KEY,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,KV_REST_API_URL,KV_REST_API_TOKEN&envDescription=Postgres,%20encryption%20key,%20Clerk,%20and%20Upstash%20Redis.%20See%20app/.env.example%20for%20details.&envLink=https://github.com/agentkey-dev/agentkey/blob/main/app/.env.example)

All three external dependencies are Vercel Marketplace integrations. From the Vercel dashboard, click to add each:

1. **Neon** (Postgres) — free tier covers a team
2. **Upstash** (Redis) — free tier covers a team
3. **Clerk** (auth) — free up to 10k monthly active users

Their env vars are auto-provisioned into your project. The only extra variable you set yourself is `ENCRYPTION_KEY` — generate it with `openssl rand -base64 32`.

### Self-hosted — local development

```bash
git clone https://github.com/agentkey-dev/agentkey.git
cd agentkey

cp app/.env.example app/.env.local
# Fill in:
#   DATABASE_URL              Postgres (Neon recommended)
#   ENCRYPTION_KEY            openssl rand -base64 32
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
#   KV_REST_API_URL, KV_REST_API_TOKEN   (Upstash Redis, free tier works)

npm install
npm run db:push
npm run dev
```

**Prerequisites:** Node.js 20+, PostgreSQL (Neon recommended), Upstash Redis (free tier), Clerk account.

The repo is managed from the root as an npm workspace. Use the root commands above; you should not need to `cd app` for normal development.

## Agent integration

When you create an agent in the dashboard, AgentKey generates a ready-to-paste markdown block for your agent's instructions file (`CLAUDE.md`, `TOOLS.md` for OpenClaw, `.cursorrules`, `AGENTS.md`, or its system prompt field). It looks like this:

````markdown
## Tool Access — AgentKey

You have access to AgentKey, a central service that manages your credentials
for external tools (GitHub, Linear, Notion, etc.).

**API endpoint:** https://agentkey.dev
**Your API key:** available in the AGENTKEY_API_KEY environment variable.

### How to use
1. Call `GET /api/tools` with header `Authorization: Bearer <AGENTKEY_API_KEY>`
   to see available tools and your access status.
2. If the tool exists in the catalog and you need access, call
   `POST /api/tools/{tool_id}/request` with `{"reason": "why you need it"}`.
3. If the tool you need does not exist, call `POST /api/tools/suggest` with
   `{"name": "...", "url": "...", "reason": "..."}`.
4. Once approved, call `GET /api/tools/{tool_id}/credentials` to get the
   credential and its company-specific usage guide.
5. After using a tool, share what you learned via
   `POST /api/tools/{tool_id}/instructions/suggest`.

### Important
- You start with access to **nothing**. Always check `GET /api/tools` first.
- Never hardcode credentials. Always fetch from AgentKey when you need them.
- Always read and follow the `instructions` field — it tells you how this
  specific company uses the tool.
````

That's it. No SDK, no wrapper, no framework lock-in. The agent handles the rest — checking the catalog, requesting access, fetching credentials when needed. Your agent's `AGENTKEY_API_KEY` env var is the only secret it ever sees.

## Architecture

```
app/                          # Next.js application
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── tools/        # Agent-facing API
│   │   │   ├── me/           # Agent identity endpoint
│   │   │   └── admin/        # Admin API (Clerk-protected)
│   │   ├── dashboard/        # Admin dashboard
│   │   ├── blog/             # Writeups
│   │   ├── legal/            # Terms, privacy policy
│   │   └── security/         # Security details
│   ├── components/           # UI components
│   └── lib/
│       ├── db/               # Drizzle ORM schema + client
│       ├── services/         # Business logic
│       ├── core/             # Config import/export, AI drafting
│       ├── crypto.ts         # AES-256-GCM encryption
│       ├── ratelimit.ts      # 4-tier rate limiting (Upstash)
│       ├── audit.ts          # Append-only audit log
│       └── agent-keys.ts     # SHA-256 hashed API keys
```

## Security

AgentKey stores third-party credentials. Security is the product.

| Layer | Implementation |
|-------|---------------|
| Edge protection | Cloudflare Enterprise — WAF (OWASP + Managed Rulesets), DDoS mitigation, exposed credential detection |
| TLS | Full (Strict) SSL, minimum TLS 1.2, TLS 1.3 + 0-RTT, HTTP/3 (QUIC) |
| Encryption at rest | AES-256-GCM, per-record random IV, 16-byte auth tag |
| API key storage | SHA-256 hashed, timing-safe comparison |
| Rate limiting | 4-tier sliding window (agent reads, requests, credentials, admin) + edge-level WAF rules |
| Security headers | CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, HSTS |
| Audit logging | Append-only, every action logged |
| Failed auth | Structured logging with IP, audit trail for suspended agents |

### Threat model & non-goals

AgentKey centralizes approval, audit, rotation, and revocation. When an agent fetches a credential, **it receives the actual secret over TLS** and uses it directly against the target service. AgentKey does not eliminate secret exposure at use time — that requires a proxy architecture, which is complementary, not the same thing.

If your threat model requires that agents never see raw secrets, you need a proxy. AgentKey can sit in front of one to handle the governance layer (who gets access, when, and with what audit trail).

Full details at [agentkey.dev/security](https://agentkey.dev/security).

## Key concepts

| Concept | Description |
|---------|-------------|
| **Agent-driven catalog** | Agents suggest tools they need. Multiple agents can back the same suggestion. The human is the approver, not the curator. |
| **Shared credential** | One credential for all agents (e.g., Linear API key). Admin enters it once, all approved agents receive it. |
| **Per-agent credential** | Each agent needs its own token (e.g., Discord bot token). Admin provides it when approving the request. |
| **Usage guide** | Company-specific context sent with the credential — API URLs, channel IDs, conventions, rules. Only loaded when the agent fetches the credential (context on demand). |
| **Schema discovery** | Agents can call GET on any POST endpoint to see the expected request format. Self-correcting API. |
| **AI setup guides** | Step-by-step instructions for creating credentials, tailored to the tool and agent use case. |

## Tech stack

- **Framework:** Next.js (App Router)
- **Database:** PostgreSQL (Neon)
- **Auth:** Clerk
- **Rate limiting:** Upstash Redis
- **Encryption:** Node.js `node:crypto` (AES-256-GCM)
- **AI features:** Vercel AI Gateway
- **Hosting:** Vercel

## License

[MIT](LICENSE.md). Use it, fork it, ship a product on top of it. No strings.
