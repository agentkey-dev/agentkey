import { OrganizationProfile } from "@clerk/nextjs";

import { requireDashboardContext } from "@/lib/auth/admin";

export default async function OrganizationPage() {
  await requireDashboardContext();

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-primary">
          Organization
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
          Manage workspace details and invite teammates.
        </h1>
      </div>
      <OrganizationProfile path="/dashboard/organization" routing="path" />
    </div>
  );
}
