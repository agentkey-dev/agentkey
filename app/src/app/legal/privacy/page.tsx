import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — AgentKey",
  description:
    "How AgentKey collects, uses, and protects your data. Operated by ANGELTECH SAS.",
  alternates: {
    canonical: "/legal/privacy",
  },
};

export default function PrivacyPage() {
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
          <h1 className="mb-6 text-4xl font-bold tracking-tighter text-on-surface">
            Privacy Policy
          </h1>
          <p className="text-sm text-on-surface-variant">
            Last updated: March 30, 2026
          </p>
        </header>

        <div className="prose-agentkey space-y-8 text-sm leading-relaxed text-on-surface-variant [&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-on-surface [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-on-surface [&_strong]:text-on-surface">
          <h2>Who we are</h2>

          <p>
            AgentKey is operated by{" "}
            <strong>ANGELTECH (GRAINES DE CODE)</strong>, a simplified
            joint-stock company (SAS) registered in France under SIREN 878 731
            157, with its registered office at 9 Route de la Conche, 19320
            Saint-Martin-la-Meanne, France.
          </p>

          <p>
            For the purposes of the EU General Data Protection Regulation
            (GDPR), ANGELTECH is the data controller for personal data collected
            through AgentKey. For credentials and organizational data that you
            store in AgentKey, ANGELTECH acts as a data processor on your behalf.
          </p>

          <h2>What data we collect</h2>

          <h3>Account data</h3>

          <p>
            When you sign up, we collect your email address, name, and
            organization details through our authentication provider (Clerk).
            This data is used to identify you, manage your account, and
            communicate with you about the service.
          </p>

          <h3>Organizational data</h3>

          <p>
            You create and manage the following data within AgentKey:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Agent registrations</strong> — agent names, descriptions,
              and hashed API keys
            </li>
            <li>
              <strong>Tool configurations</strong> — tool names, descriptions,
              URLs, auth types, and usage instructions
            </li>
            <li>
              <strong>Encrypted credentials</strong> — SaaS API keys, OAuth
              tokens, and bot tokens stored in AES-256-GCM encrypted form
            </li>
            <li>
              <strong>Access grants</strong> — which agents have access to which
              tools, with approval status and justifications
            </li>
            <li>
              <strong>Audit logs</strong> — a record of all actions taken in
              your organization (registrations, approvals, denials, credential
              fetches, revocations)
            </li>
            <li>
              <strong>Notification settings</strong> — Slack and Discord webhook
              URLs (encrypted)
            </li>
          </ul>

          <h3>Usage analytics</h3>

          <p>
            We use Vercel Analytics to collect anonymous, aggregated usage data
            about how the marketing site and dashboard are used (page views,
            navigation patterns). Vercel Analytics is privacy-friendly: it does
            not use cookies for tracking, does not collect personal identifiers,
            and does not track users across sites.
          </p>

          <h2>What we do not collect or do</h2>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              We <strong>never</strong> access, read, or log the decrypted
              content of your stored credentials
            </li>
            <li>
              We <strong>never</strong> sell, share, or trade personal data or
              organizational data with third parties for marketing or
              advertising
            </li>
            <li>
              We <strong>never</strong> use your credentials, tool
              configurations, or agent data for training AI models
            </li>
            <li>
              We do <strong>not</strong> use tracking cookies or third-party
              advertising trackers
            </li>
          </ul>

          <h2>How we use your data</h2>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>To provide the service</strong> — storing credentials,
              vending them to authorized agents, managing access grants,
              generating audit logs
            </li>
            <li>
              <strong>To communicate with you</strong> — account-related emails,
              service notifications, security alerts
            </li>
            <li>
              <strong>To improve the product</strong> — aggregated, anonymized
              usage patterns (not credential content or personal data)
            </li>
            <li>
              <strong>To power AI features</strong> — tool names, URLs, and
              publicly available documentation are processed by AI models to
              generate setup guides and form drafts. Credentials are never sent
              to AI model providers.
            </li>
          </ul>

          <h2>Legal basis for processing (GDPR)</h2>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Contract performance</strong> — processing necessary to
              provide the AgentKey service (Article 6(1)(b))
            </li>
            <li>
              <strong>Legitimate interest</strong> — product improvement through
              anonymized analytics, security monitoring (Article 6(1)(f))
            </li>
          </ul>

          <h2>Data storage and security</h2>

          <h3>Where data is stored</h3>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Database</strong> — Neon PostgreSQL, hosted in AWS
              us-east-1 (N. Virginia, United States)
            </li>
            <li>
              <strong>Application hosting</strong> — Vercel, us-east-1 region
              (United States)
            </li>
            <li>
              <strong>Authentication</strong> — Clerk, hosted in the United
              States
            </li>
          </ul>

          <p>
            Data is transferred from the EU to the United States under the
            EU-U.S. Data Privacy Framework. Our subprocessors (Cloudflare,
            Vercel, Neon, Clerk) participate in the framework and maintain
            appropriate safeguards.
          </p>

          <h3>How data is protected</h3>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              Credentials are AES-256-GCM encrypted at rest with per-record
              random initialization vectors and authentication tags
            </li>
            <li>All data in transit is encrypted via TLS</li>
            <li>
              Agent API keys are stored as SHA-256 hashes, not in recoverable
              form
            </li>
            <li>
              Webhook URLs (Slack, Discord) are encrypted at rest using the same
              AES-256-GCM scheme
            </li>
          </ul>

          <p>
            See our{" "}
            <Link href="/security" className="text-primary hover:underline">
              Security page
            </Link>{" "}
            for detailed technical information.
          </p>

          <h2>Data retention</h2>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Account data</strong> — retained while your account is
              active. Deleted upon account deletion.
            </li>
            <li>
              <strong>Credentials</strong> — permanently deleted when the tool
              is removed or the organization is deleted.
            </li>
            <li>
              <strong>Audit logs</strong> — retained for 30 days on the free
              tier. Retained for 30 days after organization deletion, then
              permanently purged.
            </li>
            <li>
              <strong>Analytics data</strong> — anonymized and aggregated. No
              personal data is retained in analytics.
            </li>
          </ul>

          <h2>Your rights (GDPR)</h2>

          <p>
            As a data subject under GDPR, you have the right to:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              <strong>Access</strong> — request a copy of the personal data we
              hold about you
            </li>
            <li>
              <strong>Rectification</strong> — correct inaccurate personal data
            </li>
            <li>
              <strong>Erasure</strong> — request deletion of your personal data
              (deleting your organization achieves this)
            </li>
            <li>
              <strong>Data portability</strong> — export your data (AgentKey
              supports YAML export of tool configurations)
            </li>
            <li>
              <strong>Objection</strong> — object to processing based on
              legitimate interest
            </li>
            <li>
              <strong>Restriction</strong> — request that we restrict processing
              of your data
            </li>
          </ul>

          <p>
            To exercise any of these rights, contact us at{" "}
            <a
              href="mailto:privacy@agentkey.dev"
              className="text-primary hover:underline"
            >
              privacy@agentkey.dev
            </a>
            . We will respond within 30 days.
          </p>

          <p>
            You also have the right to lodge a complaint with your local data
            protection authority. In France, this is the{" "}
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              CNIL
            </a>{" "}
            (Commission Nationale de l&apos;Informatique et des
            Libert&eacute;s).
          </p>

          <h2>Subprocessors</h2>

          <p>
            We use the following third-party services to operate AgentKey:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10 font-mono text-[10px] uppercase text-on-surface-variant">
                  <th className="py-3 pr-6 font-normal">Provider</th>
                  <th className="py-3 pr-6 font-normal">Purpose</th>
                  <th className="py-3 font-normal">Location</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-on-surface">Cloudflare</td>
                  <td className="py-3 pr-6">
                    Edge protection (WAF, DDoS), DNS, email routing, TLS
                    termination
                  </td>
                  <td className="py-3">Global (300+ cities)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-on-surface">Vercel</td>
                  <td className="py-3 pr-6">
                    Application hosting, serverless functions, analytics
                  </td>
                  <td className="py-3">United States</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-on-surface">Neon</td>
                  <td className="py-3 pr-6">PostgreSQL database</td>
                  <td className="py-3">United States (us-east-1)</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-on-surface">Clerk</td>
                  <td className="py-3 pr-6">
                    User authentication and organization management
                  </td>
                  <td className="py-3">United States</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-6 text-on-surface">
                    Vercel AI Gateway
                  </td>
                  <td className="py-3 pr-6">
                    AI model routing for setup guide generation and form
                    drafting (tool names and URLs only, never credentials)
                  </td>
                  <td className="py-3">United States</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            We will update this list when we add new subprocessors. Material
            changes will be communicated through the dashboard or by email.
          </p>

          <h2>Cookies</h2>

          <p>
            AgentKey uses only strictly necessary cookies for authentication
            (session management via Clerk). We do not use cookies for tracking,
            advertising, or analytics. Vercel Analytics operates without
            cookies.
          </p>

          <h2>Children</h2>

          <p>
            AgentKey is not intended for use by individuals under the age of 16.
            We do not knowingly collect personal data from children.
          </p>

          <h2>Changes to this policy</h2>

          <p>
            We may update this Privacy Policy from time to time. If we make
            material changes, we will notify you through the dashboard or by
            email at least 30 days before the changes take effect. The
            &quot;Last updated&quot; date at the top of this page reflects the
            most recent revision.
          </p>

          <h2>Contact</h2>

          <p>
            For privacy-related questions or to exercise your data rights,
            contact us at{" "}
            <a
              href="mailto:privacy@agentkey.dev"
              className="text-primary hover:underline"
            >
              privacy@agentkey.dev
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
            <Link
              href="/"
              className="font-mono text-[10px] uppercase tracking-tight text-slate-600 transition-all hover:text-slate-300"
            >
              Home
            </Link>
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
              href="/security"
              className="font-mono text-[10px] uppercase tracking-tight text-slate-600 transition-all hover:text-slate-300"
            >
              Security
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
