import { tools } from "@/lib/db/schema";

export type ToolAuthType = (typeof tools.$inferSelect)["authType"];
export type ToolCredentialMode = (typeof tools.$inferSelect)["credentialMode"];
export type ToolHealthStatus =
  | "healthy"
  | "attention"
  | "action_needed";

export type ToolAgentSummary = {
  agentId: string;
  agentName: string;
};

export type ToolCatalogItem = {
  id: string;
  configKey: string;
  name: string;
  description: string;
  url: string | null;
  authType: ToolAuthType;
  credentialMode: ToolCredentialMode;
  instructions: string | null;
  currentInstructionVersionId: string | null;
  credentialLastRotatedAt: Date | string | null;
  credentialExpiresAt: Date | string | null;
  healthStatus: ToolHealthStatus;
  approvedAgents: number;
  pendingAgents: number;
  approvedAgentList: ToolAgentSummary[];
  pendingAgentList: ToolAgentSummary[];
};

export type SuggestedToolSupporter = {
  agentId: string;
  agentName: string;
  latestReason: string;
  firstRequestedAt: Date | string;
  lastRequestedAt: Date | string;
};

export type SuggestedToolContext = {
  id: string;
  name: string;
  url: string | null;
  supporterCount: number;
  firstRequestedAt: Date | string;
  lastRequestedAt: Date | string;
  supporters: SuggestedToolSupporter[];
};

export type ToolCatalogFilters = {
  query: string;
  authType: ToolAuthType | "all";
  credentialMode: ToolCredentialMode | "all";
};

export function filterToolCatalog(
  tools: ToolCatalogItem[],
  filters: ToolCatalogFilters,
) {
  const query = filters.query.trim().toLowerCase();

  return tools.filter((tool) => {
    if (filters.authType !== "all" && tool.authType !== filters.authType) {
      return false;
    }

    if (
      filters.credentialMode !== "all" &&
      tool.credentialMode !== filters.credentialMode
    ) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [tool.name, tool.configKey, tool.url ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    );
  });
}
