import { CreateOrganization, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default async function OnboardingPage() {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (orgId) {
    redirect("/dashboard");
  }

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
          <UserButton showName />
        </div>
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Almost there
            </div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-on-surface md:text-5xl">
              Name your workspace.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-on-surface-variant">
              You&apos;re 60 seconds from your agent&apos;s first approved
              tool. Pick a name — your company, project, or just your handle if
              you&apos;re solo. You can change it later.
            </p>
            <div className="space-y-4">
              <div className="font-mono text-[11px] uppercase tracking-widest text-on-surface-variant">
                What happens next
              </div>
              <ol className="space-y-3">
                <NextStep num="1" title="Name your workspace" active />
                <NextStep num="2" title="Create your first agent" />
                <NextStep num="3" title="Add a tool your agent needs" />
              </ol>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <CreateOrganization
              path="/onboarding"
              routing="path"
              afterCreateOrganizationUrl="/dashboard"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function NextStep({
  num,
  title,
  active = false,
}: {
  num: string;
  title: string;
  active?: boolean;
}) {
  return (
    <li className="flex items-center gap-4">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${
          active
            ? "border-primary/30 bg-primary text-on-primary"
            : "border-white/10 bg-surface-container text-on-surface-variant"
        }`}
      >
        {num}
      </span>
      <span
        className={`text-sm ${
          active ? "text-on-surface" : "text-on-surface-variant"
        }`}
      >
        {title}
      </span>
    </li>
  );
}
