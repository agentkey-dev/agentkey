import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  authSessions,
  organizationMemberships,
  organizations,
} from "@/lib/db/schema";

export function isAdminMembership(membership: { role: string }) {
  return membership.role === "admin";
}

export async function getAdminContext() {
  const session = await getCurrentSession();

  if (!session) {
    return { kind: "signed-out" as const };
  }

  const db = getDb();
  const memberships = await db
    .select({
      organization: organizations,
      role: organizationMemberships.role,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizationMemberships.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationMemberships.userId, session.user.id),
        eq(organizationMemberships.role, "admin"),
      ),
    );
  const adminMemberships = memberships.filter(isAdminMembership);

  if (adminMemberships.length === 0) {
    return {
      kind: "missing-org" as const,
      userId: session.user.id,
      userEmail: session.user.email,
    };
  }

  const selected =
    adminMemberships.find(
      (membership) =>
        membership.organization.id === session.session.selectedOrganizationId,
    ) ?? adminMemberships[0];

  if (selected.organization.id !== session.session.selectedOrganizationId) {
    await db
      .update(authSessions)
      .set({
        selectedOrganizationId: selected.organization.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(authSessions.id, session.session.id),
          eq(authSessions.userId, session.user.id),
        ),
      );
  }

  return {
    kind: "ready" as const,
    userId: session.user.id,
    userEmail: session.user.email,
    organization: selected.organization,
    organizations: adminMemberships.map((membership) => membership.organization),
  };
}

export async function requireDashboardContext() {
  const context = await getAdminContext();

  if (context.kind === "signed-out") {
    redirect("/sign-in");
  }

  if (context.kind === "missing-org") {
    redirect("/onboarding");
  }

  return context;
}
