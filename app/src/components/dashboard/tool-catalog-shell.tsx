"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { unwrapResponseData } from "@/components/dashboard/api";
import { getActionLabel } from "@/lib/audit-labels";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TimeAgo } from "@/components/dashboard/time-ago";
import { ToolCreateForm } from "@/components/dashboard/tool-create-form";
import { ToolLogo } from "@/components/dashboard/tool-logo";
import { ToolUpdateForm } from "@/components/dashboard/tool-update-form";
import type { AgentCatalogItem } from "@/lib/agent-catalog";
import {
  filterToolCatalog,
  type SuggestedToolContext,
  type ToolAuthType,
  type ToolCatalogItem,
  type ToolCredentialMode,
} from "@/lib/tool-catalog";
import { getBrandfetchLogoUrl, getToolDomain } from "@/lib/tool-branding";
import type {
  PendingInstructionSuggestionDetail,
  ToolInstructionHistoryEntry,
} from "@/lib/services/tool-instructions";

type RecentToolActivityEvent = {
  id: string;
  action: string;
  createdAt: Date | string;
  actorLabel: string;
};

function updateCatalogUrl(
  selectedToolId: string | null,
  suggestionId: string | null,
  mode: "push" | "replace",
) {
  const url = new URL(window.location.href);

  if (selectedToolId) {
    url.searchParams.set("selected", selectedToolId);
  } else {
    url.searchParams.delete("selected");
  }

  if (suggestionId) {
    url.searchParams.set("suggestionId", suggestionId);
  } else {
    url.searchParams.delete("suggestionId");
  }

  const next = `${url.pathname}${url.search}${url.hash}`;

  if (mode === "push") {
    window.history.pushState(null, "", next);
    return;
  }

  window.history.replaceState(null, "", next);
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

function formatTimestamp(date: Date | string) {
  return new Date(date).toLocaleString();
}

function formatSupporterCount(count: number) {
  return `${count} agent${count === 1 ? " wants" : "s want"} this`;
}

function getDayDiff(target: Date | string, now = new Date()) {
  const value = new Date(target);
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );

  return Math.floor(
    (startOfTarget.getTime() - startOfNow.getTime()) / (24 * 60 * 60 * 1000),
  );
}

function getDaysSince(date: Date | string, now = new Date()) {
  return Math.floor(
    (now.getTime() - new Date(date).getTime()) / (24 * 60 * 60 * 1000),
  );
}

function getHealthTone(tool: ToolCatalogItem) {
  switch (tool.healthStatus) {
    case "healthy":
      return "success";
    case "attention":
      return "warning";
    case "action_needed":
      return "danger";
  }
}

function getHealthLabel(tool: ToolCatalogItem) {
  switch (tool.healthStatus) {
    case "healthy":
      return "Healthy";
    case "attention":
      return "Attention";
    case "action_needed":
      return "Action needed";
  }
}

function getRotationSummary(tool: ToolCatalogItem) {
  if (tool.credentialMode !== "shared" || !tool.credentialLastRotatedAt) {
    return null;
  }

  return `Rotated ${getDaysSince(tool.credentialLastRotatedAt)}d ago`;
}

function getExpirySummary(tool: ToolCatalogItem) {
  if (tool.credentialMode !== "shared" || !tool.credentialExpiresAt) {
    return null;
  }

  const dayDiff = getDayDiff(tool.credentialExpiresAt);

  if (dayDiff < 0) {
    return `Expired ${Math.abs(dayDiff)}d ago`;
  }

  if (dayDiff === 0) {
    return "Expires today";
  }

  return `Expires in ${dayDiff}d`;
}

function getCredentialAlertSummary(tool: ToolCatalogItem) {
  if (tool.credentialMode !== "shared") {
    return "Per-agent credentials are tracked on each access grant.";
  }

  if (tool.healthStatus === "action_needed" && !tool.credentialLastRotatedAt) {
    return "No shared credential is configured.";
  }

  return getExpirySummary(tool) ?? getRotationSummary(tool) ?? "Shared credential is configured.";
}

function PendingSuggestionCard({
  suggestion,
  isActive,
  onSetUp,
  onDismissed,
}: {
  suggestion: SuggestedToolContext;
  isActive: boolean;
  onSetUp: (suggestionId: string) => void;
  onDismissed: (suggestionId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <article
      className={`grid gap-6 border p-6 xl:grid-cols-[minmax(0,1fr)_220px] ${
        isActive
          ? "border-primary/40 bg-primary/5"
          : "border-white/10 bg-surface-container"
      }`}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-on-surface">{suggestion.name}</h2>
          <StatusBadge tone="warning">
            {formatSupporterCount(suggestion.supporterCount)}
          </StatusBadge>
        </div>

        {suggestion.url ? (
          <a
            href={suggestion.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
          >
            {getToolDomain(suggestion.url) ?? suggestion.url}
          </a>
        ) : null}

        <div className="space-y-3">
          {suggestion.supporters.map((supporter) => (
            <div key={supporter.agentId} className="border-l border-primary/20 pl-4">
              <div className="text-sm font-medium text-on-surface">
                {supporter.agentName}
              </div>
              <div className="mt-1 text-sm text-on-surface-variant">
                {supporter.latestReason}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 text-sm text-on-surface-variant md:grid-cols-2">
          <p className="flex flex-wrap items-center gap-2">
            <span>First requested {formatTimestamp(suggestion.firstRequestedAt)}</span>
            <span className="font-mono text-xs text-amber-400">
              (<TimeAgo date={suggestion.firstRequestedAt} />)
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span>Last requested {formatTimestamp(suggestion.lastRequestedAt)}</span>
            <span className="font-mono text-xs text-amber-400">
              (<TimeAgo date={suggestion.lastRequestedAt} />)
            </span>
          </p>
        </div>
      </div>

      <div className="grid content-start gap-3">
        <button
          type="button"
          onClick={() => onSetUp(suggestion.id)}
          className={`inline-flex items-center justify-center px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 ${
            isActive
              ? "border border-primary/40 bg-primary/10 text-on-surface"
              : "bg-primary text-on-primary"
          }`}
        >
          Set up this tool
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);

            startTransition(async () => {
              const response = await fetch(
                `/api/admin/suggestions/${suggestion.id}/dismiss`,
                {
                  method: "POST",
                },
              );
              const data = await response.json();

              if (!response.ok) {
                setError(getErrorMessage(data));
                return;
              }

              unwrapResponseData(data);
              onDismissed(suggestion.id);
            });
          }}
          className="inline-flex items-center justify-center border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Working..." : "Dismiss"}
        </button>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </article>
  );
}

function ToolDeleteButton({
  tool,
  onDeleted,
}: {
  tool: ToolCatalogItem;
  onDeleted: (toolId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        className="inline-flex items-center justify-center border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => {
          if (
            !window.confirm(
              `Delete ${tool.name}? This will revoke access for ${tool.approvedAgents} approved agent(s) and remove ${tool.pendingAgents} pending request(s).`,
            )
          ) {
            return;
          }

          setError(null);

          startTransition(async () => {
            const response = await fetch(`/api/admin/tools/${tool.id}`, {
              method: "DELETE",
            });
            const data = await response.json();

            if (!response.ok) {
              setError(
                data && typeof data === "object" && "error" in data
                  ? String(data.error)
                  : "Delete failed.",
              );
              return;
            }

            unwrapResponseData(data);
            onDeleted(tool.id);
          });
        }}
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}

function ToolSwitch({
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

type AgentRow = {
  id: string;
  name: string;
  status: "active" | "suspended";
  state: "granted" | "available";
};

type PendingAgentRow = {
  agentId: string;
  agentName: string;
  requestId: string;
};

function AgentToggleRow({
  row,
  toolCredentialMode,
  toolAuthType,
  toolName,
  disabled,
  onAssign,
  onRevoke,
}: {
  row: AgentRow;
  toolCredentialMode: ToolCredentialMode;
  toolAuthType: ToolAuthType;
  toolName: string;
  disabled: boolean;
  onAssign: (credential: string) => Promise<boolean>;
  onRevoke: () => Promise<boolean>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [credential, setCredential] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isGranted = row.state === "granted";
  const needsCredential = toolCredentialMode === "per_agent";

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
    if (!ok) setError("Grant failed.");
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
      setError("Grant failed.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-2 py-1.5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            row.status === "suspended" ? "bg-rose-400" : "bg-emerald-400"
          }`}
          aria-label={row.status}
        />
        <span className="flex-1 truncate text-sm text-on-surface">
          {row.name}
        </span>
        {row.status === "suspended" ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-rose-300/80">
            suspended
          </span>
        ) : null}
        <ToolSwitch
          checked={isGranted}
          disabled={disabled || isPending || row.status === "suspended"}
          onChange={() => void handleToggle()}
          ariaLabel={
            isGranted ? `Revoke ${row.name}` : `Grant ${row.name}`
          }
        />
      </div>
      {isExpanded && !isGranted && needsCredential ? (
        <div className="space-y-2 border border-white/10 bg-surface-container-low px-3 py-3">
          {toolAuthType === "oauth_token" ? (
            <textarea
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              rows={2}
              autoFocus
              autoComplete="off"
              disabled={isPending}
              className="w-full border border-white/10 bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
              placeholder="Per-agent credential as JSON"
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
              placeholder={`Paste ${toolName} credential for ${row.name}`}
            />
          )}
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => void confirmCredentialAssign()}
              className="inline-flex items-center justify-center bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Granting…" : `Grant ${row.name}`}
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

function PendingAgentLine({
  row,
  tool,
  disabled,
  onApproved,
  onDenied,
}: {
  row: PendingAgentRow;
  tool: ToolCatalogItem;
  disabled: boolean;
  onApproved: (agentId: string) => void;
  onDenied: (agentId: string) => void;
}) {
  const [credential, setCredential] = useState("");
  const [reason, setReason] = useState("");
  const [isDenying, setIsDenying] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsCredential = tool.credentialMode === "per_agent";

  async function approve() {
    if (needsCredential && credential.trim().length === 0) {
      setError("Credential is required for per-agent tools.");
      return;
    }
    setError(null);
    setIsPending(true);
    try {
      const response = await fetch(
        `/api/admin/requests/${row.requestId}/approve`,
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
      onApproved(row.agentId);
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
        `/api/admin/requests/${row.requestId}/deny`,
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
      onDenied(row.agentId);
    } catch {
      setError("Request failed.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2 border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
        <span className="flex-1 truncate text-sm text-on-surface">
          {row.agentName}
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
      {!isDenying && needsCredential ? (
        tool.authType === "oauth_token" ? (
          <textarea
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
            rows={2}
            disabled={disabled || isPending}
            autoComplete="off"
            className="w-full border border-white/10 bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
            placeholder='Per-agent credential as JSON'
          />
        ) : (
          <input
            type="password"
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
            disabled={disabled || isPending}
            autoComplete="off"
            className="w-full border border-white/10 bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
            placeholder={`Per-agent credential for ${row.agentName}`}
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

function ToolAgentsPanel({
  tool,
  agents,
  onAgentGranted,
  onAgentRevoked,
  onPendingResolved,
}: {
  tool: ToolCatalogItem;
  agents: AgentCatalogItem[];
  onAgentGranted: (agentId: string) => void;
  onAgentRevoked: (agentId: string) => void;
  onPendingResolved: (agentId: string) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery("");
  }, [tool.id]);

  const grantedAgentIds = useMemo(
    () => new Set(tool.approvedAgentList.map((entry) => entry.agentId)),
    [tool.approvedAgentList],
  );
  const pendingAgentIds = useMemo(
    () => new Set(tool.pendingAgentList.map((entry) => entry.agentId)),
    [tool.pendingAgentList],
  );

  const pendingRows: PendingAgentRow[] = useMemo(() => {
    return tool.pendingAgentList
      .map((entry) => {
        const agent = agents.find((candidate) => candidate.id === entry.agentId);
        const requestId = agent?.pendingTools.find(
          (pendingTool) => pendingTool.toolId === tool.id,
        )?.requestId;
        if (!requestId) return null;
        return {
          agentId: entry.agentId,
          agentName: entry.agentName,
          requestId,
        };
      })
      .filter((entry): entry is PendingAgentRow => entry !== null);
  }, [tool.id, tool.pendingAgentList, agents]);

  const agentRows: AgentRow[] = useMemo(() => {
    const rows: AgentRow[] = agents
      .filter((agent) => !pendingAgentIds.has(agent.id))
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        state: grantedAgentIds.has(agent.id) ? "granted" : "available",
      }));

    return rows.sort((a, b) => {
      if (a.state !== b.state) {
        return a.state === "granted" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [agents, grantedAgentIds, pendingAgentIds]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agentRows;
    return agentRows.filter((row) => row.name.toLowerCase().includes(q));
  }, [agentRows, query]);

  const grantedCount = grantedAgentIds.size;
  const pendingCount = pendingRows.length;
  const hasNoAgents = agents.length === 0;

  async function assign(row: AgentRow, credential: string): Promise<boolean> {
    const isOptimistic = tool.credentialMode === "shared";
    if (isOptimistic) {
      onAgentGranted(row.id);
    }
    try {
      const response = await fetch(`/api/admin/agents/${row.id}/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: tool.id,
          credential:
            tool.credentialMode === "per_agent" ? credential.trim() : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (isOptimistic) onAgentRevoked(row.id);
        return false;
      }
      unwrapResponseData(data);
      if (!isOptimistic) onAgentGranted(row.id);
      return true;
    } catch {
      if (isOptimistic) onAgentRevoked(row.id);
      return false;
    }
  }

  async function revoke(row: AgentRow): Promise<boolean> {
    onAgentRevoked(row.id);
    try {
      const response = await fetch(
        `/api/admin/agents/${row.id}/tools/${tool.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        onAgentGranted(row.id);
        return false;
      }
      unwrapResponseData(data);
      return true;
    } catch {
      onAgentGranted(row.id);
      return false;
    }
  }

  return (
    <section className="space-y-3 border border-white/10 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-on-surface">Agents</h3>
        <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
          {grantedCount} granted{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
        </span>
      </div>

      {pendingCount > 0 ? (
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-amber-300/80">
            Pending requests · {pendingCount}
          </div>
          <div className="space-y-2">
            {pendingRows.map((row) => (
              <PendingAgentLine
                key={row.requestId}
                row={row}
                tool={tool}
                disabled={false}
                onApproved={(agentId) => {
                  onAgentGranted(agentId);
                  onPendingResolved(agentId);
                }}
                onDenied={(agentId) => onPendingResolved(agentId)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {hasNoAgents ? (
        <p className="text-sm text-on-surface-variant">
          No agents in the workspace yet.{" "}
          <a href="/dashboard/agents" className="text-primary hover:opacity-80">
            Create one →
          </a>
        </p>
      ) : (
        <div className="space-y-2">
          {agents.length > 5 ? (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agents…"
              className="w-full border border-white/10 bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            />
          ) : null}
          <div className="max-h-80 divide-y divide-white/5 overflow-y-auto border border-white/5">
            {filteredRows.length === 0 ? (
              <p className="px-3 py-4 text-xs text-on-surface-variant">
                No agents match.
              </p>
            ) : (
              filteredRows.map((row) => (
                <AgentToggleRow
                  key={row.id}
                  row={row}
                  toolCredentialMode={tool.credentialMode}
                  toolAuthType={tool.authType}
                  toolName={tool.name}
                  disabled={false}
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

export function ToolCatalogShell({
  tools: initialTools,
  agents: initialAgents,
  suggestions: initialSuggestions,
  initialSelectedToolId,
  initialSuggestionId,
  initialInstructionSuggestion,
  brandfetchClientId,
  aiDraftingEnabled,
  children,
}: {
  tools: ToolCatalogItem[];
  agents: AgentCatalogItem[];
  suggestions: SuggestedToolContext[];
  initialSelectedToolId?: string;
  initialSuggestionId?: string;
  initialInstructionSuggestion?: PendingInstructionSuggestionDetail | null;
  brandfetchClientId?: string;
  aiDraftingEnabled: boolean;
  children?: ReactNode;
}) {
  const [tools, setTools] = useState<ToolCatalogItem[]>(initialTools);
  const [agents, setAgents] = useState<AgentCatalogItem[]>(initialAgents);
  const [pendingSuggestions, setPendingSuggestions] =
    useState<SuggestedToolContext[]>(initialSuggestions);
  const [query, setQuery] = useState("");
  const [authTypeFilter, setAuthTypeFilter] = useState<ToolAuthType | "all">(
    "all",
  );
  const [credentialModeFilter, setCredentialModeFilter] = useState<
    ToolCredentialMode | "all"
  >("all");
  const [selectedToolId, setSelectedToolId] = useState<string | null>(
    initialSelectedToolId ?? null,
  );
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(
    initialSuggestionId ?? null,
  );
  const [quickAddNudgeToolId, setQuickAddNudgeToolId] = useState<string | null>(
    null,
  );
  const [activeInstructionSuggestion, setActiveInstructionSuggestion] =
    useState<PendingInstructionSuggestionDetail | null>(
      initialInstructionSuggestion ?? null,
    );
  const [shouldScrollToCreateForm, setShouldScrollToCreateForm] = useState(
    Boolean(initialSuggestionId),
  );
  const [recentActivity, setRecentActivity] = useState<RecentToolActivityEvent[]>(
    [],
  );
  const [instructionHistory, setInstructionHistory] = useState<
    ToolInstructionHistoryEntry[]
  >([]);
  const [instructionHistoryError, setInstructionHistoryError] = useState<
    string | null
  >(null);
  const [isInstructionHistoryLoading, setIsInstructionHistoryLoading] =
    useState(false);
  const [instructionHistoryRefreshKey, setInstructionHistoryRefreshKey] =
    useState(0);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [showEditTool, setShowEditTool] = useState(false);
  const createSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // When user nudges into the tool detail to fill in a missing usage guide,
    // jump straight into edit mode so the focused textarea is visible.
    setShowEditTool(quickAddNudgeToolId !== null && quickAddNudgeToolId === selectedToolId);
  }, [quickAddNudgeToolId, selectedToolId]);

  useEffect(() => {
    setTools(initialTools);
  }, [initialTools]);

  useEffect(() => {
    setAgents(initialAgents);
  }, [initialAgents]);

  useEffect(() => {
    setPendingSuggestions(initialSuggestions);
  }, [initialSuggestions]);

  useEffect(() => {
    setSelectedToolId(initialSelectedToolId ?? null);
  }, [initialSelectedToolId]);

  useEffect(() => {
    setActiveInstructionSuggestion(initialInstructionSuggestion ?? null);
  }, [initialInstructionSuggestion]);

  useEffect(() => {
    setActiveSuggestionId(initialSuggestionId ?? null);
    setShouldScrollToCreateForm(Boolean(initialSuggestionId));
  }, [initialSuggestionId]);

  useEffect(() => {
    if (!shouldScrollToCreateForm) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      createSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setShouldScrollToCreateForm(false);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [shouldScrollToCreateForm]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextSelectedToolId = params.get("selected");
      const nextSuggestionId = params.get("suggestionId");

      setSelectedToolId(nextSelectedToolId);
      setActiveSuggestionId(nextSuggestionId);

      if (nextSelectedToolId !== quickAddNudgeToolId) {
        setQuickAddNudgeToolId(null);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [activeSuggestionId, quickAddNudgeToolId]);

  useEffect(() => {
    if (!selectedToolId) {
      return;
    }

    if (tools.some((tool) => tool.id === selectedToolId)) {
      return;
    }

    setSelectedToolId(null);
    setQuickAddNudgeToolId(null);
    updateCatalogUrl(null, activeSuggestionId, "replace");
  }, [activeSuggestionId, selectedToolId, tools]);

  useEffect(() => {
    if (!activeSuggestionId) {
      return;
    }

    if (pendingSuggestions.some((suggestion) => suggestion.id === activeSuggestionId)) {
      return;
    }

    setActiveSuggestionId(null);
    updateCatalogUrl(selectedToolId, null, "replace");
  }, [activeSuggestionId, pendingSuggestions, selectedToolId]);

  const filteredTools = useMemo(
    () =>
      filterToolCatalog(tools, {
        query,
        authType: authTypeFilter,
        credentialMode: credentialModeFilter,
      }),
    [authTypeFilter, credentialModeFilter, query, tools],
  );

  useEffect(() => {
    if (!selectedToolId) {
      return;
    }

    if (filteredTools.some((tool) => tool.id === selectedToolId)) {
      return;
    }

    setSelectedToolId(null);
    setQuickAddNudgeToolId(null);
    updateCatalogUrl(null, activeSuggestionId, "replace");
  }, [activeSuggestionId, filteredTools, selectedToolId]);

  useEffect(() => {
    if (!selectedToolId) {
      setRecentActivity([]);
      setActivityError(null);
      setIsActivityLoading(false);
      setInstructionHistory([]);
      setInstructionHistoryError(null);
      setIsInstructionHistoryLoading(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setSelectedToolId(null);
      setQuickAddNudgeToolId(null);
      updateCatalogUrl(null, activeSuggestionId, "push");
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSuggestionId, selectedToolId]);

  useEffect(() => {
    if (!selectedToolId) {
      return;
    }

    let cancelled = false;
    setIsActivityLoading(true);
    setActivityError(null);

    void fetch(`/api/admin/tools/${selectedToolId}/activity?limit=5`)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(getErrorMessage(data));
        }

        if (!cancelled) {
          setRecentActivity(
            unwrapResponseData<RecentToolActivityEvent[]>(data) ?? [],
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
  }, [selectedToolId]);

  useEffect(() => {
    if (!selectedToolId) {
      return;
    }

    let cancelled = false;
    setIsInstructionHistoryLoading(true);
    setInstructionHistoryError(null);

    void fetch(`/api/admin/tools/${selectedToolId}/instructions/history`)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(getErrorMessage(data));
        }

        if (!cancelled) {
          setInstructionHistory(
            unwrapResponseData<ToolInstructionHistoryEntry[]>(data) ?? [],
          );
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setInstructionHistoryError(
            error instanceof Error
              ? error.message
              : "Could not load instruction history.",
          );
          setInstructionHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsInstructionHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [instructionHistoryRefreshKey, selectedToolId]);

  const selectedTool =
    tools.find((tool) => tool.id === selectedToolId) ?? null;
  const activeSuggestion =
    pendingSuggestions.find((suggestion) => suggestion.id === activeSuggestionId) ??
    null;
  const showToolbar = tools.length >= 4;
  const hasFilters =
    query.trim().length > 0 ||
    authTypeFilter !== "all" ||
    credentialModeFilter !== "all";

  function openTool(toolId: string) {
    setSelectedToolId(toolId);

    if (toolId !== quickAddNudgeToolId) {
      setQuickAddNudgeToolId(null);
    }

    updateCatalogUrl(toolId, activeSuggestionId, "push");
  }

  function closeDrawer(mode: "push" | "replace" = "push") {
    setSelectedToolId(null);
    setQuickAddNudgeToolId(null);
    setActiveInstructionSuggestion(null);
    updateCatalogUrl(null, activeSuggestionId, mode);
  }

  function openSuggestionSetup(suggestionId: string) {
    setActiveSuggestionId(suggestionId);
    setShouldScrollToCreateForm(true);
    updateCatalogUrl(selectedToolId, suggestionId, "push");
  }

  function dismissSuggestion(suggestionId: string) {
    setPendingSuggestions((current) =>
      current.filter((suggestion) => suggestion.id !== suggestionId),
    );

    if (activeSuggestionId === suggestionId) {
      setActiveSuggestionId(null);
      updateCatalogUrl(selectedToolId, null, "replace");
    }
  }

  useEffect(() => {
    if (
      activeInstructionSuggestion &&
      activeInstructionSuggestion.toolId !== selectedToolId
    ) {
      setActiveInstructionSuggestion(null);
    }
  }, [activeInstructionSuggestion, selectedToolId]);

  return (
    <>
      {pendingSuggestions.length > 0 ? (
        <div className="max-w-3xl">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-on-surface">
            {pendingSuggestions.length} tool
            {pendingSuggestions.length === 1 ? "" : "s"} requested by agents
          </span>
        </div>
      ) : null}

      {children}

      {pendingSuggestions.length > 0 ? (
        <section className="space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-primary">
              Agent suggestions
            </div>
            <p className="mt-1 text-sm text-on-surface-variant">
              Review what agents are asking for, why they need it, and start setup
              without leaving the tools page.
            </p>
          </div>
          <div className="grid gap-6">
            {pendingSuggestions.map((suggestion) => (
              <PendingSuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                isActive={suggestion.id === activeSuggestionId}
                onSetUp={openSuggestionSetup}
                onDismissed={dismissSuggestion}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section ref={createSectionRef} className="space-y-4">
        <ToolCreateForm
          key={activeSuggestion?.id ?? "create-tool"}
          aiDraftingEnabled={aiDraftingEnabled}
          suggestion={activeSuggestion}
          brandfetchClientId={brandfetchClientId}
          onCreated={(tool) => {
            setTools((current) => [tool, ...current]);
            setQuickAddNudgeToolId(tool.id);
            openTool(tool.id);

            if (activeSuggestion) {
              setPendingSuggestions((current) =>
                current.filter(
                  (suggestion) => suggestion.id !== activeSuggestion.id,
                ),
              );
              setActiveSuggestionId(null);
              updateCatalogUrl(tool.id, null, "replace");
            }
          }}
        />
      </section>

      {showToolbar ? (
        <section className="space-y-4 border border-white/10 bg-surface-container p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <label className="grid gap-2 text-sm text-on-surface-variant">
              Search tools
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
                placeholder="Search by name, config key, or URL"
              />
            </label>
            <label className="grid gap-2 text-sm text-on-surface-variant">
              Auth type
              <select
                value={authTypeFilter}
                onChange={(event) =>
                  setAuthTypeFilter(event.target.value as ToolAuthType | "all")
                }
                className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
              >
                <option value="all">All auth types</option>
                <option value="api_key">API key</option>
                <option value="oauth_token">OAuth token</option>
                <option value="bot_token">Bot token</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm text-on-surface-variant">
              Credential mode
              <select
                value={credentialModeFilter}
                onChange={(event) =>
                  setCredentialModeFilter(
                    event.target.value as ToolCredentialMode | "all",
                  )
                }
                className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
              >
                <option value="all">All credential modes</option>
                <option value="shared">Shared</option>
                <option value="per_agent">Per-agent</option>
              </select>
            </label>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden border border-white/10 bg-surface-container">
        {tools.length === 0 ? (
          <div className="p-6 text-sm text-on-surface-variant">
            No tools configured yet. Add one with the form above, or let your agents suggest tools they need — suggestions show up here.
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="p-6 text-sm text-on-surface-variant">
            {hasFilters
              ? "No tools match the current search or filters."
              : "No tools configured yet. Add one with the form above, or let your agents suggest tools they need — suggestions show up here."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-surface/40 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  <th className="px-5 py-3 font-normal">Tool</th>
                  <th className="px-3 py-3 font-normal">Auth</th>
                  <th className="px-3 py-3 font-normal">Health</th>
                  <th className="px-3 py-3 font-normal">Approved</th>
                  <th className="px-3 py-3 font-normal">Pending</th>
                  <th className="px-5 py-3 font-normal text-right" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {filteredTools.map((tool) => {
                  const logoUrl = getBrandfetchLogoUrl(
                    tool.url,
                    brandfetchClientId,
                  );
                  const isSelected = tool.id === selectedToolId;
                  const hasPending = tool.pendingAgents > 0;

                  return (
                    <tr
                      key={tool.id}
                      onClick={() => openTool(tool.id)}
                      className={`cursor-pointer border-b border-white/5 transition-colors last:border-b-0 ${
                        isSelected
                          ? "bg-primary/5"
                          : "hover:bg-white/[0.025]"
                      }`}
                      aria-selected={isSelected}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <ToolLogo name={tool.name} logoUrl={logoUrl} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-on-surface">
                              {tool.name}
                            </div>
                            {tool.url ? (
                              <div className="mt-0.5 truncate font-mono text-[11px] text-on-surface-variant/70">
                                {getToolDomain(tool.url) ?? tool.url}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-xs text-on-surface-variant">
                        {tool.authType}
                      </td>
                      <td className="px-3 py-4">
                        <StatusBadge tone={getHealthTone(tool)}>
                          {getHealthLabel(tool)}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-4 font-mono text-xs text-on-surface-variant">
                        {tool.approvedAgents}
                      </td>
                      <td className="px-3 py-4">
                        {hasPending ? (
                          <span className="inline-flex items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-200">
                            {tool.pendingAgents}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-on-surface-variant/60">
                            0
                          </span>
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

      {selectedTool ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close tool details"
            className="absolute inset-0 bg-black/70"
            onClick={() => closeDrawer()}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`tool-panel-title-${selectedTool.id}`}
            className="pointer-events-none absolute inset-y-0 right-0 flex w-full justify-end"
          >
            <div
              className="pointer-events-auto relative h-full w-full overflow-y-auto border-l border-white/10 bg-surface-container p-6 shadow-2xl md:max-w-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <ToolLogo
                    name={selectedTool.name}
                    logoUrl={getBrandfetchLogoUrl(
                      selectedTool.url,
                      brandfetchClientId,
                    )}
                  />
                  <div className="min-w-0 space-y-3">
                    <h2
                      id={`tool-panel-title-${selectedTool.id}`}
                      className="truncate text-xl font-semibold text-on-surface"
                    >
                      {selectedTool.name}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone="default">
                        {selectedTool.authType}
                      </StatusBadge>
                      <StatusBadge
                        tone={
                          selectedTool.credentialMode === "shared"
                            ? "success"
                            : "warning"
                        }
                      >
                        {selectedTool.credentialMode}
                      </StatusBadge>
                      <StatusBadge tone={getHealthTone(selectedTool)}>
                        {getHealthLabel(selectedTool)}
                      </StatusBadge>
                    </div>
                    {selectedTool.url ? (
                      <a
                        href={selectedTool.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
                      >
                        {getToolDomain(selectedTool.url) ?? selectedTool.url}
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/dashboard/audit?tool_id=${selectedTool.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center border border-white/10 px-3 py-2 text-sm text-on-surface transition-colors hover:border-primary/40"
                  >
                    View audit
                  </a>
                  <ToolDeleteButton
                    tool={selectedTool}
                    onDeleted={(toolId) => {
                      setTools((current) =>
                        current.filter((tool) => tool.id !== toolId),
                      );
                      closeDrawer("replace");
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => closeDrawer()}
                    className="border border-white/10 px-3 py-2 text-sm text-on-surface hover:border-primary/40"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
                  <span>{getCredentialAlertSummary(selectedTool)}</span>
                  {selectedTool.credentialMode === "shared" &&
                  selectedTool.credentialLastRotatedAt ? (
                    <>
                      <span className="text-on-surface-variant/40">·</span>
                      <span>
                        rotated {formatTimestamp(selectedTool.credentialLastRotatedAt)}
                      </span>
                    </>
                  ) : null}
                  {selectedTool.credentialMode === "shared" &&
                  selectedTool.credentialExpiresAt ? (
                    <>
                      <span className="text-on-surface-variant/40">·</span>
                      <span>
                        expires {formatTimestamp(selectedTool.credentialExpiresAt)}
                      </span>
                    </>
                  ) : null}
                </div>

                <ToolAgentsPanel
                  tool={selectedTool}
                  agents={agents}
                  onAgentGranted={(agentId) => {
                    const agentRecord = agents.find(
                      (candidate) => candidate.id === agentId,
                    );
                    const agentName = agentRecord?.name ?? "Agent";
                    setTools((current) =>
                      current.map((tool) => {
                        if (tool.id !== selectedTool.id) return tool;
                        if (
                          tool.approvedAgentList.some(
                            (entry) => entry.agentId === agentId,
                          )
                        ) {
                          return tool;
                        }
                        return {
                          ...tool,
                          approvedAgents: tool.approvedAgents + 1,
                          approvedAgentList: [
                            ...tool.approvedAgentList,
                            { agentId, agentName },
                          ],
                        };
                      }),
                    );
                    if (agentRecord) {
                      setAgents((current) =>
                        current.map((agent) =>
                          agent.id === agentId
                            ? {
                                ...agent,
                                grantedTools: agent.grantedTools.some(
                                  (entry) => entry.toolId === selectedTool.id,
                                )
                                  ? agent.grantedTools
                                  : [
                                      ...agent.grantedTools,
                                      {
                                        toolId: selectedTool.id,
                                        toolName: selectedTool.name,
                                      },
                                    ],
                                pendingTools: agent.pendingTools.filter(
                                  (entry) => entry.toolId !== selectedTool.id,
                                ),
                              }
                            : agent,
                        ),
                      );
                    }
                  }}
                  onAgentRevoked={(agentId) => {
                    setTools((current) =>
                      current.map((tool) => {
                        if (tool.id !== selectedTool.id) return tool;
                        if (
                          !tool.approvedAgentList.some(
                            (entry) => entry.agentId === agentId,
                          )
                        ) {
                          return tool;
                        }
                        return {
                          ...tool,
                          approvedAgents: Math.max(0, tool.approvedAgents - 1),
                          approvedAgentList: tool.approvedAgentList.filter(
                            (entry) => entry.agentId !== agentId,
                          ),
                        };
                      }),
                    );
                    setAgents((current) =>
                      current.map((agent) =>
                        agent.id === agentId
                          ? {
                              ...agent,
                              grantedTools: agent.grantedTools.filter(
                                (entry) => entry.toolId !== selectedTool.id,
                              ),
                            }
                          : agent,
                      ),
                    );
                  }}
                  onPendingResolved={(agentId) => {
                    setTools((current) =>
                      current.map((tool) =>
                        tool.id === selectedTool.id
                          ? {
                              ...tool,
                              pendingAgents: Math.max(
                                0,
                                tool.pendingAgents - 1,
                              ),
                              pendingAgentList: tool.pendingAgentList.filter(
                                (entry) => entry.agentId !== agentId,
                              ),
                            }
                          : tool,
                      ),
                    );
                    setAgents((current) =>
                      current.map((agent) =>
                        agent.id === agentId
                          ? {
                              ...agent,
                              pendingTools: agent.pendingTools.filter(
                                (entry) => entry.toolId !== selectedTool.id,
                              ),
                            }
                          : agent,
                      ),
                    );
                  }}
                />

                <section className="space-y-4 border border-white/10 bg-surface p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
                    Recent activity
                  </div>
                  {isActivityLoading ? (
                    <p className="text-sm text-on-surface-variant">
                      Loading activity...
                    </p>
                  ) : activityError ? (
                    <p className="text-sm text-rose-300">{activityError}</p>
                  ) : recentActivity.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">
                      No recent activity for this tool.
                    </p>
                  ) : (
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
                            <div className="text-sm text-on-surface-variant">
                              {event.actorLabel}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-3 border border-white/10 bg-surface p-4">
                  <button
                    type="button"
                    onClick={() => setShowEditTool((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-block text-xs text-on-surface-variant transition-transform ${
                          showEditTool ? "rotate-90" : ""
                        }`}
                      >
                        ▸
                      </span>
                      <span className="text-sm font-medium text-on-surface">
                        Edit tool
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                        name · description · usage guide · rotate credential
                      </span>
                    </span>
                  </button>
                  {showEditTool ? (
                    <ToolUpdateForm
                      key={`${selectedTool.id}:${selectedTool.currentInstructionVersionId ?? "none"}:${activeInstructionSuggestion?.id ?? "none"}`}
                      tool={selectedTool}
                      autoFocusInstructions={
                        quickAddNudgeToolId === selectedTool.id
                      }
                      instructionsCallout={
                        quickAddNudgeToolId === selectedTool.id
                          ? "Add a usage guide so agents know how to use this tool in your company."
                          : undefined
                      }
                      instructionSuggestion={activeInstructionSuggestion}
                      instructionHistory={instructionHistory}
                      instructionHistoryError={instructionHistoryError}
                      instructionHistoryLoading={isInstructionHistoryLoading}
                      onUpdated={(updatedTool) => {
                        setTools((current) =>
                          current.map((tool) =>
                            tool.id === updatedTool.id
                              ? {
                                  ...tool,
                                  ...updatedTool,
                                }
                              : tool,
                          ),
                        );

                        if (
                          quickAddNudgeToolId === updatedTool.id &&
                          (updatedTool.instructions ?? "").trim().length > 0
                        ) {
                          setQuickAddNudgeToolId(null);
                        }

                        if (
                          activeInstructionSuggestion &&
                          activeInstructionSuggestion.toolId === updatedTool.id
                        ) {
                          setActiveInstructionSuggestion(null);
                        }

                        setInstructionHistoryRefreshKey((current) => current + 1);
                      }}
                    />
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
