import { eq } from "drizzle-orm";

import { requireDashboardContext } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { organizationMemberships, users } from "@/lib/db/schema";

export default async function OrganizationPage() {
  const context = await requireDashboardContext();
  const members = await getDb()
    .select({
      email: users.email,
      role: organizationMemberships.role,
      createdAt: organizationMemberships.createdAt,
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(organizationMemberships.userId, users.id))
    .where(eq(organizationMemberships.organizationId, context.organization.id));

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-primary">
          Organization
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
          Manage workspace details and teammates.
        </h1>
      </div>
      <section className="max-w-3xl rounded-sm border border-white/10 bg-surface-container p-5">
        <div className="text-sm text-on-surface-variant">Workspace</div>
        <div className="mt-1 text-xl font-semibold text-on-surface">
          {context.organization.name}
        </div>
      </section>
      <section className="max-w-3xl">
        <h2 className="text-lg font-semibold text-on-surface">Members</h2>
        <div className="mt-3 divide-y divide-white/10 rounded-sm border border-white/10 bg-surface-container">
          {members.map((member) => (
            <div
              key={member.email}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <div className="text-sm text-on-surface">{member.email}</div>
                <div className="text-xs text-on-surface-variant">
                  Joined {member.createdAt.toLocaleDateString()}
                </div>
              </div>
              <span className="rounded-sm border border-white/10 px-2 py-1 text-xs uppercase tracking-widest text-on-surface-variant">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
