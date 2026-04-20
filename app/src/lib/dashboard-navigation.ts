export type SidebarNavigationItem = {
  href: string;
  label: string;
  exact?: boolean;
  showIndicator?: boolean;
};

const baseNavigation: SidebarNavigationItem[] = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/tools", label: "Tools" },
  { href: "/dashboard/requests", label: "Requests" },
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/audit", label: "Audit" },
  { href: "/dashboard/docs", label: "Docs" },
];

export function getSidebarNavigation(options?: {
  highlightDocsNav?: boolean;
}) {
  const highlightDocsNav = options?.highlightDocsNav ?? false;

  return baseNavigation.map((item) =>
    item.href === "/dashboard/docs"
      ? { ...item, showIndicator: highlightDocsNav }
      : item,
  );
}
