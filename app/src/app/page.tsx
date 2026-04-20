import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { HeroTerminal } from "@/components/hero-terminal";
import { getAppOrigin } from "@/lib/origin";

const homeDescription =
  "Access governance for AI agents. Manage which SaaS tools your agents can access with human approval, encrypted credentials on demand, and full audit logging.";

const homeFaqs = [
  {
    q: "What types of AI agents does AgentKey work with?",
    a: "Any agent that can make HTTP requests. OpenClaw, Claude Code, Cursor, Cline, the OpenAI Agents SDK, LangChain, the Vercel AI SDK, your own custom stack — if it can call a REST API, it works with AgentKey. No special SDK or framework required.",
  },
  {
    q: 'What counts as a "tool"?',
    a: "Any SaaS or external service your agents need credentials for. GitHub, Linear, Notion, Slack, Discord, Stripe, Vercel, Datadog — anything with an API key, OAuth token, or bot token.",
  },
  {
    q: "How do agents know how to use the API?",
    a: "When you create an agent, AgentKey generates a system prompt snippet with full API instructions. Paste it into your agent's config. Agents can also call GET on any endpoint to discover the expected schema and self-correct.",
  },
  {
    q: "What if an agent needs a tool that's not in the catalog?",
    a: "The agent can suggest it. It calls POST /api/tools/suggest with the tool name, URL, and reason. The suggestion lands in your inbox. When you add the tool, access requests are automatically created for every agent that asked for it.",
  },
  {
    q: "How are credentials stored?",
    a: "AES-256-GCM encrypted at rest in the database. Agents never store raw secrets — they fetch credentials on demand via the API. When you rotate a shared credential, all agents get the new one automatically on their next fetch.",
  },
  {
    q: 'What\'s a "usage guide"?',
    a: "Company-specific context sent alongside the credential. For example: Discord channel IDs, GitHub repo conventions, Linear project keys. It's only loaded when the agent fetches the credential — keeping agent context clean until the tool is actually needed.",
  },
  {
    q: "Can I get notified when agents make requests?",
    a: "Yes. Set up Slack or Discord webhooks in the dashboard. You'll get a notification for every new access request and tool suggestion.",
  },
  {
    q: "Is there an approval workflow?",
    a: "Yes. Every access request and tool suggestion requires human approval. AgentKey uses Clerk organizations — you can invite team members to your organization so multiple people can review and approve requests.",
  },
  {
    q: "I want to self-host. How hard is it?",
    a: "About five minutes on Vercel. All three dependencies — Neon (Postgres), Upstash (Redis), and Clerk (auth) — are Vercel Marketplace integrations. Click Deploy, approve the three integrations from your Vercel dashboard, and their env vars are auto-provisioned into your project. Free tiers cover everything a team needs. No vendor lock-in: the code is source-available and you can swap any piece later.",
  },
  {
    q: "Is this overkill for a 3-person team?",
    a: "No. The pain scales down: one rotated key you forgot about, one offboarded contractor whose .env still has prod Stripe, one hobby agent that silently got prod-level GitHub access. The approval queue takes seconds per request — you get governance without bureaucracy.",
  },
] as const;

export const metadata: Metadata = {
  title: "AgentKey — Agent Access Management",
  description: homeDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "AgentKey — Agent Access Management",
    description: homeDescription,
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentKey — Agent Access Management",
    description: homeDescription,
  },
};

export default async function Home() {
  const { userId, orgId } = await auth();
  const origin = getAppOrigin();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "AgentKey",
        url: origin,
        logo: `${origin}/favicon-32x32.png`,
      },
      {
        "@type": "WebSite",
        name: "AgentKey",
        url: origin,
        description: homeDescription,
      },
      {
        "@type": "FAQPage",
        mainEntity: homeFaqs.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };

  if (userId && orgId) {
    redirect("/dashboard");
  }

  if (userId) {
    redirect("/onboarding");
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Nav />
      <main>
        <Hero />
        <Problem />
        <AgentDriven />
        <HowItWorks />
        <VideoDemo />
        <AgentInstructions />
        <DashboardPreview />
        <WorksWith />
        <BuiltOnVercel />
        <Security />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}

/* ─── Nav ─── */
function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
        <span className="text-xl font-bold tracking-tighter text-white">
          AgentKey
        </span>
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#how-it-works"
            className="text-sm tracking-tight text-on-surface-variant transition-colors hover:text-on-surface"
          >
            How it works
          </a>
          <a
            href="#security"
            className="text-sm tracking-tight text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Security
          </a>
          <a
            href="#faq"
            className="text-sm tracking-tight text-on-surface-variant transition-colors hover:text-on-surface"
          >
            FAQ
          </a>
          <Link
            href="/blog"
            className="text-sm tracking-tight text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Blog
          </Link>
          <a
            href="https://github.com/agentkey-dev/agentkey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm tracking-tight text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <GitHubIcon />
            GitHub
          </a>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="rounded-sm px-4 py-2 text-sm tracking-tight text-on-surface-variant transition-colors hover:bg-white/5 hover:text-on-surface"
          >
            Sign In
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─── Hero ─── */
function Hero() {
  return (
    <section
      id="product"
      className="relative overflow-hidden px-6 pt-16 pb-32"
    >
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-16 lg:grid-cols-2">
        <div className="z-10">
          <span className="mb-6 block font-mono text-xs uppercase tracking-[0.2em] text-primary">
            For builders shipping AI agents
          </span>
          <h1 className="mb-8 text-5xl font-bold leading-[1.05] tracking-tighter text-on-surface md:text-7xl">
            Stop hardcoding API keys into your{" "}
            <span className="text-primary">AI agents.</span>
          </h1>
          <p className="mb-6 max-w-xl text-lg leading-relaxed text-on-surface-variant">
            Your agents need GitHub, Linear, Notion, Stripe. Today their keys
            live in scattered <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-sm">.env</code> files
            with zero oversight. AgentKey hands credentials to agents on demand —
            they request what they need, you approve once, secrets never get
            hardcoded.
          </p>
          <div className="mb-10 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
            <span className="text-on-surface">Self-hostable.</span>
            <span className="text-on-surface-variant">Works with OpenClaw, Claude Code, Cursor, the OpenAI &amp; Vercel AI SDKs — any HTTP-capable agent.</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/sign-up"
              className="rounded-sm bg-primary px-8 py-4 text-base font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            >
              Try the hosted demo
            </Link>
            <a
              href="https://github.com/agentkey-dev/agentkey"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm border border-outline-variant px-8 py-4 text-base font-bold text-on-surface transition-all hover:bg-surface-container-high"
            >
              Star on GitHub
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://github.com/agentkey-dev/agentkey/blob/main/LICENSE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface"
            >
              Open source (MIT) →
            </a>
            <Link
              href="/security"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface"
            >
              AES-256-GCM Encrypted →
            </Link>
          </div>
        </div>

        {/* Terminal animation */}
        <div className="relative hidden lg:block">
          <HeroTerminal />
        </div>
      </div>

      {/* Mobile terminal — static snapshot so mobile visitors see the flow */}
      <div className="mx-auto mt-12 max-w-[640px] lg:hidden">
        <MobileTerminalSnapshot />
      </div>
    </section>
  );
}

function MobileTerminalSnapshot() {
  return (
    <div className="border border-outline-variant bg-surface-container-lowest">
      <div className="flex items-center gap-3 border-b border-outline-variant/30 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-error/40" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500/40" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary/40" />
        </div>
        <span className="font-mono text-[10px] text-on-surface-variant/50">
          agent@company ~ agentkey
        </span>
      </div>
      <div className="space-y-1 overflow-x-auto p-5 font-mono text-[12px] leading-relaxed">
        <div className="text-primary font-semibold">
          <span className="text-on-surface-variant/40">$ </span>GET /api/tools
        </div>
        <div className="text-on-surface">&nbsp;&nbsp;Linear &nbsp;&nbsp;&nbsp;&nbsp;&quot;approved&quot;</div>
        <div className="text-on-surface">&nbsp;&nbsp;GitHub &nbsp;&nbsp;&nbsp;&nbsp;&quot;none&quot;</div>
        <div className="h-3" />
        <div className="text-primary font-semibold">
          <span className="text-on-surface-variant/40">$ </span>POST /api/tools/github/request
        </div>
        <div className="text-on-surface-variant">
          &nbsp;&nbsp;reason: &quot;Open PRs for bug fixes&quot;
        </div>
        <div className="text-emerald-400">
          &nbsp;&nbsp;✓ Submitted. Awaiting human review.
        </div>
        <div className="h-3" />
        <div className="text-primary font-semibold">
          <span className="text-on-surface-variant/40">$ </span>GET /api/tools/linear/credentials
        </div>
        <div className="text-emerald-400">
          &nbsp;&nbsp;✓ credential: &quot;lin_api_•••••••&quot;
        </div>
        <div className="text-on-surface-variant/60">
          &nbsp;&nbsp;+ company-specific usage guide
        </div>
      </div>
    </div>
  );
}

/* ─── Problem ─── */
function Problem() {
  return (
    <section className="bg-surface-container-low px-6 py-32">
      <div className="mx-auto max-w-4xl text-center">
        <span className="mb-4 block font-mono text-sm uppercase tracking-widest text-error">
          The Governance Gap
        </span>
        <h2 className="mb-8 text-4xl font-bold tracking-tighter text-on-surface md:text-5xl">
          Your agents have keys to everything.
          <br />
          You have no visibility.
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
          Engineers hand API keys to agents for quick scripts. Those scripts
          become production systems. The keys live forever in env vars, config
          files, and secret managers — with no central record of who has access
          to what, or why.
        </p>

        <div className="grid grid-cols-1 gap-px border border-outline-variant/20 bg-outline-variant/20 md:grid-cols-2">
          <div className="bg-surface p-12 text-left">
            <KeyIcon className="mb-6 text-primary" />
            <h3 className="mb-4 text-xl font-bold">
              Fragmented Key Management
            </h3>
            <p className="text-sm text-on-surface-variant">
              Every agent gets a long-lived API key pasted into its config. No
              rotation, no expiry, no record of who provisioned it. When someone
              leaves the team, those keys stay active.
            </p>
          </div>
          <div className="bg-surface p-12 text-left">
            <EyeOffIcon className="mb-6 text-primary" />
            <h3 className="mb-4 text-xl font-bold">No Audit Trail</h3>
            <p className="text-sm text-on-surface-variant">
              Which agent has access to Stripe? Who approved it? When? Today the
              answer lives in someone&apos;s Slack history — if it exists at
              all. Access reviews for agents don&apos;t exist.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─── */
function HowItWorks() {
  const steps = [
    {
      num: "01",
      label: "REGISTER",
      title: "Create Agent Identity",
      desc: "Admin registers the agent in the dashboard. Gets back an API key and ready-to-paste config snippets. That's the only credential the agent ever manages.",
    },
    {
      num: "02",
      label: "REQUEST",
      title: "Agent Requests or Suggests",
      desc: 'The agent checks the catalog. If the tool exists, it requests access with a justification. If not, it suggests a missing tool. Multiple agents can back the same suggestion.',
    },
    {
      num: "03",
      label: "APPROVE",
      title: "Human Approves or Denies",
      desc: "Admin reviews the request in a single inbox and approves with one click. Denial reasons are sent back to the agent automatically.",
    },
    {
      num: "04",
      label: "CREDENTIAL",
      title: "Agent Fetches Credentials",
      desc: "Approved agents fetch the credential plus a company-specific usage guide: API URLs, channel IDs, repo conventions, rules. Context on demand, zero bloat.",
    },
  ];

  return (
    <section id="how-it-works" className="bg-surface px-6 py-32">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-20 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-xl">
            <h2 className="mb-4 text-4xl font-bold tracking-tighter">
              How It Works
            </h2>
            <p className="text-on-surface-variant">
              Four steps. No agent can access any SaaS tool without explicit
              human approval.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.num}>
              <div className="mb-6 font-mono text-sm text-primary">
                {step.num} {"//"} {step.label}
              </div>
              <h3 className="mb-4 text-xl font-bold">{step.title}</h3>
              <p className="border-l border-primary/20 pl-6 text-sm leading-relaxed text-on-surface-variant">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Agent-Driven ─── */
function AgentDriven() {
  return (
    <section className="border-y border-white/5 bg-surface-container-low px-6 py-32">
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 block font-mono text-sm uppercase tracking-widest text-primary">
            The Wild Part
          </span>
          <h2 className="mb-8 text-4xl font-bold tracking-tighter text-on-surface md:text-5xl">
            The first credential broker that{" "}
            <span className="text-primary">grows itself.</span>
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
            Don&apos;t guess which tools to provision. Deploy your agents and
            let them drive the catalog. When an agent needs a tool that
            doesn&apos;t exist yet, it suggests it — with a justification —
            and every other agent that needs the same thing gets access the
            moment you approve.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="border border-outline-variant/10 bg-surface p-10">
            <div className="mb-6 font-mono text-sm text-primary">
              DISCOVER
            </div>
            <h3 className="mb-4 text-lg font-bold">Agent checks the catalog</h3>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Every time an agent needs a tool, it calls the API to see
              what&apos;s available. No stale configs. No assumptions.
            </p>
          </div>
          <div className="border border-outline-variant/10 bg-surface p-10">
            <div className="mb-6 font-mono text-sm text-primary">
              SUGGEST
            </div>
            <h3 className="mb-4 text-lg font-bold">
              Missing tool? Agent suggests it
            </h3>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              If the catalog doesn&apos;t have what the agent needs, it suggests
              a new tool with a URL and reason. Multiple agents can back the
              same suggestion — the admin sees the demand.
            </p>
          </div>
          <div className="border border-outline-variant/10 bg-surface p-10">
            <div className="mb-6 font-mono text-sm text-primary">
              PROVISION
            </div>
            <h3 className="mb-4 text-lg font-bold">
              Admin adds, agents get access
            </h3>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              When the admin adds the suggested tool to the catalog, pending
              access requests are automatically created for every agent that
              asked for it. One click to approve.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Dashboard Preview ─── */
function DashboardPreview() {
  const requests = [
    {
      kind: "access_request" as const,
      agent: "Bug-Tracker-Agent",
      tool: "Linear",
      reason: '"Need to create and update issues for the backend team"',
    },
    {
      kind: "access_request" as const,
      agent: "Deploy-Bot",
      tool: "Vercel",
      reason: '"Trigger production deployments for the marketing site"',
    },
    {
      kind: "suggestion" as const,
      agent: "Onboarding-Agent + 2 others",
      tool: "Notion",
      reason: '"No wiki tool in catalog. Need it for onboarding docs."',
    },
  ];

  return (
    <section className="bg-surface px-6 py-32">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight">
            Every agent, every tool, one queue.
          </h2>
          <p className="mx-auto max-w-xl text-on-surface-variant">
            Access requests and tool suggestions land in one inbox. Approve or
            deny with one click. Every decision is logged, forever.
          </p>
        </div>

        <div className="overflow-hidden rounded-sm border border-outline-variant/30 bg-surface-container-highest/60 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-outline-variant/20 bg-surface-container px-6 py-4">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] text-primary">
                REQUESTS INBOX
              </span>
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
              3 awaiting review
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/10 bg-surface/40 font-mono text-[10px] uppercase text-on-surface-variant">
                  <th className="px-8 py-4 font-normal">Type</th>
                  <th className="px-8 py-4 font-normal">Agent</th>
                  <th className="px-8 py-4 font-normal">Tool</th>
                  <th className="px-8 py-4 font-normal">Justification</th>
                  <th className="px-8 py-4 text-right font-normal">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {requests.map((r, i) => (
                  <tr
                    key={r.agent}
                    className={`transition-colors hover:bg-surface-container-high/40 ${
                      i < requests.length - 1
                        ? "border-b border-outline-variant/5"
                        : ""
                    }`}
                  >
                    <td className="px-8 py-6">
                      <span
                        className={`rounded-sm px-2 py-1 text-[10px] uppercase ${
                          r.kind === "suggestion"
                            ? "bg-amber-500/10 text-amber-300"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {r.kind === "suggestion" ? "suggestion" : "request"}
                      </span>
                    </td>
                    <td className="px-8 py-6 font-bold text-on-surface">
                      {r.agent}
                    </td>
                    <td className="px-8 py-6 text-primary">{r.tool}</td>
                    <td className="px-8 py-6 italic text-on-surface-variant">
                      {r.reason}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-3">
                        <button className="border border-outline-variant bg-transparent px-4 py-1.5 text-on-surface transition-all hover:border-error hover:bg-error/10">
                          Deny
                        </button>
                        <button className="bg-primary px-4 py-1.5 text-on-primary transition-all hover:opacity-90">
                          {r.kind === "suggestion" ? "Add Tool" : "Approve"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Security ─── */
function Security() {
  const features = [
    {
      icon: <LockIcon />,
      title: "Encryption at Rest",
      desc: "All SaaS credentials are AES-256 encrypted in the database. Agents receive credentials on demand — they never store raw secrets.",
      badge: "AES-256 ENCRYPTED",
    },
    {
      icon: <AuditIcon />,
      title: "Full Audit Log",
      desc: "Every registration, request, approval, denial, revocation, and credential fetch is logged. Append-only, queryable, filterable by agent, tool, or date.",
      badge: "APPEND-ONLY",
    },
    {
      icon: <BoltIcon />,
      title: "Instant Revoke",
      desc: "One click to revoke any agent's access to any tool. Takes effect immediately — the agent's next credential request returns 403.",
      badge: "ONE-CLICK REVOKE",
    },
    {
      icon: <ContextIcon />,
      title: "Context on Demand",
      desc: "Each tool includes a usage guide — API URLs, channel IDs, repo conventions, rules. Sent only when the agent fetches the credential. Zero context bloat.",
      badge: "LAZY-LOADED",
    },
  ];

  return (
    <section id="security" className="px-6 py-32">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-16 text-center">
          <span className="mb-4 block font-mono text-sm uppercase tracking-widest text-primary">
            Security
          </span>
          <h2 className="mb-4 text-4xl font-bold tracking-tighter md:text-5xl">
            Security is the product.
          </h2>
          <p className="mx-auto max-w-xl text-on-surface-variant">
            AgentKey stores third-party credentials, so every layer is designed
            for that. The same rigor you apply to human access reviews — now
            for your agents.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group flex flex-col justify-between border border-outline-variant/10 bg-surface-container p-10 transition-colors hover:border-primary/30"
            >
              <div>
                <div className="mb-8 text-primary">{f.icon}</div>
                <h3 className="mb-4 text-lg font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  {f.desc}
                </p>
              </div>
              <div className="mt-8 font-mono text-[10px] text-outline">
                {f.badge}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */
function FAQ() {
  return (
    <section
      id="faq"
      className="border-t border-white/5 bg-surface-container-low px-6 py-32"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight">
            Questions
          </h2>
        </div>
        <div className="divide-y divide-white/5">
          {homeFaqs.map((item) => (
            <div key={item.q} className="py-8">
              <h3 className="mb-3 text-base font-semibold text-on-surface">
                {item.q}
              </h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ─── */
function CTA() {
  return (
    <section className="border-t border-white/5 bg-surface-container-low px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <span className="mb-4 block font-mono text-xs uppercase tracking-[0.2em] text-primary">
          An experiment
        </span>
        <h2 className="mb-6 text-3xl font-bold tracking-tight text-on-surface md:text-4xl">
          Poke at it. Self-host it. Fork it.
        </h2>
        <p className="mx-auto mb-10 max-w-xl leading-relaxed text-on-surface-variant">
          AgentKey is an experiment by{" "}
          <a
            href="https://elba.security"
            target="_blank"
            rel="noopener noreferrer"
            className="text-on-surface underline-offset-4 hover:underline"
          >
            elba
          </a>
          &apos;s{" "}
          <a
            href="https://www.linkedin.com/in/antoine-berton-532519225/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-on-surface underline-offset-4 hover:underline"
          >
            CTO
          </a>{" "}
          — to explore what happens when agents have to ask before they access. The code is MIT. The hosted demo is here for anyone to try.
        </p>
        <div className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href="https://github.com/agentkey-dev/agentkey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center rounded-sm border border-outline-variant bg-surface-container px-6 py-3 font-mono text-xs uppercase tracking-widest text-on-surface transition-colors hover:border-primary/40"
          >
            View on GitHub
          </a>
          <Link
            href="/sign-up"
            className="inline-flex flex-1 items-center justify-center rounded-sm border border-outline-variant bg-surface-container px-6 py-3 font-mono text-xs uppercase tracking-widest text-on-surface transition-colors hover:border-primary/40"
          >
            Try the hosted demo
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Video Demo ─── */
function VideoDemo() {
  return (
    <section className="border-y border-white/5 bg-surface px-6 py-24">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-10 text-center">
          <span className="mb-4 block font-mono text-sm uppercase tracking-widest text-primary">
            Full walkthrough
          </span>
          <h2 className="mb-4 text-4xl font-bold tracking-tighter md:text-5xl">
            End to end, no cuts.
          </h2>
          <p className="mx-auto max-w-xl text-on-surface-variant">
            Create an agent, teach it about AgentKey, watch it request a tool,
            approve it, and fetch credentials with company-specific context.
            Five minutes, the real product.
          </p>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-sm border border-outline-variant/30 bg-surface-container-highest shadow-2xl shadow-black/40">
          <iframe
            src="https://www.loom.com/embed/c7e441fe4e6441fd8b0a10dbffe4951b?hideEmbedTopBar=true&hide_owner=true&hide_share=true&hide_title=true"
            title="AgentKey walkthrough"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </section>
  );
}

/* ─── Agent Instructions Snippet ─── */
function AgentInstructions() {
  const snippet = `## Tool Access — AgentKey

You have access to AgentKey, a central service that manages
your credentials for external tools (GitHub, Linear, Notion...).

**API:** https://agentkey.dev
**Your key:** AGENTKEY_API_KEY environment variable

### How to use
1. GET /api/tools — see what you can access
2. POST /api/tools/{id}/request — ask for a missing tool
3. POST /api/tools/suggest — propose a tool not in catalog
4. GET /api/tools/{id}/credentials — fetch credential on demand

Always read the 'instructions' field in the credential response.
It contains company-specific context for this tool.`;

  return (
    <section className="bg-surface-container-low px-6 py-32">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <span className="mb-4 block font-mono text-sm uppercase tracking-widest text-primary">
              Drop-In Setup
            </span>
            <h2 className="mb-6 text-4xl font-bold tracking-tighter md:text-5xl">
              Paste this into your{" "}
              <code className="rounded bg-white/5 px-2 py-1 font-mono text-3xl text-primary md:text-4xl">
                CLAUDE.md
              </code>
              . That&apos;s it.
            </h2>
            <p className="mb-6 text-lg leading-relaxed text-on-surface-variant">
              Your agent now knows how to discover tools, request access, and
              fetch credentials on demand. Works wherever your agent reads
              system instructions — <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-sm text-on-surface">CLAUDE.md</code>,{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-sm text-on-surface">TOOLS.md</code> (OpenClaw),{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-sm text-on-surface">.cursorrules</code>,{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-sm text-on-surface">AGENTS.md</code>, or a system prompt field.
            </p>
            <p className="mb-8 text-sm leading-relaxed text-on-surface-variant/80">
              No SDK. No wrapper. No framework lock-in. Just a prompt and a REST
              API your agent already knows how to call.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 font-mono text-sm text-primary transition-opacity hover:opacity-80"
            >
              Get your key
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <div className="overflow-hidden rounded-sm border border-outline-variant/30 bg-surface-container-highest shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-outline-variant/20 bg-surface-container px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <div className="h-3 w-3 rounded-full bg-green-500/60" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                CLAUDE.md
              </span>
              <span className="font-mono text-[10px] text-on-surface-variant/50">
                markdown
              </span>
            </div>
            <pre className="overflow-x-auto p-6 font-mono text-[12px] leading-relaxed text-on-surface/90">
              <code>{snippet}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Built on Vercel ─── */
function BuiltOnVercel() {
  const primitives = [
    "Vercel Marketplace",
    "AI Gateway",
    "Edge Network",
    "Speed Insights",
    "Web Analytics",
  ];
  return (
    <section className="bg-surface px-6 py-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
          <div className="max-w-xl">
            <span className="mb-2 block font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              Built on Vercel
            </span>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Deploy in three clicks from the Vercel dashboard. Neon, Upstash,
              and Clerk are all Marketplace integrations — env vars
              auto-provisioned, free tiers cover everything a team needs.
            </p>
          </div>
          <a
            href="https://vercel.com/new/clone?repository-url=https://github.com/agentkey-dev/agentkey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-sm border border-outline-variant bg-surface-container px-5 py-3 font-mono text-xs uppercase tracking-widest text-on-surface transition-colors hover:border-primary/40 hover:bg-surface-container-high"
          >
            <VercelMark />
            Deploy with Vercel
          </a>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-white/5 pt-6">
          {primitives.map((name) => (
            <span
              key={name}
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-on-surface-variant/70"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function VercelMark() {
  return (
    <svg width="14" height="12" viewBox="0 0 76 65" fill="currentColor" aria-hidden="true">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

/* ─── Works With ─── */
function WorksWith() {
  const frameworks = [
    "OpenClaw",
    "Claude Code",
    "Cursor",
    "Cline",
    "OpenAI Agents",
    "LangChain",
    "Vercel AI SDK",
    "Custom Agents",
  ];
  return (
    <section className="border-y border-white/5 bg-surface-container-low px-6 py-20">
      <div className="mx-auto max-w-[1400px]">
        <p className="mb-10 text-center font-mono text-xs uppercase tracking-[0.2em] text-on-surface-variant">
          Works with every agent framework
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {frameworks.map((name) => (
            <span
              key={name}
              className="font-mono text-sm font-semibold uppercase tracking-wider text-on-surface/60 transition-colors hover:text-on-surface"
            >
              {name}
            </span>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-on-surface-variant/70">
          If your agent can make an HTTP request, it works with AgentKey. No
          SDK, no wrapper, no lock-in.
        </p>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-6 px-8 py-12 md:flex-row">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <span className="text-sm font-bold text-slate-300">AgentKey</span>
          <span className="font-mono text-[10px] uppercase tracking-tight text-slate-500">
            &copy; 2026 AgentKey
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
          {[
            {
              label: "GitHub",
              href: "https://github.com/agentkey-dev/agentkey",
            },
            { label: "Blog", href: "/blog" },
            { label: "Security", href: "/security" },
            { label: "Privacy", href: "/legal/privacy" },
            { label: "Terms", href: "/legal/terms" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-mono text-[10px] uppercase tracking-tight text-slate-600 transition-all hover:text-slate-300 hover:underline"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* ─── Icons ─── */
function KeyIcon({ className }: { className?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="8" cy="15" r="5" />
      <path d="M11.5 11.5L21 2" />
      <path d="M18 5l3-3" />
      <path d="M16 7l2-2" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.5 10.677a2 2 0 0 0 2.823 2.823" />
      <path d="M7.362 7.561C5.68 8.74 4.279 10.42 3 12c1.889 2.991 5.282 6 9 6 1.55 0 3.043-.523 4.395-1.35M12 6c3.718 0 7.111 3.009 9 6-.947 1.497-2.17 2.93-3.6 4.04" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h2" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.7-2.7-.3-5.5-1.3-5.5-6a4.7 4.7 0 0 1 1.2-3.3c-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.3 0 4.7-2.9 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}

function ContextIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  );
}
