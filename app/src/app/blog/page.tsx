import type { Metadata } from "next";
import Link from "next/link";

import { blogPosts, formatBlogPostDate } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — AgentKey",
  description:
    "Thinking about AI agent access governance, tool provisioning, and the future of agent infrastructure.",
  alternates: {
    canonical: "/blog",
  },
};

export default function BlogIndex() {
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

      <main className="mx-auto max-w-2xl px-6 py-20">
        <header className="mb-16">
          <h1 className="text-4xl font-bold tracking-tighter text-on-surface">
            Blog
          </h1>
          <p className="mt-4 text-lg text-on-surface-variant">
            Thinking about AI agent access, tool provisioning, and the future
            of agent infrastructure.
          </p>
        </header>

        <div className="divide-y divide-white/5">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={post.path}
              className="block py-10 transition-colors hover:bg-white/[0.02]"
            >
              <time
                dateTime={post.publishedAt}
                className="mb-2 block font-mono text-xs uppercase tracking-[0.2em] text-primary"
              >
                {formatBlogPostDate(post.publishedAt)}
              </time>
              <h2 className="mb-3 text-2xl font-bold tracking-tight text-on-surface">
                {post.title}
              </h2>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                {post.excerpt}
              </p>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/5 bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 px-8 py-8 md:flex-row">
          <span className="font-mono text-[10px] uppercase tracking-tight text-slate-500">
            &copy; 2026 AgentKey
          </span>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { label: "Home", href: "/" },
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
