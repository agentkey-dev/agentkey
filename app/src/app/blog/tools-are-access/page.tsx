import type { Metadata } from "next";
import Link from "next/link";

import { formatBlogPostDate, getBlogPostMetadata } from "@/lib/blog";
import { getAppOrigin } from "@/lib/origin";

const post = getBlogPostMetadata("tools-are-access");

export const metadata: Metadata = {
  title: post.metaTitle,
  description: post.description,
  alternates: {
    canonical: post.path,
  },
  openGraph: {
    title: post.title,
    description: post.description,
    url: post.path,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: post.title,
    description: post.description,
  },
};

export default function ToolsAreAccessPost() {
  const origin = getAppOrigin();
  const relatedPosts = post.relatedSlugs.map((slug) => getBlogPostMetadata(slug));
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    url: `${origin}${post.path}`,
    image: `${origin}${post.path}/opengraph-image`,
    author: {
      "@type": "Organization",
      name: "AgentKey",
    },
    publisher: {
      "@type": "Organization",
      name: "AgentKey",
      logo: {
        "@type": "ImageObject",
        url: `${origin}/favicon-32x32.png`,
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="text-xl font-bold tracking-tighter text-white"
          >
            AgentKey
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/blog"
              className="text-sm tracking-tight text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Blog
            </Link>
            <Link
              href="/sign-in"
              className="rounded-sm px-4 py-2 text-sm tracking-tight text-on-surface-variant transition-colors hover:bg-white/5 hover:text-on-surface"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      <article className="mx-auto max-w-2xl px-6 py-20">
        <header className="mb-16">
          <div className="mb-4 flex flex-wrap items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">
            <time dateTime={post.publishedAt}>
              {formatBlogPostDate(post.publishedAt)}
            </time>
            <span aria-hidden="true">•</span>
            <address className="not-italic">AgentKey</address>
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tighter text-on-surface md:text-5xl">
            Tools Aren&apos;t Just Code.
            <br />
            They&apos;re Access.
          </h1>
          <p className="text-lg leading-relaxed text-on-surface-variant">
            Every agent framework treats tools as function definitions. But the
            hard part was never the code — it&apos;s the credentials, the
            context, and the governance. Here&apos;s why AI agents need an
            access layer, and what that looks like.
          </p>
        </header>

        <div className="prose-agentkey space-y-8 text-base leading-relaxed text-on-surface-variant [&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-on-surface [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-on-surface [&_strong]:text-on-surface [&_code]:rounded [&_code]:bg-white/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-primary">
          <h2>The current model is broken</h2>

          <p>
            In 2026, the way we give AI agents access to external services is
            roughly the same as how we did it in 2024: paste an API key into an
            environment variable and hope for the best.
          </p>

          <p>
            Agent frameworks have gotten sophisticated about everything else.
            Tool calling has type-safe schemas. MCP gives us a standard protocol.
            Function calling is reliable across providers. But the actual
            <strong> credentials</strong> — the API keys, OAuth tokens, and bot
            tokens that make tools work — are still managed the way we managed
            them before agents existed: scattered across config files, committed
            to repos by accident, shared between agents with no attribution, and
            never audited.
          </p>

          <p>
            This works when you have one engineer running one agent. It breaks
            when you have a team running twenty.
          </p>

          <h2>Tools are not functions</h2>

          <p>
            The word &quot;tool&quot; has two meanings in the agent world, and
            the conflation is causing problems.
          </p>

          <p>
            In agent frameworks, a <strong>tool</strong> is a function
            definition — a schema that tells the LLM what parameters to pass and
            what the function does. The code to call the Linear API, send a
            Slack message, or create a GitHub PR. This is the computation layer.
          </p>

          <p>
            But there&apos;s another meaning: a <strong>tool</strong> is a SaaS
            service your company pays for and your agents need access to. Linear,
            GitHub, Slack, Stripe, Notion, Discord. This is the access layer.
          </p>

          <p>
            The computation layer is solved. Agent frameworks, MCP servers, and
            function calling handle it well. The access layer is not.
          </p>

          <h2>What the access layer needs to do</h2>

          <p>
            When a new human employee joins a company, they don&apos;t start with
            access to every SaaS tool. They discover what they need, request
            access through IT, get approved, and receive credentials. Their access
            is auditable, revocable, and reviewed periodically. This is access
            governance, and it&apos;s a solved problem for humans — Okta, Lumos,
            BetterCloud, and the rest of the IGA category handle it every day.
          </p>

          <p>
            AI agents need the exact same thing. But they can&apos;t fill out an
            IT request form. They can&apos;t do an OAuth flow in a browser. They
            can&apos;t enter a credit card. And they proliferate faster than
            humans — spinning up 10 agents for a project is normal now.
          </p>

          <p>The access layer for agents needs to:</p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Store credentials centrally</strong> — encrypted, never in
              agent configs
            </li>
            <li>
              <strong>Vend credentials on demand</strong> — agents fetch them
              via API, never hardcode them
            </li>
            <li>
              <strong>Gate access behind human approval</strong> — no agent
              self-provisions access to a SaaS
            </li>
            <li>
              <strong>Audit everything</strong> — who requested what, who
              approved it, when credentials were fetched
            </li>
            <li>
              <strong>Let agents drive discovery</strong> — agents suggest the
              tools they need instead of humans guessing
            </li>
            <li>
              <strong>Deliver context alongside credentials</strong> — not just
              the API key, but how to use it in this specific company
            </li>
          </ul>

          <h2>Context on demand, not context by default</h2>

          <p>
            There&apos;s a subtlety here that matters for agent performance. When
            an agent has access to 10 tools, the instructions for all 10 tools
            don&apos;t need to be in the system prompt. That&apos;s wasted
            context.
          </p>

          <p>
            What the agent needs in its system prompt is: &quot;call this API to
            see what tools are available and fetch credentials when you need
            them.&quot; The actual tool-specific context — Discord channel IDs,
            GitHub repo conventions, Linear project keys — is loaded only when
            the agent fetches the credential for that specific tool. Lazy-loaded
            context.
          </p>

          <p>
            This is the same pattern as lazy imports in code. Don&apos;t load
            what you don&apos;t use. An agent working on a bug fix doesn&apos;t
            need Discord channel IDs in its context window. It needs them only if
            it decides to post an incident alert.
          </p>

          <h2>Agents should drive procurement</h2>

          <p>
            The most interesting shift is in who initiates the process. In the
            current model, a human provisions tools and hopes agents will use
            them. In the access governance model, agents tell you what they need.
          </p>

          <p>
            An agent boots up, checks the tool catalog, and finds it empty — or
            finds that the tool it needs isn&apos;t there. Instead of failing
            silently, it submits a suggestion: &quot;I need Linear for issue
            tracking. Here&apos;s the URL, here&apos;s why.&quot; Another agent,
            doing different work, backs the same suggestion: &quot;I also need
            Linear for sprint planning.&quot;
          </p>

          <p>
            The admin sees one suggestion with two agents backing it. The demand
            is clear. They add Linear to the catalog, enter the credentials, and
            both agents automatically get pending access requests. One approval
            flow, triggered entirely by the agents.
          </p>

          <p>
            This is how companies with dozens of agents will work. The human
            isn&apos;t a curator — they&apos;re an approver. The agents drive
            procurement. The human maintains control.
          </p>

          <h2>What this looks like in practice</h2>

          <p>
            We built AgentKey to test this thesis. It&apos;s a REST API that any
            agent can call — no special SDK, no framework lock-in. The agent
            authenticates with one API key and can:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>Browse the tool catalog and see its access status for each tool</li>
            <li>Request access to a tool with a justification</li>
            <li>Suggest a tool that doesn&apos;t exist yet</li>
            <li>Fetch credentials and a company-specific usage guide for approved tools</li>
          </ul>

          <p>
            On the human side, there&apos;s a dashboard showing agents, tools,
            pending requests, and an audit log. Approve, deny, or revoke with one
            click. Webhook notifications for Slack and Discord so you don&apos;t
            have to check the dashboard manually.
          </p>

          <p>
            The agent never stores raw SaaS credentials. They&apos;re AES-256
            encrypted at rest and vended on demand. When you rotate a credential,
            every agent gets the new one on their next fetch. No config updates,
            no redeployment. The full control set is documented on our{" "}
            <Link href="/security" className="text-primary hover:underline">
              security page
            </Link>
            .
          </p>

          <h2>The access layer is the next infrastructure primitive</h2>

          <p>
            We think access governance for agents will become as standard as
            identity management is for humans. Every company running agents in
            production will need to answer: which agent has access to what, who
            approved it, and can I revoke it instantly?
          </p>

          <p>
            The companies that figure this out early — that treat agent access as
            a first-class infrastructure concern, not an afterthought — will be
            the ones that scale to hundreds of agents without a security incident
            being their wake-up call.
          </p>

          <p>
            Tools aren&apos;t just code. They&apos;re access. And access needs
            governance.
          </p>
        </div>

        {relatedPosts.length > 0 && (
          <section className="mt-16 border-t border-white/10 pt-10">
            <h2 className="text-xl font-bold text-on-surface">Related reading</h2>
            <div className="mt-6 grid gap-4">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.slug}
                  href={relatedPost.path}
                  className="block border border-white/10 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
                    {formatBlogPostDate(relatedPost.publishedAt)}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-on-surface">
                    {relatedPost.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                    {relatedPost.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-20 border border-primary/20 bg-primary/5 p-8 text-center">
          <h3 className="mb-4 text-xl font-bold text-on-surface">
            Try the hosted demo
          </h3>
          <p className="mb-6 text-sm text-on-surface-variant">
            An experiment. Self-hostable. Works with any AI agent.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex rounded-sm bg-primary px-8 py-3 font-bold text-on-primary transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
          >
            Try it
          </Link>
        </div>
      </article>

      <footer className="border-t border-white/5 bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-8 py-8 md:flex-row">
          <span className="font-mono text-[10px] uppercase tracking-tight text-slate-500">
            &copy; 2026 AgentKey
          </span>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { label: "Home", href: "/" },
              { label: "Blog", href: "/blog" },
              { label: "GitHub", href: "https://github.com/agentkey-dev/agentkey" },
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
    </>
  );
}
