import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security — AgentKey",
  description:
    "How AgentKey protects your credentials. AES-256-GCM encryption, audit logging, and responsible disclosure.",
  alternates: {
    canonical: "/security",
  },
};

export default function SecurityPage() {
  return (
    <>
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
          <span className="mb-4 block font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Security
          </span>
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tighter text-on-surface md:text-5xl">
            How AgentKey protects your credentials
          </h1>
          <p className="text-lg leading-relaxed text-on-surface-variant">
            AgentKey is a credential management system. Security is not a
            feature — it is the product. Here is exactly how we handle your
            data.
          </p>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
            Last reviewed · April 2026
          </p>
        </header>

        <div className="prose-agentkey space-y-8 text-sm leading-relaxed text-on-surface-variant [&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-on-surface [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-on-surface [&_strong]:text-on-surface [&_code]:rounded [&_code]:bg-white/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-primary">
          <h2>Threat model</h2>

          <p>
            AgentKey centralizes <strong>approval, audit, rotation, and
            revocation</strong> of the credentials your AI agents use. When an
            agent fetches a credential, it receives the actual secret (API key
            or token) over TLS. The agent then uses that secret directly against
            the target service.
          </p>

          <p>
            This means AgentKey <strong>does not eliminate secret exposure at
            use time</strong>. A compromised agent that has been granted access
            to a tool will be able to read and use that credential until its
            access is revoked.
          </p>

          <h3>What AgentKey does solve</h3>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Who has access to what</strong> — every agent&ndash;tool
              relationship is explicitly approved by a human
            </li>
            <li>
              <strong>Credential sprawl</strong> — secrets live in one encrypted
              store, not scattered across .env files, config repos, and chat
              logs
            </li>
            <li>
              <strong>Visibility</strong> — every credential fetch is logged
              with agent ID, tool, and timestamp
            </li>
            <li>
              <strong>Instant revocation</strong> — one click to cut off an
              agent, effective immediately (no cache, no delay)
            </li>
            <li>
              <strong>Zero-disruption rotation</strong> — rotate a credential
              once, every agent gets the new one on next fetch
            </li>
          </ul>

          <h3>What AgentKey does not solve (yet)</h3>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Secret-free agent execution</strong> — proxy architectures
              where the agent never sees the raw credential are a complementary
              design, not the same thing. We may add a proxy mode in the future,
              but it is not the current model.
            </li>
            <li>
              <strong>Runtime behavior monitoring</strong> — AgentKey controls
              which tools an agent can access, not what the agent does with them
              once it has the credential
            </li>
            <li>
              <strong>Infrastructure-level NHI management</strong> — AgentKey
              operates at the application layer for small-to-mid teams, not at
              enterprise infrastructure scale across thousands of service
              accounts
            </li>
          </ul>

          <p>
            If your threat model requires that agents never see raw secrets,
            you need a proxy — and AgentKey can sit in front of one to handle
            approval, audit, and rotation. The two approaches are complementary.
          </p>

          <h2>Encryption at rest</h2>

          <p>
            All SaaS credentials (API keys, OAuth tokens, bot tokens) and
            webhook URLs (Slack, Discord) are encrypted using{" "}
            <strong>AES-256-GCM</strong> before being written to the database.
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Algorithm:</strong> AES-256-GCM (authenticated encryption
              with associated data)
            </li>
            <li>
              <strong>Implementation:</strong> Node.js built-in{" "}
              <code>node:crypto</code> module
            </li>
            <li>
              <strong>Initialization vector:</strong> 12-byte random IV
              generated per encryption operation using{" "}
              <code>crypto.randomBytes()</code>
            </li>
            <li>
              <strong>Authentication tag:</strong> 16-byte GCM tag stored
              alongside the ciphertext, ensuring both confidentiality and
              integrity
            </li>
            <li>
              <strong>Key:</strong> 256-bit encryption key stored as an
              environment variable, never committed to source control
            </li>
          </ul>

          <p>
            Credentials are never stored in plaintext. They are never logged.
            They are never included in database backups in decrypted form.
          </p>

          <h3>Key management</h3>

          <p>
            The 256-bit encryption key is provided as an environment variable
            and managed by the hosting platform (Vercel on the managed service,
            your infrastructure for self-hosted deployments). This is a
            single-key model — appropriate for the current threat model but
            without envelope encryption or HSM-backed key storage.
          </p>

          <p>
            For deployments that require HSM-backed key management or envelope
            encryption (e.g., SOC 2 Type II, HIPAA), these capabilities are on
            the roadmap. Contact us at{" "}
            <a
              href="mailto:security@agentkey.dev"
              className="text-primary hover:underline"
            >
              security@agentkey.dev
            </a>{" "}
            if this is a requirement for your organization.
          </p>

          <h2>Encryption in transit</h2>

          <p>
            All connections to AgentKey use TLS (HTTPS). This includes:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>Dashboard access (admin interface)</li>
            <li>Agent API calls (credential fetching, access requests)</li>
            <li>
              Connections between AgentKey and its infrastructure providers
              (database, authentication)
            </li>
          </ul>

          <h2>Agent API key management</h2>

          <p>
            When you register an agent, AgentKey generates an API key in the
            format <code>sk_agent_</code> followed by 24 cryptographically
            random bytes (base64url encoded).
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              The API key is shown to you <strong>once</strong> at creation
              time. It is never displayed again.
            </li>
            <li>
              Only a <strong>SHA-256 hash</strong> of the key is stored in the
              database. The original key cannot be recovered from the hash.
            </li>
            <li>
              API key verification uses{" "}
              <strong>timing-safe comparison</strong> (
              <code>crypto.timingSafeEqual()</code>) to prevent timing attacks.
            </li>
          </ul>

          <h2>Credential vending</h2>

          <p>
            Agents do not store SaaS credentials. They fetch them on demand via
            the API:
          </p>

          <ol className="list-inside list-decimal space-y-2 pl-4">
            <li>Agent authenticates with its API key</li>
            <li>
              AgentKey verifies the agent has an approved access grant for the
              requested tool
            </li>
            <li>
              The credential is decrypted in memory and returned over TLS
            </li>
            <li>
              The fetch is recorded in the audit log with timestamp, agent ID,
              and tool ID
            </li>
          </ol>

          <p>
            If the agent&apos;s access has been revoked, the request returns
            HTTP 403. Revocation is immediate — there is no cache or delay.
          </p>

          <h2>Audit logging</h2>

          <p>
            Every action in AgentKey is recorded in an append-only audit log:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>Agent registration and suspension</li>
            <li>Tool creation, update, and deletion</li>
            <li>Access requests and their justifications</li>
            <li>Approvals and denials (with who decided and when)</li>
            <li>Credential fetches (which agent, which tool, when)</li>
            <li>Credential rotations</li>
            <li>Access revocations</li>
          </ul>

          <p>
            Audit logs are queryable and filterable by agent, tool, action type,
            and date range. They are retained for 30 days on the hosted
            service. Self-hosted deployments retain audit logs for as long as
            you keep the underlying database.
          </p>

          <h2>AI features and credential isolation</h2>

          <p>
            AgentKey offers AI-powered features (setup guide generation, form
            drafting). These features process:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>Tool names and URLs</li>
            <li>Publicly available documentation content</li>
            <li>Agent justification text (why the agent needs the tool)</li>
          </ul>

          <p>
            <strong>
              Credentials are never sent to AI model providers.
            </strong>{" "}
            The AI features operate exclusively on metadata and public
            information. There is a hard boundary in the codebase between
            credential decryption (which only happens during agent API calls)
            and AI feature processing.
          </p>

          <h2>Edge protection — Cloudflare Enterprise</h2>

          <p>
            All traffic to AgentKey passes through Cloudflare Enterprise,
            providing multiple layers of protection before requests reach the
            application:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>WAF Managed Rulesets</strong> — Cloudflare Managed Ruleset
              and OWASP Core Ruleset active. Blocks SQL injection, XSS,
              and other common attack vectors at the edge.
            </li>
            <li>
              <strong>Exposed Credentials Check</strong> — automatically
              detects and blocks requests containing known leaked credentials.
            </li>
            <li>
              <strong>DDoS Mitigation</strong> — automatic L3/L4/L7 DDoS
              protection. AgentKey stays available even under attack.
            </li>
            <li>
              <strong>Custom WAF Rules</strong> — block unusual HTTP methods on
              API endpoints, challenge suspicious sign-up attempts, reject
              high-threat-score requests.
            </li>
            <li>
              <strong>Tiered Caching</strong> — reduces origin load and
              improves global response times.
            </li>
            <li>
              <strong>Agent-friendly bot policy</strong> — AgentKey is designed
              for AI agent traffic. Bot management is configured to allow
              automated API access while protecting the dashboard from abuse.
            </li>
          </ul>

          <h3>TLS configuration</h3>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              SSL mode: <strong>Full (Strict)</strong> — end-to-end encryption
              with origin certificate validation
            </li>
            <li>Minimum TLS version: <strong>1.2</strong></li>
            <li>TLS 1.3 and 0-RTT connection resumption: enabled</li>
            <li>
              HTTP/2 and HTTP/3 (QUIC): enabled for faster connections
            </li>
            <li>Automatic HTTPS rewrites and Always Use HTTPS: enforced</li>
          </ul>

          <h2>Infrastructure</h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10 font-mono text-[10px] uppercase text-on-surface-variant">
                  <th className="py-3 pr-6 font-normal">Component</th>
                  <th className="py-3 pr-6 font-normal">Provider</th>
                  <th className="py-3 font-normal">Region</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-on-surface">
                    Edge protection
                  </td>
                  <td className="py-3 pr-6">
                    Cloudflare Enterprise (WAF, DDoS, TLS)
                  </td>
                  <td className="py-3">Global (300+ cities)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-on-surface">Application</td>
                  <td className="py-3 pr-6">Vercel (serverless)</td>
                  <td className="py-3">us-east-1</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-on-surface">Database</td>
                  <td className="py-3 pr-6">Neon PostgreSQL</td>
                  <td className="py-3">us-east-1</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-on-surface">Authentication</td>
                  <td className="py-3 pr-6">Clerk</td>
                  <td className="py-3">United States</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-on-surface">AI features</td>
                  <td className="py-3 pr-6">Vercel AI Gateway</td>
                  <td className="py-3">United States</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Incident response</h2>

          <p>
            In the event of a security breach that affects your data:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              We will notify affected users within{" "}
              <strong>72 hours</strong> of confirming the breach (consistent
              with GDPR requirements)
            </li>
            <li>
              Notification will include: what happened, what data was affected,
              what actions we are taking, and what actions you should take
              (e.g., rotating credentials)
            </li>
            <li>
              We will notify the CNIL (French data protection authority) as
              required by GDPR Article 33
            </li>
          </ul>

          <h2>Responsible disclosure</h2>

          <p>
            If you discover a security vulnerability in AgentKey, we ask that
            you disclose it responsibly:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              Email{" "}
              <a
                href="mailto:security@agentkey.dev"
                className="text-primary hover:underline"
              >
                security@agentkey.dev
              </a>{" "}
              with a description of the vulnerability
            </li>
            <li>
              Include steps to reproduce, if possible
            </li>
            <li>
              Allow us reasonable time (90 days) to address the issue before
              public disclosure
            </li>
            <li>
              Do not access, modify, or delete data belonging to other users
              during your research
            </li>
          </ul>

          <p>
            We will acknowledge receipt within 48 hours and provide an initial
            assessment within 7 days. We appreciate and credit security
            researchers who follow responsible disclosure practices.
          </p>

          <h2>Rate limiting and abuse prevention</h2>

          <p>
            All API endpoints are rate limited to prevent abuse:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Agent API:</strong> 3-tier sliding window rate limiting
              per agent — 10 requests/hour for access requests, 60/minute for
              credential fetches, 120/minute for reads
            </li>
            <li>
              <strong>Admin API:</strong> 30 requests/minute per user on all
              mutation endpoints (tool creation, agent creation, approvals,
              key rotation)
            </li>
            <li>
              Failed authentication attempts are logged with structured
              metadata for security monitoring
            </li>
            <li>
              Suspended agents are rejected immediately and the attempt is
              recorded in the audit log
            </li>
          </ul>

          <h2>HTTP security headers</h2>

          <p>
            AgentKey enforces the following security headers on all responses:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Content-Security-Policy</strong> — restricts script,
              style, image, and connection sources to known origins
            </li>
            <li>
              <strong>Strict-Transport-Security</strong> — HSTS with a 2-year
              max-age, including subdomains
            </li>
            <li>
              <strong>X-Frame-Options: DENY</strong> — prevents clickjacking
            </li>
            <li>
              <strong>X-Content-Type-Options: nosniff</strong> — prevents MIME
              sniffing
            </li>
            <li>
              <strong>Permissions-Policy</strong> — disables camera, microphone,
              and geolocation APIs
            </li>
          </ul>

          <h2>What we do not do</h2>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              We do not access decrypted credentials for any purpose other than
              vending them to authorized agents
            </li>
            <li>
              We do not have a &quot;back door&quot; or administrative access to
              view your credentials in plaintext
            </li>
            <li>We do not log credential values in application logs</li>
            <li>
              We do not share credentials or organizational data with third
              parties
            </li>
            <li>
              We do not use your data for training AI models
            </li>
          </ul>

          <h2>Questions</h2>

          <p>
            For security questions or concerns, contact{" "}
            <a
              href="mailto:security@agentkey.dev"
              className="text-primary hover:underline"
            >
              security@agentkey.dev
            </a>
            .
          </p>
        </div>
      </article>

      <footer className="border-t border-white/5 bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-8 py-8 md:flex-row">
          <span className="font-mono text-[10px] uppercase tracking-tight text-slate-500">
            &copy; 2026 AgentKey
          </span>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a
              href="https://github.com/agentkey-dev/agentkey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-tight text-slate-600 transition-all hover:text-slate-300"
            >
              GitHub
            </a>
            <Link
              href="/blog"
              className="font-mono text-[10px] uppercase tracking-tight text-slate-600 transition-all hover:text-slate-300"
            >
              Blog
            </Link>
            <Link
              href="/legal/terms"
              className="font-mono text-[10px] uppercase tracking-tight text-slate-600 transition-all hover:text-slate-300"
            >
              Terms
            </Link>
            <Link
              href="/legal/privacy"
              className="font-mono text-[10px] uppercase tracking-tight text-slate-600 transition-all hover:text-slate-300"
            >
              Privacy
            </Link>
            <Link
              href="/"
              className="font-mono text-[10px] uppercase tracking-tight text-slate-600 transition-all hover:text-slate-300"
            >
              Home
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
