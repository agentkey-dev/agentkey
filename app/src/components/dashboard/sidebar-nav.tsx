"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { getSidebarNavigation } from "@/lib/dashboard-navigation";

function LinkPendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary transition-opacity duration-150 ${
        pending ? "animate-pulse opacity-100" : "opacity-0"
      }`}
    />
  );
}

export function SidebarNav({
  pendingCount,
  highlightDocsNav = false,
}: {
  pendingCount: number;
  highlightDocsNav?: boolean;
}) {
  const pathname = usePathname();
  const navigation = getSidebarNavigation({ highlightDocsNav });

  return (
    <nav className="mt-10 grid gap-1">
      {navigation.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
            }`}
          >
            <span className="flex items-center gap-2">
              <span>{item.label}</span>
              {item.showIndicator ? (
                <span className="h-2 w-2 rounded-full bg-primary" />
              ) : null}
              <LinkPendingDot />
            </span>
            {item.href === "/dashboard/requests" && pendingCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[10px] font-bold text-on-primary">
                {pendingCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
