"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ORGANIZATION_SETTINGS_HREF = "/dashboard/organization";

export function isOrganizationSettingsPath(pathname: string) {
  return pathname.startsWith(ORGANIZATION_SETTINGS_HREF);
}

export function getOrganizationSettingsLinkClassName(isActive: boolean) {
  return `inline-flex items-center justify-center rounded-sm p-1.5 transition-colors ${
    isActive
      ? "bg-primary/10 text-primary"
      : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
  }`;
}

function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function SidebarOrganizationSettingsLink({
  organizationName,
}: {
  organizationName: string;
}) {
  const pathname = usePathname();
  const isActive = isOrganizationSettingsPath(pathname);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 text-lg font-semibold text-on-surface">
        {organizationName}
      </div>
      <Link
        href={ORGANIZATION_SETTINGS_HREF}
        aria-label="Organization settings"
        className={getOrganizationSettingsLinkClassName(isActive)}
      >
        <GearIcon />
      </Link>
    </div>
  );
}
