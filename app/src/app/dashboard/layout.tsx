import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { count, eq, and } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { SidebarOrganizationSettingsLink } from "@/components/dashboard/sidebar-organization-settings-link";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { requireDashboardContext } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import {
  accessGrants,
  toolInstructionSuggestions,
  toolSuggestions,
} from "@/lib/db/schema";
import { getOrganizationDashboardOnboardingState } from "@/lib/services/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

async function getPendingCount(organizationId: string) {
  const db = getDb();
  const [[grants], [suggestions], [instructionSuggestions]] = await Promise.all([
    db
      .select({ value: count() })
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.organizationId, organizationId),
          eq(accessGrants.status, "pending"),
        ),
      ),
    db
      .select({ value: count() })
      .from(toolSuggestions)
      .where(
        and(
          eq(toolSuggestions.organizationId, organizationId),
          eq(toolSuggestions.status, "pending"),
        ),
      ),
    db
      .select({ value: count() })
      .from(toolInstructionSuggestions)
      .where(
        and(
          eq(toolInstructionSuggestions.organizationId, organizationId),
          eq(toolInstructionSuggestions.status, "pending"),
        ),
      ),
  ]);
  return (
    (grants?.value ?? 0) +
    (suggestions?.value ?? 0) +
    (instructionSuggestions?.value ?? 0)
  );
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireDashboardContext();
  const [pendingCount, onboarding] = await Promise.all([
    getPendingCount(context.organization.id),
    getOrganizationDashboardOnboardingState({
      organizationId: context.organization.id,
      onboardingDismissedAt: context.organization.onboardingDismissedAt,
    }),
  ]);

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-white/5 bg-surface-container px-6 py-8 lg:border-b-0 lg:border-r">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight text-white">
            AgentKey
          </Link>
          <div className="mt-6">
            <SidebarOrganizationSettingsLink
              organizationName={context.organization.name}
            />
          </div>
          <SidebarNav
            pendingCount={pendingCount}
            highlightDocsNav={onboarding.highlightDocsNav}
          />
        </aside>
        <div className="flex min-h-screen flex-col">
          <header className="flex items-center justify-end gap-3 border-b border-white/5 bg-surface/90 px-6 py-3 backdrop-blur">
            <OrganizationSwitcher
              hidePersonal
              createOrganizationUrl="/onboarding"
              organizationProfileUrl="/dashboard/organization"
              afterCreateOrganizationUrl="/dashboard"
              afterSelectOrganizationUrl="/dashboard"
              afterLeaveOrganizationUrl="/onboarding"
            />
            <UserButton showName />
          </header>
          <main className="flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
