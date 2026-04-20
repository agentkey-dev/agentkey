import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6 py-16">
      <div className="w-full max-w-2xl border border-white/10 bg-surface-container p-10 text-center">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          404
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-on-surface">
          Page not found
        </h1>
        <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
          The page you requested does not exist or has moved.
        </p>
        <p className="mt-6 text-sm leading-relaxed text-on-surface-variant/80">
          While you&apos;re here — AgentKey is access governance for AI agents.
          Free, self-hostable, works with every agent framework.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-sm bg-primary px-6 py-3 font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            Back to home
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center justify-center rounded-sm border border-outline-variant px-6 py-3 font-semibold text-on-surface transition-colors hover:bg-white/5"
          >
            Browse the blog
          </Link>
        </div>
      </div>
    </main>
  );
}
