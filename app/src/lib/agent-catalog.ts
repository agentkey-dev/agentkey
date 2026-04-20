import { agents } from "@/lib/db/schema";
import type { ToolCredentialMode } from "@/lib/tool-catalog";

export type AgentStatus = (typeof agents.$inferSelect)["status"];

export type AgentCatalogToolSummary = {
  toolId: string;
  toolName: string;
};

export type AgentCatalogPendingToolSummary = AgentCatalogToolSummary & {
  requestId: string;
  toolCredentialMode: ToolCredentialMode;
};

export type AgentRecentActivityEvent = {
  id: string;
  action: string;
  createdAt: Date | string;
  toolId: string | null;
  toolName: string | null;
};

export type AgentCatalogItem = Omit<
  typeof agents.$inferSelect,
  "createdAt" | "updatedAt"
> & {
  createdAt: Date | string;
  updatedAt: Date | string;
  lastActiveAt: Date | string | null;
  toolsGranted: string[];
  toolsPending: string[];
  grantedTools: AgentCatalogToolSummary[];
  pendingTools: AgentCatalogPendingToolSummary[];
};

export type AgentCatalogFilters = {
  query: string;
  status: AgentStatus | "all";
};

export function createAgentCatalogItem(
  agent: typeof agents.$inferSelect,
  access?: {
    granted?: string[];
    pending?: string[];
    grantedTools?: AgentCatalogToolSummary[];
    pendingTools?: AgentCatalogPendingToolSummary[];
  },
  lastActiveAt: Date | string | null = null,
): AgentCatalogItem {
  return {
    ...agent,
    lastActiveAt,
    toolsGranted: access?.granted ?? [],
    toolsPending: access?.pending ?? [],
    grantedTools: access?.grantedTools ?? [],
    pendingTools: access?.pendingTools ?? [],
  };
}

export function filterAgentCatalog(
  agentRows: AgentCatalogItem[],
  filters: AgentCatalogFilters,
) {
  const query = filters.query.trim().toLowerCase();

  return agentRows.filter((agent) => {
    if (filters.status !== "all" && agent.status !== filters.status) {
      return false;
    }

    if (!query) {
      return true;
    }

    return agent.name.toLowerCase().includes(query);
  });
}

export function rotateAgentCatalogKey(
  agentRows: AgentCatalogItem[],
  agentId: string,
  updatedAt: Date | string,
) {
  return agentRows.map((agent) =>
    agent.id === agentId
      ? {
          ...agent,
          updatedAt,
        }
      : agent,
  );
}

export function suspendAgentInCatalog(
  agentRows: AgentCatalogItem[],
  agentId: string,
  updatedAt: Date | string,
) {
  return agentRows.map((agent) =>
    agent.id === agentId
      ? {
          ...agent,
          status: "suspended" as const,
          updatedAt,
          toolsGranted: [],
          toolsPending: [],
          grantedTools: [],
          pendingTools: [],
        }
      : agent,
  );
}

export function revokeAgentToolInCatalog(
  agentRows: AgentCatalogItem[],
  agentId: string,
  toolId: string,
) {
  return agentRows.map((agent) => {
    if (agent.id !== agentId) {
      return agent;
    }

    const nextGrantedTools = agent.grantedTools.filter((tool) => tool.toolId !== toolId);

    return {
      ...agent,
      toolsGranted: nextGrantedTools.map((tool) => tool.toolName),
      grantedTools: nextGrantedTools,
    };
  });
}

export function grantAgentToolInCatalog(
  agentRows: AgentCatalogItem[],
  agentId: string,
  tool: AgentCatalogToolSummary,
) {
  return agentRows.map((agent) => {
    if (agent.id !== agentId) {
      return agent;
    }

    const grantedTools = agent.grantedTools.some(
      (entry) => entry.toolId === tool.toolId,
    )
      ? agent.grantedTools
      : [...agent.grantedTools, tool];
    const pendingTools = agent.pendingTools.filter(
      (entry) => entry.toolId !== tool.toolId,
    );

    return {
      ...agent,
      toolsGranted: grantedTools.map((entry) => entry.toolName),
      toolsPending: pendingTools.map((entry) => entry.toolName),
      grantedTools,
      pendingTools,
    };
  });
}

export function denyAgentPendingToolInCatalog(
  agentRows: AgentCatalogItem[],
  agentId: string,
  toolId: string,
) {
  return agentRows.map((agent) => {
    if (agent.id !== agentId) {
      return agent;
    }

    const pendingTools = agent.pendingTools.filter((tool) => tool.toolId !== toolId);

    return {
      ...agent,
      toolsPending: pendingTools.map((tool) => tool.toolName),
      pendingTools,
    };
  });
}
