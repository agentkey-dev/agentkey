import type { Metadata } from "next";
import Link from "next/link";

import { getOptionalTurnstileSiteKey } from "@/lib/env";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

type SignInSearchParams = {
  sent?: string;
  email?: string;
  error?: string;
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<SignInSearchParams>;
}) {
  const params = await searchParams;
  const turnstileSiteKey = getOptionalTurnstileSiteKey();
  const sent = params?.sent === "1";
  const email = params?.email ?? "";

  return (
    <main className="min-h-screen bg-surface px-6 py-10">
      {turnstileSiteKey ? (
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        />
      ) : null}
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-12 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-on-surface"
          >
            AgentKey
          </Link>
          <Link
            href="/sign-up"
            className="text-sm text-on-surface-variant transition-colors hover:text-on-surface"
          >
            New here? <span className="text-primary">Create an account</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-on-surface-variant">
              Welcome back
            </div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-on-surface md:text-5xl">
              Sign in to your{" "}
              <span className="text-primary">AgentKey</span> workspace.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-on-surface-variant">
              Enter your email and we&apos;ll send a one-time link to recover
              your account and workspace access.
            </p>
          </div>
          <div className="w-full max-w-md justify-self-center rounded-sm border border-white/10 bg-surface-container p-6 lg:justify-self-end">
            {sent ? (
              <div className="mb-5 rounded-sm border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-on-surface">
                Check {email || "your inbox"} for your sign-in link.
              </div>
            ) : null}
            {params?.error ? (
              <div className="mb-5 rounded-sm border border-error/30 bg-error/10 px-4 py-3 text-sm text-on-surface">
                That sign-in link is invalid or expired. Request a new one.
              </div>
            ) : null}
            <form action="/api/auth/magic-link" method="post" className="space-y-5">
              <label className="block space-y-2">
                <span className="text-sm text-on-surface-variant">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  defaultValue={email}
                  className="w-full rounded-sm border border-white/10 bg-surface-container-lowest px-3 py-2 text-on-surface outline-none focus:border-primary"
                />
              </label>
              {turnstileSiteKey ? (
                <div
                  className="cf-turnstile"
                  data-sitekey={turnstileSiteKey}
                  data-action="magic_link"
                />
              ) : null}
              <button
                type="submit"
                className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
              >
                Send sign-in link
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
