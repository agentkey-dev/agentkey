import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-surface px-6 py-10">
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
            New here?{" "}
            <span className="text-primary">Create an account</span>
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
              Review pending requests, approve agent access, and rotate
              credentials without ever pasting a key into a config file again.
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <SignIn
              path="/sign-in"
              routing="path"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/dashboard"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
