import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { normalizeOrganizationIdentity } from "@/lib/core/organizations";

function getPrimaryEmail(
  user:
    | Awaited<ReturnType<typeof currentUser>>
    | null
    | undefined,
) {
  if (!user) {
    return "";
  }

  const primary =
    user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    ) ?? user.emailAddresses[0];

  return primary?.emailAddress ?? "";
}

async function syncOrganization(orgId: string) {
  const client = await clerkClient();
  const remoteOrganization = await client.organizations.getOrganization({
    organizationId: orgId,
  });
  const normalized = normalizeOrganizationIdentity({
    clerkOrgId: remoteOrganization.id,
    name: remoteOrganization.name,
    slug: remoteOrganization.slug,
  });
  const db = getDb();

  const [organization] = await db
    .insert(organizations)
    .values(normalized)
    .onConflictDoUpdate({
      target: organizations.clerkOrgId,
      set: {
        name: normalized.name,
        slug: normalized.slug,
        updatedAt: new Date(),
      },
    })
    .returning();

  return organization;
}

export async function getAdminContext() {
  const authState = await auth();

  if (!authState.userId) {
    return { kind: "signed-out" as const };
  }

  const user = await currentUser();
  const email = getPrimaryEmail(user);

  if (!authState.orgId) {
    return {
      kind: "missing-org" as const,
      userId: authState.userId,
      userEmail: email,
    };
  }

  const organization = await syncOrganization(authState.orgId);

  return {
    kind: "ready" as const,
    userId: authState.userId,
    userEmail: email,
    clerkOrgId: authState.orgId,
    organization,
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
