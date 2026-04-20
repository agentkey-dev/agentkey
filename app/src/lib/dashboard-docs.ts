export type DocsTocItem = {
  href: string;
  label: string;
};

export const DOCS_GETTING_STARTED_ITEMS: DocsTocItem[] = [
  { href: "#walkthrough", label: "Watch this first (5 min)" },
  { href: "#create-agent", label: "1. Create an agent" },
  { href: "#configure-agent", label: "2. Configure the agent" },
  { href: "#add-tools", label: "3. Add tools to the catalog" },
  { href: "#agent-requests", label: "4. Agent requests access" },
  { href: "#approve-deny", label: "5. Approve or deny" },
  { href: "#agent-fetches", label: "6. Agent fetches credentials" },
];

export const DOCS_REFERENCE_ITEMS: DocsTocItem[] = [
  { href: "#access-management", label: "Access management" },
  { href: "#usage-guides", label: "Writing usage guides" },
  { href: "#tool-suggestions", label: "Tool suggestions" },
  { href: "#instruction-suggestions", label: "Instruction suggestions" },
  { href: "#webhooks", label: "Webhook notifications" },
  { href: "#schema-discovery", label: "Schema discovery" },
  { href: "#rate-limits", label: "Rate limits" },
  { href: "#export-import", label: "Export & import" },
  { href: "#ai-drafting", label: "AI-assisted setup" },
  { href: "#api-reference", label: "API reference" },
  { href: "#troubleshooting", label: "Troubleshooting" },
  { href: "#concepts", label: "Key concepts" },
];

export const DOCS_REFERENCE_CALLOUT =
  "You're all set! The sections below cover advanced features and API details.";
