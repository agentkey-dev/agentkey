import { Suspense } from "react";

import { NotificationsForm } from "@/components/dashboard/notifications-form";
import { requireDashboardContext } from "@/lib/auth/admin";
import { getNotificationSettings } from "@/lib/services/notifications";

export default async function NotificationsPage() {
  const context = await requireDashboardContext();

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-primary">
          Notifications
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
          Send new access requests to Slack or Discord.
        </h1>
        <p className="mt-2 text-base leading-relaxed text-on-surface-variant">
          Notifications are best-effort. Request creation still succeeds even
          if a webhook is down or misconfigured.
        </p>
      </div>

      <Suspense fallback={<NotificationsFormSkeleton />}>
        <NotificationsFormSection organizationId={context.organization.id} />
      </Suspense>
    </div>
  );
}

async function NotificationsFormSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const settings = await getNotificationSettings(organizationId);
  return <NotificationsForm settings={settings} />;
}

function NotificationsFormSkeleton() {
  return (
    <div
      className="space-y-6 border border-white/10 bg-surface-container p-6"
      aria-busy="true"
    >
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-10 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-64 animate-pulse rounded bg-white/5" />
        </div>
      ))}
      <div className="h-10 w-32 animate-pulse rounded bg-white/10" />
    </div>
  );
}
