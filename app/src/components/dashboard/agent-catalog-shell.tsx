"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type ReactElement,
} from "react";

import { AgentActionButton } from "@/components/dashboard/agent-action-button";
import { AgentUpdateForm } from "@/components/dashboard/agent-update-form";
import { unwrapResponseData } from "@/components/dashboard/api";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TimeAgo } from "@/components/dashboard/time-ago";
import { getActionLabel } from "@/lib/audit-labels";
import {
  filterAgentCatalog,
  grantAgentToolInCatalog,
  denyAgentPendingToolInCatalog,
  revokeAgentToolInCatalog,
  rotateAgentCatalogKey,
  suspendAgentInCatalog,
  type AgentCatalogItem,
  type AgentCatalogPendingToolSummary,
  type AgentRecentActivityEvent,
  type AgentStatus,
} from "@/lib/agent-catalog";
import { getBrandfetchLogoUrl } from "@/lib/tool-branding";
import type { ToolCatalogItem } from "@/lib/tool-catalog";

function updateAgentsUrl(
  selectedAgentId: string | null,
  mode: "push" | "replace",
) {
  const url = new URL(window.location.href);

  if (selectedAgentId) {
    url.searchParams.set("selected", selectedAgentId);
  } else {
    url.searchParams.delete("selected");
  }

  const next = `${url.pathname}${url.search}${url.hash}`;

  if (mode === "push") {
    window.history.pushState(null, "", next);
    return;
  }

  window.history.replaceState(null, "", next);
}

function formatTimestamp(date: Date | string) {
  return new Date(date).toLocaleString();
}

function getStatusTone(status: AgentStatus) {
  return status === "active" ? "success" : "danger";
}

function getStaleKeyAgeDays(updatedAt: Date | string) {
  return Math.floor(
    (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Request failed.";
}

type ToolRow = {
  id: string;
  name: string;
  url: string | null;
  credentialMode: "shared" | "per_agent";
  authType: ToolCatalogItem["authType"] | "other";
  state: "granted" | "available";
};

type PendingRow = {
  id: string;
  name: string;
  url: string | null;
  credentialMode: "shared" | "per_agent";
  authType: ToolCatalogItem["authType"] | "other";
  requestId: string;
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function ToolLogoTile({
  name,
  logoUrl,
  size = 28,
  className = "",
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-md border border-white/10 bg-surface ${className}`}
      style={{ width: size, height: size }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          width={size - 8}
          height={size - 8}
          style={{ width: size - 8, height: size - 8 }}
          className="object-contain"
          referrerPolicy="origin"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span className="font-mono text-[10px] font-bold text-on-surface-variant">
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}

function Switch({
  checked,
  disabled = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        checked
          ? "bg-emerald-500/80 hover:bg-emerald-500"
          : "bg-white/10 hover:bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function PendingRequestLine({
  chip,
  agentId,
  agentName,
  brandfetchClientId,
  disabled,
  onApproved,
  onDenied,
}: {
  chip: PendingRow;
  agentId: string;
  agentName: string;
  brandfetchClientId?: string;
  disabled: boolean;
  onApproved: (toolId: string, toolName: string) => void;
  onDenied: (toolId: string) => void;
}) {
  void agentName;
  const [credential, setCredential] = useState("");
  const [reason, setReason] = useState("");
  const [isDenying, setIsDenying] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsCredential = chip.credentialMode === "per_agent";
  const expanded = needsCredential || isDenying;

  async function approve() {
    if (needsCredential && credential.trim().length === 0) {
      setError("Credential is required for per-agent tools.");
      return;
    }
    setError(null);
    setIsPending(true);
    try {
      const response = await fetch(
        `/api/admin/requests/${chip.requestId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: credential.trim() }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(data));
        return;
      }
      unwrapResponseData(data);
      onApproved(chip.id, chip.name);
    } catch {
      setError("Request failed.");
    } finally {
      setIsPending(false);
    }
  }

  async function deny() {
    setError(null);
    setIsPending(true);
    try {
      const response = await fetch(
        `/api/admin/requests/${chip.requestId}/deny`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(data));
        return;
      }
      unwrapResponseData(data);
      onDenied(chip.id);
    } catch {
      setError("Request failed.");
    } finally {
      setIsPending(false);
    }
  }

  void agentId;

  return (
    <div className="space-y-2 border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <ToolLogoTile
          name={chip.name}
          logoUrl={getBrandfetchLogoUrl(chip.url, brandfetchClientId)}
          size={24}
        />
        <span className="flex-1 truncate text-sm text-on-surface">
          {chip.name}
        </span>
        {!isDenying ? (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              disabled={disabled || isPending}
              onClick={() => void approve()}
              className="inline-flex items-center justify-center bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={disabled || isPending}
              onClick={() => setIsDenying(true)}
              className="inline-flex items-center justify-center border border-white/10 px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-rose-500/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Deny
            </button>
          </div>
        ) : null}
      </div>
      {expanded && needsCredential && !isDenying ? (
        chip.authType === "oauth_token" ? (
          <textarea
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
            rows={2}
            disabled={disabled || isPending}
            autoComplete="off"
            className="w-full border border-white/10 bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
            placeholder='Per-agent credential — {"client_id": "...", "refresh_token": "..."}'
          />
        ) : (
          <input
            type="password"
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
            disabled={disabled || isPending}
            autoComplete="off"
            className="w-full border border-white/10 bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
            placeholder="Per-agent credential — paste here"
          />
        )
      ) : null}
      {isDenying ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            disabled={disabled || isPending}
            autoFocus
            className="w-full border border-white/10 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-primary"
            placeholder='Optional — e.g. "Use the shared bot account instead"'
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={disabled || isPending}
              onClick={() => void deny()}
              className="inline-flex items-center justify-center border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "…" : "Confirm denial"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setIsDenying(false);
                setReason("");
                setError(null);
              }}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:text-on-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

function ToolToggleRow({
  row,
  brandfetchClientId,
  disabled,
  onAssign,
  onRevoke,
}: {
  row: ToolRow;
  brandfetchClientId?: string;
  disabled: boolean;
  onAssign: (credential: string) => Promise<boolean>;
  onRevoke: () => Promise<boolean>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [credential, setCredential] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isGranted = row.state === "granted";
  const needsCredential = row.credentialMode === "per_agent";

  async function handleToggle() {
    if (disabled || isPending) return;
    setError(null);

    if (isGranted) {
      setIsPending(true);
      const ok = await onRevoke();
      setIsPending(false);
      if (!ok) setError("Revoke failed.");
      return;
    }

    if (needsCredential) {
      setIsExpanded(true);
      return;
    }

    setIsPending(true);
    const ok = await onAssign("");
    setIsPending(false);
    if (!ok) setError("Assign failed.");
  }

  async function confirmCredentialAssign() {
    if (credential.trim().length === 0) {
      setError("Credential is required.");
      return;
    }
    setError(null);
    setIsPending(true);
    const ok = await onAssign(credential);
    setIsPending(false);
    if (ok) {
      setCredential("");
      setIsExpanded(false);
    } else {
      setError("Assign failed.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-2 py-1.5">
        <ToolLogoTile
          name={row.name}
          logoUrl={getBrandfetchLogoUrl(row.url, brandfetchClientId)}
          size={24}
        />
        <span className="flex-1 truncate text-sm text-on-surface">
          {row.name}
        </span>
        {needsCredential && !isGranted ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
            per-agent
          </span>
        ) : null}
        <Switch
          checked={isGranted}
          disabled={disabled || isPending}
          onChange={() => void handleToggle()}
          ariaLabel={isGranted ? `Revoke ${row.name}` : `Grant ${row.name}`}
        />
      </div>
      {isExpanded && !isGranted && needsCredential ? (
        <div className="space-y-2 border border-white/10 bg-surface-container-low px-3 py-3">
          {row.authType === "oauth_token" ? (
            <textarea
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              rows={2}
              autoFocus
              autoComplete="off"
              disabled={isPending}
              className="w-full border border-white/10 bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
              placeholder='Per-agent credential as JSON'
            />
          ) : (
            <input
              type="password"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              autoFocus
              autoComplete="off"
              disabled={isPending}
              className="w-full border border-white/10 bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
              placeholder={`Paste ${row.name} credential for this agent`}
            />
          )}
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => void confirmCredentialAssign()}
              className="inline-flex items-center justify-center bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Assigning…" : `Assign ${row.name}`}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setIsExpanded(false);
                setCredential("");
                setError(null);
              }}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="px-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

function AgentToolsPanel({
  agent,
  tools,
  brandfetchClientId,
  onGranted,
  onDenied,
  onRevoked,
}: {
  agent: AgentCatalogItem;
  tools: ToolCatalogItem[];
  brandfetchClientId?: string;
  onGranted: (
    agentId: string,
    tool: { toolId: string; toolName: string },
  ) => void;
  onDenied: (agentId: string, toolId: string) => void;
  onRevoked: (agentId: string, toolId: string) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery("");
  }, [agent.id]);

  const toolsById = useMemo(() => {
    const map = new Map<string, ToolCatalogItem>();
    for (const tool of tools) {
      map.set(tool.id, tool);
    }
    return map;
  }, [tools]);

  const grantedIds = useMemo(
    () => new Set(agent.grantedTools.map((tool) => tool.toolId)),
    [agent.grantedTools],
  );
  const pendingIds = useMemo(
    () => new Set(agent.pendingTools.map((tool) => tool.toolId)),
    [agent.pendingTools],
  );

  const pendingRows: PendingRow[] = useMemo(
    () =>
      agent.pendingTools.map((entry) => {
        const tool = toolsById.get(entry.toolId);
        return {
          id: entry.toolId,
          name: tool?.name ?? entry.toolName,
          url: tool?.url ?? null,
          credentialMode: entry.toolCredentialMode,
          authType: tool?.authType ?? "api_key",
          requestId: entry.requestId,
        };
      }),
    [agent.pendingTools, toolsById],
  );

  const toolRows: ToolRow[] = useMemo(() => {
    const rows: ToolRow[] = tools
      .filter((tool) => !pendingIds.has(tool.id))
      .map((tool) => ({
        id: tool.id,
        name: tool.name,
        url: tool.url,
        credentialMode: tool.credentialMode,
        authType: tool.authType,
        state: grantedIds.has(tool.id) ? "granted" : "available",
      }));

    return rows.sort((a, b) => {
      if (a.state !== b.state) {
        return a.state === "granted" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [tools, grantedIds, pendingIds]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return toolRows;
    return toolRows.filter((row) => row.name.toLowerCase().includes(q));
  }, [toolRows, query]);

  const isAgentActive = agent.status === "active";
  const grantedCount = agent.grantedTools.length;
  const pendingCount = pendingRows.length;
  const hasNoTools = tools.length === 0;

  async function assign(row: ToolRow, credential: string): Promise<boolean> {
    // Optimistic: update parent state first for shared tools.
    const isOptimistic = row.credentialMode === "shared";
    if (isOptimistic) {
      onGranted(agent.id, { toolId: row.id, toolName: row.name });
    }
    try {
      const response = await fetch(`/api/admin/agents/${agent.id}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: row.id,
          credential:
            row.credentialMode === "per_agent" ? credential.trim() : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (isOptimistic) {
          onRevoked(agent.id, row.id);
        }
        return false;
      }
      unwrapResponseData(data);
      if (!isOptimistic) {
        onGranted(agent.id, { toolId: row.id, toolName: row.name });
      }
      return true;
    } catch {
      if (isOptimistic) {
        onRevoked(agent.id, row.id);
      }
      return false;
    }
  }

  async function revoke(row: ToolRow): Promise<boolean> {
    // Optimistic revoke
    onRevoked(agent.id, row.id);
    try {
      const response = await fetch(
        `/api/admin/agents/${agent.id}/tools/${row.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        // Revert
        onGranted(agent.id, { toolId: row.id, toolName: row.name });
        return false;
      }
      unwrapResponseData(data);
      return true;
    } catch {
      onGranted(agent.id, { toolId: row.id, toolName: row.name });
      return false;
    }
  }

  return (
    <section className="space-y-3 border border-white/10 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-on-surface">Tools</h3>
        <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
          {grantedCount} granted{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
        </span>
      </div>

      {!isAgentActive ? (
        <div className="border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-200">
          Suspended. Reactivate to grant or revoke access.
        </div>
      ) : null}

      {pendingCount > 0 ? (
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-amber-300/80">
            Pending requests · {pendingCount}
          </div>
          <div className="space-y-2">
            {pendingRows.map((chip) => (
              <PendingRequestLine
                key={chip.requestId}
                chip={chip}
                agentId={agent.id}
                agentName={agent.name}
                brandfetchClientId={brandfetchClientId}
                disabled={!isAgentActive}
                onApproved={(toolId, toolName) =>
                  onGranted(agent.id, { toolId, toolName })
                }
                onDenied={(toolId) => onDenied(agent.id, toolId)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {hasNoTools ? (
        <p className="text-sm text-on-surface-variant">
          No tools in the catalog yet.{" "}
          <a href="/dashboard/tools" className="text-primary hover:opacity-80">
            Add one →
          </a>
        </p>
      ) : (
        <div className="space-y-2">
          {tools.length > 5 ? (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools…"
              className="w-full border border-white/10 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            />
          ) : null}
          <div className="max-h-80 divide-y divide-white/5 overflow-y-auto border border-white/5">
            {filteredRows.length === 0 ? (
              <p className="px-3 py-4 text-xs text-on-surface-variant">
                No tools match.
              </p>
            ) : (
              filteredRows.map((row) => (
                <ToolToggleRow
                  key={row.id}
                  row={row}
                  brandfetchClientId={brandfetchClientId}
                  disabled={!isAgentActive}
                  onAssign={(credential) => assign(row, credential)}
                  onRevoke={() => revoke(row)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function AgentCatalogShell({
  agents: initialAgents,
  tools,
  brandfetchClientId,
  initialSelectedAgentId,
  children,
}: {
  agents: AgentCatalogItem[];
  tools: ToolCatalogItem[];
  brandfetchClientId?: string;
  initialSelectedAgentId?: string;
  children?: ReactNode;
}) {
  const [agents, setAgents] = useState<AgentCatalogItem[]>(initialAgents);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("active");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    initialSelectedAgentId ?? null,
  );
  const [recentActivity, setRecentActivity] = useState<AgentRecentActivityEvent[]>(
    [],
  );
  const [activityError, setActivityError] = useState<string | null>(null);
  const [isActivityLoading, setIsActivityLoading] = useState(false);

  useEffect(() => {
    setAgents(initialAgents);
  }, [initialAgents]);

  useEffect(() => {
    setSelectedAgentId(initialSelectedAgentId ?? null);
  }, [initialSelectedAgentId]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedAgentId(params.get("selected"));
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const filteredAgents = useMemo(
    () =>
      filterAgentCatalog(agents, {
        query,
        status: statusFilter,
      }),
    [agents, query, statusFilter],
  );

  useEffect(() => {
    if (!selectedAgentId) {
      return;
    }

    if (agents.some((agent) => agent.id === selectedAgentId)) {
      return;
    }

    setSelectedAgentId(null);
    updateAgentsUrl(null, "replace");
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId) {
      return;
    }

    if (filteredAgents.some((agent) => agent.id === selectedAgentId)) {
      return;
    }

    setSelectedAgentId(null);
    updateAgentsUrl(null, "replace");
  }, [filteredAgents, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setSelectedAgentId(null);
      updateAgentsUrl(null, "push");
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedAgentId]);

  useEffect(() => {
    if (!selectedAgentId) {
      setRecentActivity([]);
      setActivityError(null);
      setIsActivityLoading(false);
      return;
    }

    let cancelled = false;
    setIsActivityLoading(true);
    setActivityError(null);

    void fetch(`/api/admin/agents/${selectedAgentId}/activity?limit=5`)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          if (
            data &&
            typeof data === "object" &&
            "error" in data &&
            typeof data.error === "string"
          ) {
            throw new Error(data.error);
          }

          throw new Error("Could not load activity.");
        }

        if (!cancelled) {
          setRecentActivity(
            unwrapResponseData<AgentRecentActivityEvent[]>(data) ?? [],
          );
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setActivityError(
            error instanceof Error ? error.message : "Could not load activity.",
          );
          setRecentActivity([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsActivityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAgentId]);

  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const hasFilters = query.trim().length > 0 || statusFilter !== "all";

  function openAgent(agentId: string) {
    setSelectedAgentId(agentId);
    updateAgentsUrl(agentId, "push");
  }

  function closeDrawer(mode: "push" | "replace" = "push") {
    setSelectedAgentId(null);
    updateAgentsUrl(null, mode);
  }

  const renderedChildren =
    isValidElement(children)
      ? cloneElement(
          children as ReactElement<{ onCreated?: (agent: AgentCatalogItem) => void }>,
          {
            onCreated: (agent: AgentCatalogItem) => {
              setAgents((current) => [agent, ...current]);
              setSelectedAgentId(null);
              updateAgentsUrl(null, "replace");
            },
          },
        )
      : children;

  return (
    <>
      {renderedChildren}

      <section className="space-y-4 border border-white/10 bg-surface-container p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <label className="grid gap-2 text-sm text-on-surface-variant">
            Search agents
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
              placeholder="Search by agent name"
            />
          </label>
          <label className="grid gap-2 text-sm text-on-surface-variant">
            Status
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as AgentStatus | "all")
              }
              className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden border border-white/10 bg-surface-container">
        {agents.length === 0 ? (
          <div className="p-6 text-sm text-on-surface-variant">
            No agents yet. Use the form above to register your first one — you&apos;ll get an API key and a ready-to-paste system prompt.
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="p-6 text-sm text-on-surface-variant">
            {hasFilters
              ? "No agents match the current search or filters."
              : "No agents yet. Use the form above to register your first one — you&apos;ll get an API key and a ready-to-paste system prompt."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-surface/40 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th className="px-5 py-3 font-normal">Agent</th>
                  <th className="px-3 py-3 font-normal">Granted</th>
                  <th className="px-3 py-3 font-normal">Pending</th>
                  <th className="px-3 py-3 font-normal">Last active</th>
                  <th className="px-5 py-3 font-normal text-right" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {filteredAgents.map((agent) => {
                  const isSelected = agent.id === selectedAgentId;
                  const lastActiveAt = agent.lastActiveAt;
                  const hasPending = agent.pendingTools.length > 0;
                  const isSuspended = agent.status === "suspended";

                  return (
                    <tr
                      key={agent.id}
                      onClick={() => openAgent(agent.id)}
                      className={`cursor-pointer border-b border-white/5 transition-colors last:border-b-0 ${
                        isSelected
                          ? "bg-primary/5"
                          : "hover:bg-white/[0.025]"
                      }`}
                      aria-selected={isSelected}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              isSuspended ? "bg-rose-400" : "bg-emerald-400"
                            }`}
                            aria-label={agent.status}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-on-surface">
                              {agent.name}
                            </div>
                            {agent.description ? (
                              <div className="mt-0.5 truncate text-xs text-on-surface-variant">
                                {agent.description}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 font-mono text-xs text-on-surface-variant">
                        {agent.grantedTools.length}
                      </td>
                      <td className="px-3 py-4">
                        {hasPending ? (
                          <span className="inline-flex items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-200">
                            {agent.pendingTools.length}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-on-surface-variant/60">
                            0
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-xs text-on-surface-variant">
                        {lastActiveAt ? (
                          <TimeAgo date={lastActiveAt} />
                        ) : (
                          <span className="text-on-surface-variant/60">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span
                          aria-hidden="true"
                          className="font-mono text-xs text-on-surface-variant/60"
                        >
                          →
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedAgent ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close agent details"
            className="absolute inset-0 bg-black/70"
            onClick={() => closeDrawer()}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`agent-panel-title-${selectedAgent.id}`}
            className="pointer-events-none absolute inset-y-0 right-0 flex w-full justify-end"
          >
            <div
              className="pointer-events-auto relative h-full w-full overflow-y-auto border-l border-white/10 bg-surface-container p-6 shadow-2xl md:max-w-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2
                      id={`agent-panel-title-${selectedAgent.id}`}
                      className="truncate text-xl font-semibold text-on-surface"
                    >
                      {selectedAgent.name}
                    </h2>
                    <StatusBadge tone={getStatusTone(selectedAgent.status)}>
                      {selectedAgent.status}
                    </StatusBadge>
                  </div>
                  <p className="text-sm text-on-surface-variant">
                    {selectedAgent.description || "No description provided."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <AgentActionButton
                    endpoint={`/api/admin/agents/${selectedAgent.id}/rotate-key`}
                    method="POST"
                    label="Rotate key"
                    confirmMessage={`Rotate the API key for ${selectedAgent.name}?`}
                    onCompleted={() => {
                      setAgents((current) =>
                        rotateAgentCatalogKey(
                          current,
                          selectedAgent.id,
                          new Date().toISOString(),
                        ),
                      );
                    }}
                  />
                  {selectedAgent.status === "active" ? (
                    <AgentActionButton
                      endpoint={`/api/admin/agents/${selectedAgent.id}`}
                      method="DELETE"
                      label="Suspend"
                      tone="danger"
                      confirmMessage={`Suspend ${selectedAgent.name} and revoke its access?`}
                      onCompleted={() => {
                        setAgents((current) =>
                          suspendAgentInCatalog(
                            current,
                            selectedAgent.id,
                            new Date().toISOString(),
                          ),
                        );
                      }}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => closeDrawer()}
                    className="border border-white/10 px-3 py-2 text-sm text-on-surface hover:border-primary/40"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="mt-8 space-y-8">
                <section className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
                      Created
                    </div>
                    <div className="text-sm text-on-surface-variant">
                      {new Date(selectedAgent.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
                      Last active
                    </div>
                    <div className="text-sm text-on-surface-variant">
                      {selectedAgent.lastActiveAt ? (
                        <span>
                          <TimeAgo date={selectedAgent.lastActiveAt} /> (
                          {formatTimestamp(selectedAgent.lastActiveAt)})
                        </span>
                      ) : (
                        "No activity yet"
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
                      API key age
                    </div>
                    <div className="text-sm text-on-surface-variant">
                      {getStaleKeyAgeDays(selectedAgent.updatedAt) >= 90 ? (
                        <span className="text-amber-300">
                          {getStaleKeyAgeDays(selectedAgent.updatedAt)} days old
                        </span>
                      ) : (
                        "Recently rotated"
                      )}
                    </div>
                  </div>
                </section>

                <AgentToolsPanel
                  agent={selectedAgent}
                  tools={tools}
                  brandfetchClientId={brandfetchClientId}
                  onGranted={(agentId, tool) =>
                    setAgents((current) =>
                      grantAgentToolInCatalog(current, agentId, tool),
                    )
                  }
                  onDenied={(agentId, toolId) =>
                    setAgents((current) =>
                      denyAgentPendingToolInCatalog(current, agentId, toolId),
                    )
                  }
                  onRevoked={(agentId, toolId) =>
                    setAgents((current) =>
                      revokeAgentToolInCatalog(current, agentId, toolId),
                    )
                  }
                />

                {getStaleKeyAgeDays(selectedAgent.updatedAt) >= 90 ? (
                  <div className="rounded-sm bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                    API key is {getStaleKeyAgeDays(selectedAgent.updatedAt)} days
                    old and may be due for rotation.
                  </div>
                ) : null}

                <section className="space-y-4 border border-white/10 bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
                      Recent access
                    </div>
                    <a
                      href={`/dashboard/audit?agent_id=${selectedAgent.id}`}
                      className="text-xs text-primary hover:text-on-surface"
                    >
                      View full history
                    </a>
                  </div>
                  {isActivityLoading ? (
                    <p className="text-sm text-on-surface-variant">
                      Loading activity...
                    </p>
                  ) : activityError ? (
                    <p className="text-sm text-rose-300">{activityError}</p>
                  ) : recentActivity.length ? (
                    <div className="space-y-3">
                      {recentActivity.map((event) => (
                        <div
                          key={event.id}
                          className="grid gap-1 border-b border-white/5 pb-3 last:border-b-0 last:pb-0 md:grid-cols-[180px_minmax(0,1fr)]"
                        >
                          <div className="text-sm text-on-surface-variant">
                            {formatTimestamp(event.createdAt)}
                          </div>
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-on-surface">
                              {getActionLabel(event.action)}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                              <StatusBadge>
                                {event.toolName ?? event.toolId ?? "Unknown tool"}
                              </StatusBadge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-on-surface-variant">
                      No recent access activity.
                    </p>
                  )}
                </section>

                <AgentUpdateForm
                  key={selectedAgent.id}
                  agent={selectedAgent}
                  onUpdated={(updatedAgent) => {
                    setAgents((current) =>
                      current.map((agent) =>
                        agent.id === updatedAgent.id ? updatedAgent : agent,
                      ),
                    );
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
