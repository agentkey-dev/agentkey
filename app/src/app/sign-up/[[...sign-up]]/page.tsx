import type { Metadata } from "next";
import Link from "next/link";

import { getOptionalTurnstileSiteKey } from "@/lib/env";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function SignUpPage() {
  const turnstileSiteKey = getOptionalTurnstileSiteKey();

  return (
    <main className="min-h-screen bg-surface px-6 py-10">
      {turnstileSiteKey ? (
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        />
      ) : null}
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-on-surface"
          >
            AgentKey
          </Link>
          <Link
            href="/sign-in"
            className="text-sm text-on-surface-variant transition-colors hover:text-on-surface"
          >
            Already have an account? <span className="text-primary">Sign in</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-8">
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-on-surface md:text-5xl">
              Give your AI agents their own{" "}
              <span className="text-primary">API keys.</span>
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-on-surface-variant">
              Create an account with a one-time email link. After sign-in,
              create a workspace and start approving agent access.
            </p>
            <ul className="space-y-3 text-sm text-on-surface-variant">
              <li className="flex items-start gap-3">
                <CheckDot />
                <span>
                  <span className="text-on-surface">One block in your CLAUDE.md or TOOLS.md.</span>{" "}
                  No SDK, no wrapper, no framework lock-in.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckDot />
                <span>
                  <span className="text-on-surface">Agents request access, you approve.</span>{" "}
                  Every credential is issued on demand and logged.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckDot />
                <span>
                  <span className="text-on-surface">AES-256 encrypted at rest.</span>{" "}
                  One-click revoke. Append-only audit trail.
                </span>
              </li>
            </ul>
          </div>
          <div className="w-full max-w-md justify-self-center rounded-sm border border-white/10 bg-surface-container p-6 lg:justify-self-end">
            <form action="/api/auth/magic-link" method="post" className="space-y-5">
              <label className="block space-y-2">
                <span className="text-sm text-on-surface-variant">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-sm border border-white/10 bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
                />
              </label>
              {turnstileSiteKey ? (
                <div
                  className="cf-turnstile"
                  data-sitekey={turnstileSiteKey}
                />
              ) : null}
              <button
                type="submit"
                className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
              >
                Send sign-up link
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function CheckDot() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-3 w-3 text-primary"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.5 8.5 6.5 11.5 12.5 5.5" />
      </svg>
    </span>
  );
}
