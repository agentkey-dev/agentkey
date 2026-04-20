import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — AgentKey",
  description: "Terms of Service for AgentKey, operated by ANGELTECH SAS.",
  alternates: {
    canonical: "/legal/terms",
  },
};

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-sm text-on-surface-variant">
            Last updated: March 30, 2026
          </p>
        </header>

        <div className="prose-agentkey space-y-8 text-sm leading-relaxed text-on-surface-variant [&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-on-surface [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-on-surface [&_strong]:text-on-surface">
          <h2>1. About these terms</h2>

          <p>
            These Terms of Service (&quot;Terms&quot;) govern your use of
            AgentKey, a SaaS platform for AI agent access governance, operated by{" "}
            <strong>ANGELTECH (GRAINES DE CODE)</strong>, a simplified
            joint-stock company (SAS) registered in France under SIREN 878 731
            157, with its registered office at 9 Route de la Conche, 19320
            Saint-Martin-la-Meanne, France (&quot;we&quot;, &quot;us&quot;,
            &quot;AgentKey&quot;).
          </p>

          <p>
            By creating an account or using AgentKey, you agree to these Terms.
            If you are using AgentKey on behalf of a company or organization, you
            represent that you have authority to bind that entity to these Terms.
          </p>

          <h2>2. What AgentKey provides</h2>

          <p>
            AgentKey is a platform that lets you manage which SaaS tools your AI
            agents can access, with human approval workflows, encrypted
            credential storage, and audit logging. AgentKey stores credentials
            you provide and vends them to your agents on demand.
          </p>

          <p>
            AgentKey is <strong>not</strong> a SaaS tool provider. We do not
            create accounts on third-party services on your behalf, and we are
            not responsible for the terms, availability, or behavior of
            third-party services whose credentials you store in AgentKey.
          </p>

          <h2>3. Your account</h2>

          <p>
            You are responsible for maintaining the security of your account and
            the agent API keys generated through AgentKey. You are responsible
            for all activity that occurs under your account, including actions
            taken by AI agents using credentials vended through AgentKey.
          </p>

          <p>
            You must provide accurate information when creating your account. You
            must not create accounts through automated means or operate multiple
            accounts for the purpose of circumventing usage policies.
          </p>

          <h2>4. Credentials and data</h2>

          <h3>Your responsibility</h3>

          <p>
            You are solely responsible for the credentials you store in
            AgentKey. You represent that you have the right to store and
            distribute these credentials to your AI agents, and that doing so
            does not violate the terms of the third-party services those
            credentials belong to.
          </p>

          <h3>How we handle credentials</h3>

          <p>
            Credentials are encrypted at rest using AES-256-GCM. They are never
            stored in plaintext, never logged, and never accessible to AgentKey
            staff in decrypted form. Credentials are decrypted only at the
            moment an authorized agent requests them via the API, and are
            transmitted over TLS-encrypted connections.
          </p>

          <p>
            We do not use, analyze, or share the content of your credentials for
            any purpose other than vending them to your authorized agents.
          </p>

          <h3>AI features</h3>

          <p>
            AgentKey offers AI-powered features such as setup guide generation
            and form drafting. These features process tool names, URLs, and
            publicly available documentation. They do not process or transmit
            your stored credentials to AI model providers.
          </p>

          <h2>5. Acceptable use</h2>

          <p>You agree not to:</p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              Store credentials for the purpose of unauthorized access to
              third-party services
            </li>
            <li>
              Use AgentKey as infrastructure for attacks, scraping, or any
              illegal activity
            </li>
            <li>
              Resell, white-label, or redistribute AgentKey as part of a
              competing product without prior written agreement
            </li>
            <li>
              Create automated accounts at scale or abuse the API in a way that
              degrades service for other users
            </li>
            <li>
              Reverse engineer, decompile, or attempt to extract the source code
              of AgentKey
            </li>
          </ul>

          <h2>6. Fair use</h2>

          <p>
            AgentKey is free to use for teams managing AI agent access. We
            reserve the right to contact you and establish separate terms if your
            usage significantly exceeds what is typical for a team (for example,
            operating hundreds of agents or making sustained high-volume API
            calls). We will always reach out before taking any action.
          </p>

          <h2>7. Service availability</h2>

          <p>
            AgentKey is provided on an &quot;as-is&quot; and
            &quot;as-available&quot; basis. We do not guarantee any level of
            uptime or availability. We will make reasonable efforts to keep the
            service operational but may perform maintenance, updates, or changes
            at any time without prior notice.
          </p>

          <p>
            We may suspend or restrict access to your account if we reasonably
            believe you are violating these Terms or engaging in activity that
            threatens the security or stability of the platform.
          </p>

          <h2>8. Limitation of liability</h2>

          <p>
            To the maximum extent permitted by applicable law, AgentKey and
            ANGELTECH shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, including but not limited to
            loss of data, loss of revenue, or business interruption, arising out
            of or related to your use of AgentKey.
          </p>

          <p>
            In particular, we are not liable for actions taken by your AI agents
            using credentials vended through AgentKey, for the availability or
            behavior of third-party services, or for any unauthorized access
            resulting from your failure to secure your account or agent API keys.
          </p>

          <p>
            Our total aggregate liability for any claims arising from or related
            to these Terms shall not exceed the amount you have paid us in the
            twelve (12) months preceding the claim, or one hundred euros
            (EUR&nbsp;100), whichever is greater.
          </p>

          <h2>9. Account deletion and data retention</h2>

          <p>
            You may delete your organization and all associated data at any
            time. Upon deletion:
          </p>

          <ul className="list-inside list-disc space-y-2 pl-4">
            <li>
              All stored credentials are permanently and irreversibly deleted
            </li>
            <li>All agent registrations and access grants are deleted</li>
            <li>
              Audit logs are retained for 30 days after deletion for security
              purposes, then permanently purged
            </li>
          </ul>

          <h2>10. Changes to these terms</h2>

          <p>
            We may update these Terms from time to time. If we make material
            changes, we will notify you through the dashboard or by email at
            least 30 days before the changes take effect. Your continued use of
            AgentKey after the effective date constitutes acceptance of the
            updated Terms.
          </p>

          <h2>11. Governing law</h2>

          <p>
            These Terms are governed by the laws of France. Any dispute arising
            from or related to these Terms shall be subject to the exclusive
            jurisdiction of the courts of Tulle, France.
          </p>

          <h2>12. Contact</h2>

          <p>
            For questions about these Terms, contact us at{" "}
            <a
              href="mailto:legal@agentkey.dev"
              className="text-primary hover:underline"
            >
              legal@agentkey.dev
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
              href="/legal/privacy"
              className="font-mono text-[10px] uppercase tracking-tight text-slate-600 transition-all hover:text-slate-300"
            >
              Privacy
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
