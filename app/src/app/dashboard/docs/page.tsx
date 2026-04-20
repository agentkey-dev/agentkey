import { requireDashboardContext } from "@/lib/auth/admin";
import { getAgentEnvBlock } from "@/lib/agent-onboarding";
import {
  DOCS_GETTING_STARTED_ITEMS,
  DOCS_REFERENCE_CALLOUT,
  DOCS_REFERENCE_ITEMS,
} from "@/lib/dashboard-docs";
import { getAppOrigin } from "@/lib/origin";

function CodeBlock({
  children,
  title,
}: {
  children: string;
  title?: string;
}) {
  return (
    <div className="border border-white/10 bg-surface-container-lowest">
      {title ? (
        <div className="border-b border-white/5 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-on-surface-variant">
          {title}
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-on-surface-variant">
        {children}
      </pre>
    </div>
  );
}

function Section({
  id,
  step,
  title,
  children,
}: {
  id: string;
  step?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="flex items-center gap-3">
        {step ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-on-primary">
            {step}
          </span>
        ) : null}
        <h2 className="text-xl font-bold text-on-surface">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default async function DocsPage() {
  await requireDashboardContext();
  const baseUrl = getAppOrigin();

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
          Workspace
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-on-surface">
          Documentation
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-on-surface-variant">
          Everything you need to set up, manage, and audit AI agent access to
          your company&apos;s SaaS tools.
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
          Last updated · April 2026
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sticky sidebar TOC */}
        <nav className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:self-start">
          <div className="space-y-5 border border-white/10 bg-surface-container p-4 text-sm lg:border-0 lg:bg-transparent lg:p-0">
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                Getting started
              </div>
              <ol className="space-y-1.5">
                {DOCS_GETTING_STARTED_ITEMS.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="block text-xs leading-snug text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                Reference
              </div>
              <ul className="space-y-1.5">
                {DOCS_REFERENCE_ITEMS.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="block text-xs leading-snug text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        <div className="min-w-0 space-y-16">
        {/* ──────── WALKTHROUGH VIDEO ──────── */}
        <div id="walkthrough" className="scroll-mt-20 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-bold text-on-surface">
              Watch this first
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              5 min · no cuts
            </span>
          </div>
          <p className="max-w-2xl text-sm text-on-surface-variant">
            Full end-to-end walkthrough: creating an agent, teaching it about
            AgentKey via the <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-xs text-primary">CLAUDE.md</code> block, the request-approve-fetch loop, and the usage
            guide your agent gets back with every credential.
          </p>
          <div className="relative aspect-video w-full overflow-hidden rounded-sm border border-white/10 bg-surface-container-highest shadow-2xl shadow-black/40">
            <iframe
              src="https://www.loom.com/embed/c7e441fe4e6441fd8b0a10dbffe4951b?hideEmbedTopBar=true&hide_owner=true&hide_share=true&hide_title=true"
              title="AgentKey full walkthrough"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>

        {/* ──────── SETUP GUIDE ──────── */}
        <div id="setup" className="scroll-mt-20 space-y-12">
          <h2 className="text-2xl font-bold text-on-surface">Setup guide</h2>

          {/* Step 1 */}
          <Section id="create-agent" step="1" title="Create an agent">
            <p className="text-sm text-on-surface-variant">
              An agent in AgentKey represents your AI agent&apos;s identity —
              its API key and the tools it can access. Go to{" "}
              <a
                href="/dashboard/agents"
                className="text-primary hover:underline"
              >
                Agents
              </a>{" "}
              and create a new agent. You&apos;ll receive:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
              <li>An API key (shown once, cannot be recovered)</li>
              <li>Ready-to-paste environment variables</li>
              <li>
                A system prompt snippet that teaches the agent how to use
                AgentKey
              </li>
              <li>A CLAUDE.md snippet (for Claude Code users)</li>
            </ul>
          </Section>

          {/* Step 2 */}
          <Section
            id="configure-agent"
            step="2"
            title="Configure the agent"
          >
            <p className="text-sm text-on-surface-variant">
              Add the API key to your agent&apos;s runtime:
            </p>
            <CodeBlock title=".env or secrets manager">
              {getAgentEnvBlock("sk_agent_...")}
            </CodeBlock>
            <p className="text-sm text-on-surface-variant">
              Then add the system prompt snippet to your agent&apos;s
              instructions (CLAUDE.md, agents.md, or equivalent). The exact
              snippet is generated when you create the agent.
            </p>
          </Section>

          {/* Step 3 */}
          <Section id="add-tools" step="3" title="Add tools to the catalog">
            <p className="text-sm text-on-surface-variant">
              Go to{" "}
              <a
                href="/dashboard/tools"
                className="text-primary hover:underline"
              >
                Tools
              </a>{" "}
              and add each SaaS your agents might need. Agents can also
              suggest missing tools from the API, so you don&apos;t need to
              guess the full catalog up front. The Create Tool form leads with
              two fields:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
              <li>
                <strong className="text-on-surface">Tool name</strong> — when
                you tab away, AgentKey auto-resolves the product URL and logo
                via Brandfetch.
              </li>
              <li>
                <strong className="text-on-surface">Credential</strong> — the
                actual secret. Encrypted at rest with AES-256-GCM.
              </li>
            </ul>
            <p className="text-sm text-on-surface-variant">
              Optionally:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
              <li>
                <strong className="text-on-surface">Docs URL</strong> — used by
                the AI to draft a better usage guide.
              </li>
              <li>
                <strong className="text-on-surface">Usage guide for agents</strong>{" "}
                — company-specific context sent with the credential. Click{" "}
                <strong className="text-on-surface">✦ Draft with AI</strong> to
                stream one in. See{" "}
                <a href="#usage-guides" className="text-primary hover:underline">
                  Writing usage guides
                </a>
                .
              </li>
              <li>
                <strong className="text-on-surface">Advanced options</strong>{" "}
                (collapsed by default) — auth type (API key, OAuth, bot token),
                credential mode (shared vs per-agent), manual URL override.
              </li>
            </ul>
          </Section>

          {/* Step 4 */}
          <Section
            id="agent-requests"
            step="4"
            title="Agent requests access"
          >
            <p className="text-sm text-on-surface-variant">
              Your agent handles these API calls automatically using the system
              prompt you added in step 2. The examples below show what happens
              under the hood — they are also useful for manual testing and
              debugging.
            </p>
            <CodeBlock title="1. List available tools">
              {`curl ${baseUrl}/api/tools \\\n  -H "Authorization: Bearer $AGENTKEY_API_KEY"`}
            </CodeBlock>
            <CodeBlock title="2. Request access with a justification">
              {`curl ${baseUrl}/api/tools/{tool_id}/request \\\n  -X POST \\\n  -H "Authorization: Bearer $AGENTKEY_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"reason": "I need Linear to track bugs for project Foo"}'`}
            </CodeBlock>
            <CodeBlock title="3. Suggest a missing tool">
              {`curl ${baseUrl}/api/tools/suggest \\\n  -X POST \\\n  -H "Authorization: Bearer $AGENTKEY_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "Linear", "url": "https://linear.app", "reason": "No issue tracker exists in the catalog and I need one for engineering work"}'`}
            </CodeBlock>
            <p className="text-sm text-on-surface-variant">
              Access requests and tool suggestions appear in your{" "}
              <a
                href="/dashboard/requests"
                className="text-primary hover:underline"
              >
                Requests
              </a>{" "}
              inbox.
            </p>
          </Section>

          {/* Step 5 */}
          <Section id="approve-deny" step="5" title="Approve or deny">
            <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
              <li>
                <strong className="text-on-surface">Approve</strong> — for
                shared tools, the credential is vended automatically. For
                per-agent tools, you paste the agent-specific credential during
                approval.
              </li>
              <li>
                <strong className="text-on-surface">Deny</strong> — with an
                optional reason. The agent sees it next time it calls{" "}
                <code className="text-xs text-primary">GET /api/tools</code>.
              </li>
            </ul>
          </Section>

          {/* Step 6 */}
          <Section
            id="agent-fetches"
            step="6"
            title="Agent fetches credentials"
          >
            <CodeBlock title="Fetch credential">
              {`curl ${baseUrl}/api/tools/{tool_id}/credentials \\\n  -H "Authorization: Bearer $AGENTKEY_API_KEY"`}
            </CodeBlock>
            <CodeBlock title="Response">
              {`{
  "tool_id": "...",
  "tool_name": "Linear",
  "auth_type": "api_key",
  "credential": "lin_api_xxx",
  "instructions": "Use as a Bearer token. Base URL: https://api.linear.app ..."
}`}
            </CodeBlock>
            <p className="text-sm text-on-surface-variant">
              The{" "}
              <code className="text-xs text-primary">instructions</code> field
              contains the usage guide — company-specific context for how to use
              this tool. If the admin rotates the credential, the agent
              automatically gets the new one on its next fetch.
            </p>
          </Section>

          <section className="space-y-3 border-t border-white/10 pt-12">
            <h2 className="text-2xl font-bold text-on-surface">Reference</h2>
            <p className="max-w-2xl text-sm text-on-surface-variant">
              {DOCS_REFERENCE_CALLOUT}
            </p>
          </section>
        </div>

        {/* ──────── ACCESS MANAGEMENT ──────── */}
        <Section id="access-management" title="Access management">
          <p className="text-sm text-on-surface-variant">
            Once agents are running and have tool access, you can manage and
            audit everything from the dashboard.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 border border-white/10 bg-surface-container p-5">
              <h3 className="font-semibold text-on-surface">
                Revoke individual access
              </h3>
              <p className="text-sm text-on-surface-variant">
                On the{" "}
                <a
                  href="/dashboard/agents"
                  className="text-primary hover:underline"
                >
                  Agents
                </a>{" "}
                page, click an agent to open the side panel. Each tool in the
                Tools list has a switch — flip a granted tool off to revoke
                that one tool. The agent keeps access to all other tools. The
                same switch list is mirrored on the{" "}
                <a
                  href="/dashboard/tools"
                  className="text-primary hover:underline"
                >
                  Tools
                </a>{" "}
                side, so you can manage the relationship from either drawer.
              </p>
            </div>
            <div className="space-y-2 border border-white/10 bg-surface-container p-5">
              <h3 className="font-semibold text-on-surface">Suspend agent</h3>
              <p className="text-sm text-on-surface-variant">
                Suspending an agent revokes all tool access and invalidates its
                API key immediately. Use this when an agent is compromised or
                no longer needed.
              </p>
            </div>
            <div className="space-y-2 border border-white/10 bg-surface-container p-5">
              <h3 className="font-semibold text-on-surface">Delete tool</h3>
              <p className="text-sm text-on-surface-variant">
                On the{" "}
                <a
                  href="/dashboard/tools"
                  className="text-primary hover:underline"
                >
                  Tools
                </a>{" "}
                page, click &quot;Delete tool&quot; to remove it from the
                catalog. All approved and pending grants are revoked
                automatically. The confirmation shows exactly how many agents
                will be affected.
              </p>
            </div>
            <div className="space-y-2 border border-white/10 bg-surface-container p-5">
              <h3 className="font-semibold text-on-surface">
                Rotate credentials
              </h3>
              <p className="text-sm text-on-surface-variant">
                For shared tools, update the credential on the Tools page. All
                agents automatically get the new one on their next{" "}
                <code className="text-xs text-primary">/credentials</code>{" "}
                call. For agent API keys, use &quot;Rotate API key&quot; on the
                Agents page.
              </p>
            </div>
          </div>

          <div className="space-y-2 border border-white/10 bg-surface-container p-5">
            <h3 className="font-semibold text-on-surface">Audit trail</h3>
            <p className="text-sm text-on-surface-variant">
              The{" "}
              <a
                href="/dashboard/audit"
                className="text-primary hover:underline"
              >
                Audit
              </a>{" "}
              page logs every action: agent registrations, access requests,
              approvals, denials, revocations, credential fetches, and tool
              deletions. Filter by agent, tool, action type, and date range.
              Each agent card on the Agents page also shows the 5 most recent
              access events with a link to the full history.
            </p>
          </div>
        </Section>

        {/* ──────── USAGE GUIDES ──────── */}
        <Section id="usage-guides" title="Writing usage guides">
          <p className="text-sm text-on-surface-variant">
            The usage guide is the most important field on a tool. It&apos;s
            sent to the agent{" "}
            <strong className="text-on-surface">only</strong> when it fetches
            the credential — keeping agent context clean until the tool is
            actually needed. You don&apos;t need to get it perfect up front — agents can{" "}
            <a href="#instruction-suggestions" className="text-primary hover:underline">
              suggest improvements
            </a>{" "}
            as they discover facts at runtime. Include everything the agent needs to use this
            tool in your company:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
            <li>
              How to authenticate (Bearer token, query param, header name)
            </li>
            <li>API base URL</li>
            <li>
              Relevant IDs (channel IDs, repo URLs, project keys, workspace
              IDs)
            </li>
            <li>Company conventions (naming, formatting, language)</li>
            <li>
              Rules and guardrails (what NOT to do, which resources to avoid)
            </li>
          </ul>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-white/10 bg-surface-container-lowest p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Example: Discord
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-on-surface-variant">
                {`Use as Bot token in Authorization header.
Base URL: https://discord.com/api/v10

Channels:
- #incidents: 1234567890 (outage alerts)
- #deployments: 0987654321 (deploy notifs)
- #general: DO NOT post here

Rules:
- Always use embeds, not plain text
- Mention @oncall for P0 incidents only`}
              </pre>
            </div>
            <div className="border border-white/10 bg-surface-container-lowest p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Example: GitHub
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-on-surface-variant">
                {`Use as Bearer token.
Base URL: https://api.github.com

Repos:
- acme/backend (PRs require 1 review)
- acme/docs (merge directly to main)

Rules:
- Always create PRs, never push to main
- Conventional commits (feat:, fix:, chore:)
- Add "bot" label to all PRs`}
              </pre>
            </div>
          </div>
        </Section>

        {/* ──────── EXPORT & IMPORT ──────── */}
        <Section id="export-import" title="Export & import">
          <p className="text-sm text-on-surface-variant">
            The{" "}
            <a
              href="/dashboard/tools"
              className="text-primary hover:underline"
            >
              Tools
            </a>{" "}
            page has Export YAML and Import YAML buttons for managing the tool
            catalog as code.
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
            <li>
              <strong className="text-on-surface">Export</strong> downloads the
              catalog as a YAML file. Secrets are never included.
            </li>
            <li>
              <strong className="text-on-surface">Import</strong> opens a modal
              where you paste YAML or drop a file. It shows a diff preview
              (creates, updates, unchanged, removed) before applying.
            </li>
            <li>
              Import never deletes tools — &quot;removed&quot; entries are
              preview-only in v1.
            </li>
            <li>
              Import never overwrites credentials. Existing shared credentials
              stay in place.
            </li>
            <li>
              Tools are matched by{" "}
              <strong className="text-on-surface">config key</strong>, not
              display name. The config key is generated once from the original
              name and stays stable even if you rename the tool.
            </li>
          </ul>
          <p className="text-sm text-on-surface-variant">
            The API also supports export/import directly:
          </p>
          <CodeBlock title="Export via API">
            {`curl ${baseUrl}/api/admin/config/export?format=yaml \\\n  -H "Cookie: <session>"`}
          </CodeBlock>
          <CodeBlock title="Import with dry-run preview">
            {`curl ${baseUrl}/api/admin/config/import?dryRun=1 \\\n  -X PUT \\\n  -H "Content-Type: text/plain" \\\n  --data-binary @tools.yaml`}
          </CodeBlock>
        </Section>

        {/* ──────── AI DRAFTING ──────── */}
        <Section id="ai-drafting" title="AI-assisted tool setup">
          <p className="text-sm text-on-surface-variant">
            The Create Tool form has two AI affordances. Both are optional —
            the manual form works fully without them.
          </p>
          <div className="space-y-2 border border-white/10 bg-surface-container p-4">
            <h4 className="text-sm font-semibold text-on-surface">
              ✦ Draft with AI (above the usage guide field)
            </h4>
            <p className="text-sm text-on-surface-variant">
              Click to stream a usage guide for your agents into the
              instructions textarea — auth header format, base URL, the most
              relevant endpoints, rate limits if they bite. Uses the tool
              name, the auto-resolved URL, and the optional Docs URL field
              for context. Each click sends the current form values, so
              renaming the tool and clicking again produces fresh content.
            </p>
          </div>
          <div className="space-y-2 border border-white/10 bg-surface-container p-4">
            <h4 className="text-sm font-semibold text-on-surface">
              Show me how to get this credential (under the credential field)
            </h4>
            <p className="text-sm text-on-surface-variant">
              Expands an inline streaming markdown panel that walks you
              through provisioning a credential for the tool — where to
              navigate in the SaaS settings, which scopes to select, what to
              copy. Useful for unfamiliar tools.
            </p>
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
            <li>
              The Docs URL field is optional. When provided, the AI fetches
              the page and uses its content as additional context. Use a
              concrete API reference or auth page for best results.
            </li>
            <li>
              JS-heavy pages or pages behind login may return too little
              content. Try a different docs URL if this happens.
            </li>
            <li>
              Available when the app has Vercel AI Gateway access. Configure
              the model with the{" "}
              <code className="text-xs text-primary">AI_DRAFT_MODEL</code>{" "}
              env var.
            </li>
          </ul>
        </Section>

        {/* ──────── API REFERENCE ──────── */}
        <section id="api-reference" className="scroll-mt-20 space-y-8">
          <h2 className="text-2xl font-bold text-on-surface">API reference</h2>

          {/* Agent endpoints */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">
              Agent endpoints
            </h3>
            <p className="text-sm text-on-surface-variant">
              All agent endpoints require{" "}
              <code className="text-xs text-primary">
                Authorization: Bearer &lt;agent_api_key&gt;
              </code>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 font-mono text-[11px] uppercase text-on-surface-variant">
                    <th className="px-4 py-3 font-normal">Method</th>
                    <th className="px-4 py-3 font-normal">Endpoint</th>
                    <th className="px-4 py-3 font-normal">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">GET</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/tools
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      List all tools with your access status
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/tools/&#123;id&#125;/request
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Request access with a justification
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/tools/suggest
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Suggest a missing tool for the catalog
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">GET</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/tools/&#123;id&#125;/credentials
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Fetch credential + usage guide for an approved tool
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/tools/&#123;id&#125;/instructions/suggest
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Suggest an improvement to the usage guide
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Admin endpoints */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">
              Admin endpoints
            </h3>
            <p className="text-sm text-on-surface-variant">
              All admin endpoints require Clerk session authentication.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 font-mono text-[11px] uppercase text-on-surface-variant">
                    <th className="px-4 py-3 font-normal">Method</th>
                    <th className="px-4 py-3 font-normal">Endpoint</th>
                    <th className="px-4 py-3 font-normal">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/agents
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Create agent (returns API key)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">GET</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/agents
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      List agents with access info + recent events
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-rose-400">
                      DELETE
                    </td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/agents/&#123;id&#125;
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Suspend agent (revokes all access)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/agents/&#123;id&#125;/rotate-key
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Rotate agent API key
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-rose-400">
                      DELETE
                    </td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/agents/&#123;id&#125;/tools/&#123;toolId&#125;
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Revoke one tool from one agent
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/tools
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Add tool to catalog
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">PUT</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/tools/&#123;id&#125;
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Update tool (rotate credential, edit instructions)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-rose-400">
                      DELETE
                    </td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/tools/&#123;id&#125;
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Delete tool (cascades revocation)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">GET</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/requests
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      List pending access requests, tool suggestions, and instruction suggestions
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/suggestions/&#123;id&#125;/dismiss
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Dismiss a pending tool suggestion
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/instruction-suggestions/&#123;id&#125;/dismiss
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Dismiss a pending instruction suggestion
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">GET</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/tools/&#123;id&#125;/instructions/history
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      List instruction version history for a tool
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/requests/&#123;id&#125;/approve
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Approve request
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/requests/&#123;id&#125;/deny
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Deny request (with optional reason)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">GET</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/audit-log
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Query audit log (?agent_id, ?tool_id, ?action, ?from,
                      ?to)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">GET</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/config/export
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Export tool catalog (?format=yaml|json)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">PUT</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/config/import
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Import tool catalog (?dryRun=1 for preview)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">POST</td>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      /api/admin/tools/draft
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      AI-draft tool from docs URL
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Access states */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-primary">
              Access states
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 font-mono text-[11px] uppercase text-on-surface-variant">
                    <th className="px-4 py-3 font-normal">State</th>
                    <th className="px-4 py-3 font-normal">Meaning</th>
                    <th className="px-4 py-3 font-normal">Agent action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-3 font-mono text-on-surface">
                      none
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Never requested
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      POST /request to ask for access, or POST /suggest if the
                      tool does not exist
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-amber-400">
                      pending
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Waiting for human review
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Wait and check back via GET /tools
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-emerald-400">
                      approved
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Access granted
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      GET /credentials to fetch the token
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-rose-400">
                      denied
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Denied with reason
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      Read denial_reason, submit new request if justified
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ──────── TOOL SUGGESTIONS ──────── */}
        <Section id="tool-suggestions" title="Agent-driven tool suggestions">
          <p className="text-sm text-on-surface-variant">
            Agents can suggest tools that are missing from the catalog. This
            enables an agent-driven bootstrap — agents tell you what they need
            instead of you guessing up front.
          </p>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-on-surface">How it works</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-on-surface-variant">
              <li>Agent calls <code className="text-xs text-primary">GET /api/tools</code> — doesn&apos;t find what it needs</li>
              <li>Agent calls <code className="text-xs text-primary">POST /api/tools/suggest</code> with the tool name, URL, and reason</li>
              <li>If the tool already exists in the catalog, the agent gets a <code className="text-xs text-primary">409</code> with the <code className="text-xs text-primary">tool_id</code> so it can request access directly</li>
              <li>If another agent already suggested the same tool, this agent&apos;s support is added to the existing suggestion</li>
              <li>The suggestion appears in the admin <a href="/dashboard/requests" className="text-primary hover:underline">Requests</a> inbox</li>
              <li>Admin clicks &quot;Add to catalog&quot; — tool is created and pending access requests are automatically opened for all agents that suggested it</li>
            </ol>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-on-surface">Dismissal and cooldown</h4>
            <p className="text-sm text-on-surface-variant">
              If you dismiss a suggestion, agents cannot re-suggest the same tool for 24 hours (the cooldown period). After the cooldown expires, agents can suggest it again. Dismissed suggestions are kept in the audit log.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-on-surface">Deduplication</h4>
            <p className="text-sm text-on-surface-variant">
              Suggestions are deduplicated by normalized domain (when a URL is provided) or by normalized name. If 3 agents suggest &quot;Linear&quot;, &quot;linear.app&quot;, and &quot;Linear App&quot;, they all land on one suggestion with 3 supporters.
            </p>
          </div>
        </Section>

        {/* ──────── INSTRUCTION SUGGESTIONS ──────── */}
        <Section id="instruction-suggestions" title="Instruction suggestions">
          <p className="text-sm text-on-surface-variant">
            Agents discover company-specific facts at runtime — channel IDs, project keys, API quirks, naming conventions — that belong in the usage guide but aren&apos;t there yet. Instruction suggestions let agents share what they learn so you can curate it into the guide.
          </p>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-on-surface">How it works</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-on-surface-variant">
              <li>Agent uses a tool and discovers a fact not in the usage guide</li>
              <li>Agent calls <code className="text-xs text-primary">POST /api/tools/&#123;id&#125;/instructions/suggest</code> with what it learned and why</li>
              <li>The suggestion appears in your <a href="/dashboard/requests" className="text-primary hover:underline">Requests</a> inbox alongside access requests</li>
              <li>Click &quot;Review in guide editor&quot; — opens the tool editor with the suggestion appended to the current guide</li>
              <li>Edit freely (reword, reposition, merge with existing text), then save</li>
              <li>The suggestion is marked accepted and the guide is versioned</li>
            </ol>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-on-surface">Dismissal</h4>
            <p className="text-sm text-on-surface-variant">
              Dismissing a suggestion requires a reason. The reason is returned to agents that try to suggest the same thing, so they stop asking. Dismissals stay active until the guide changes — once you edit the guide for any reason, previously dismissed suggestions can be re-submitted against the new version.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-on-surface">Supporters</h4>
            <p className="text-sm text-on-surface-variant">
              If multiple agents discover the same fact, they&apos;re merged into one suggestion with multiple supporters. Each supporter&apos;s reasoning is shown so you can judge the suggestion from multiple angles.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-on-surface">Guide versioning</h4>
            <p className="text-sm text-on-surface-variant">
              Every guide save — whether from accepting a suggestion, manual editing, or restoring a previous version — creates a snapshot. The instruction history panel on each tool lets you view past versions and restore any of them.
            </p>
          </div>
        </Section>

        {/* ──────── WEBHOOK NOTIFICATIONS ──────── */}
        <Section id="webhooks" title="Webhook notifications">
          <p className="text-sm text-on-surface-variant">
            AgentKey can send Slack or Discord notifications when new access
            requests, tool suggestions, and instruction suggestions arrive. Set this up on the{" "}
            <a href="/dashboard/notifications" className="text-primary hover:underline">Notifications</a> page.
          </p>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-on-surface">Slack setup</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-on-surface-variant">
              <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-primary hover:underline">api.slack.com/apps</a> and create a new app (or use an existing one)</li>
              <li>Under &quot;Incoming Webhooks&quot;, activate webhooks and click &quot;Add New Webhook to Workspace&quot;</li>
              <li>Choose the channel where you want notifications (e.g., #agent-requests)</li>
              <li>Copy the webhook URL (starts with <code className="text-xs text-primary">https://hooks.slack.com/services/...</code>)</li>
              <li>Paste it on the <a href="/dashboard/notifications" className="text-primary hover:underline">Notifications</a> page</li>
            </ol>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-on-surface">Discord setup</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-on-surface-variant">
              <li>Open Discord and go to your server&apos;s channel settings</li>
              <li>Go to Integrations → Webhooks → New Webhook</li>
              <li>Name it (e.g., &quot;AgentKey&quot;) and choose the channel</li>
              <li>Click &quot;Copy Webhook URL&quot; (starts with <code className="text-xs text-primary">https://discord.com/api/webhooks/...</code>)</li>
              <li>Paste it on the <a href="/dashboard/notifications" className="text-primary hover:underline">Notifications</a> page</li>
            </ol>
          </div>
          <p className="text-sm text-on-surface-variant">
            Notifications are best-effort: if a webhook fails, the request or suggestion is still created. Check the &quot;Last delivery&quot; status on the Notifications page to verify your webhooks are working.
          </p>
        </Section>

        {/* ──────── SCHEMA DISCOVERY ──────── */}
        <Section id="schema-discovery" title="Schema discovery for agents">
          <p className="text-sm text-on-surface-variant">
            Agents can call <code className="text-xs text-primary">GET</code> on
            any agent-facing POST endpoint to get the expected request schema.
            This lets agents self-correct without relying solely on the system
            prompt.
          </p>
          <CodeBlock title="Discover the /request schema">
            {`curl ${baseUrl}/api/tools/{tool_id}/request \\\n  -H "Authorization: Bearer $AGENTKEY_API_KEY"`}
          </CodeBlock>
          <CodeBlock title="Discover the /suggest schema">
            {`curl ${baseUrl}/api/tools/suggest \\\n  -H "Authorization: Bearer $AGENTKEY_API_KEY"`}
          </CodeBlock>
          <CodeBlock title="Discover the /instructions/suggest schema">
            {`curl ${baseUrl}/api/tools/{tool_id}/instructions/suggest \\\n  -H "Authorization: Bearer $AGENTKEY_API_KEY"`}
          </CodeBlock>
          <p className="text-sm text-on-surface-variant">
            The response includes the expected fields, types, constraints, and
            example values. Validation errors also include a{" "}
            <code className="text-xs text-primary">details</code> array
            listing each field that failed and why, plus a{" "}
            <code className="text-xs text-primary">hint</code> pointing to
            schema discovery.
          </p>
        </Section>

        {/* ──────── RATE LIMITS ──────── */}
        <Section id="rate-limits" title="Rate limits">
          <p className="text-sm text-on-surface-variant">
            All agent API responses include rate limit headers:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 font-mono text-[11px] uppercase text-on-surface-variant">
                  <th className="px-4 py-3 font-normal">Endpoint type</th>
                  <th className="px-4 py-3 font-normal">Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-3 font-mono text-on-surface">GET /api/tools, GET /api/me</td>
                  <td className="px-4 py-3 text-on-surface-variant">120 requests per minute per agent</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-on-surface">POST /request, POST /suggest</td>
                  <td className="px-4 py-3 text-on-surface-variant">10 requests per hour per agent</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-on-surface">GET /credentials</td>
                  <td className="px-4 py-3 text-on-surface-variant">60 requests per minute per agent</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-on-surface-variant">
            Every response includes <code className="text-xs text-primary">X-RateLimit-Limit</code>,{" "}
            <code className="text-xs text-primary">X-RateLimit-Remaining</code>, and{" "}
            <code className="text-xs text-primary">X-RateLimit-Reset</code> headers.
            When the limit is exceeded, the API returns <code className="text-xs text-primary">429</code>.
          </p>
        </Section>

        {/* ──────── TROUBLESHOOTING ──────── */}
        <Section id="troubleshooting" title="Troubleshooting">
          <div className="space-y-4">
            {[
              {
                q: "Agent gets 401 Unauthorized",
                a: "The API key is wrong, expired, or the agent was suspended. Check the agent's status on the Agents page. If the key was rotated, update it in the agent's config.",
              },
              {
                q: "Agent gets 403 on /credentials",
                a: "The agent's access request hasn't been approved yet, was denied, or was revoked. Call GET /api/tools to check the current access state and read any denial_reason.",
              },
              {
                q: "Agent gets 409 on /suggest",
                a: "Either the tool already exists (response includes tool_id — use POST /tools/{id}/request instead), or the suggestion was recently dismissed and is in cooldown (response includes retry_after).",
              },
              {
                q: "Agent gets 429 Too Many Requests",
                a: "Rate limit exceeded. Check X-RateLimit-Reset header for when the limit resets. Reduce request frequency. Credentials don't change often — cache the response and re-fetch only when a request fails.",
              },
              {
                q: "Webhook notifications aren't arriving",
                a: "Check the Last delivery status on the Notifications page. Common issues: webhook URL is wrong, Slack app was removed, Discord webhook was deleted. Re-paste the URL to fix.",
              },
              {
                q: "Credential stopped working",
                a: "The admin may have rotated it. Call GET /tools/{id}/credentials again to get the current credential. If you still get an error, the credential may have been revoked in the external service — ask an admin.",
              },
            ].map((item) => (
              <div key={item.q} className="border border-white/10 bg-surface-container p-4">
                <h4 className="text-sm font-semibold text-on-surface">{item.q}</h4>
                <p className="mt-1 text-sm text-on-surface-variant">{item.a}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ──────── KEY CONCEPTS ──────── */}
        <section id="concepts" className="scroll-mt-20 space-y-6">
          <h2 className="text-2xl font-bold text-on-surface">Key concepts</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 border border-white/10 bg-surface-container p-5">
              <h3 className="font-semibold text-on-surface">
                Shared credentials
              </h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                One credential for all agents (e.g., Linear API key). Admin
                enters it once. All approved agents get the same credential.
                Rotating it propagates instantly to every agent.
              </p>
            </div>
            <div className="space-y-2 border border-white/10 bg-surface-container p-5">
              <h3 className="font-semibold text-on-surface">
                Per-agent credentials
              </h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                Each agent needs its own identity (e.g., Discord bot token).
                Admin creates the bot/app externally, then pastes the token
                when approving the agent&apos;s request.
              </p>
            </div>
            <div className="space-y-2 border border-white/10 bg-surface-container p-5">
              <h3 className="font-semibold text-on-surface">
                Secure by default
              </h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                Agents start with zero access. The API key only allows
                browsing the catalog and submitting requests. No agent can
                access any SaaS tool without explicit human approval.
              </p>
            </div>
            <div className="space-y-2 border border-white/10 bg-surface-container p-5">
              <h3 className="font-semibold text-on-surface">Config key</h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                A stable slug generated once from the tool name (e.g.,
                &quot;linear&quot;, &quot;github&quot;). Used as the identity
                for config export/import. Never changes when you rename the
                tool.
              </p>
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
