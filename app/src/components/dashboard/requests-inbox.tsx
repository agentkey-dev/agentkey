"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { unwrapResponseData } from "@/components/dashboard/api";
import { TimeAgo } from "@/components/dashboard/time-ago";
import type { PendingAdminRequestItem } from "@/lib/services/admin";

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

type RequestKindInfo = {
  label: string;
  className: string;
};

function getKindInfo(kind: PendingAdminRequestItem["kind"]): RequestKindInfo {
  switch (kind) {
    case "access_request":
      return {
        label: "request",
        className: "border-primary/30 bg-primary/10 text-primary",
      };
    case "tool_suggestion":
      return {
        label: "tool suggestion",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      };
    case "instruction_suggestion":
      return {
        label: "instruction note",
        className: "border-violet-500/30 bg-violet-500/10 text-violet-200",
      };
  }
}

export function RequestsInbox({
  initialRequests,
}: {
  initialRequests: PendingAdminRequestItem[];
}) {
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const visible = initialRequests.filter((request) => !hiddenIds.has(request.id));

  function hideRow(id: string) {
    setHiddenIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    router.refresh();
  }

  function unhideRow(id: string) {
    setHiddenIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  if (visible.length === 0) {
    return (
      <div className="border border-white/10 bg-surface-container p-10 text-center">
        <p className="text-sm font-medium text-on-surface">All caught up</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Nothing pending right now. New access requests and suggestions from
          your agents will land here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5 border border-white/10 bg-surface-container">
      {visible.map((request) => (
        <RequestRow
          key={request.id}
          request={request}
          onHide={() => hideRow(request.id)}
          onRevert={() => unhideRow(request.id)}
        />
      ))}
    </div>
  );
}

function RequestRow({
  request,
  onHide,
  onRevert,
}: {
  request: PendingAdminRequestItem;
  onHide: () => void;
  onRevert: () => void;
}) {
  if (request.kind === "access_request") {
    return (
      <AccessRequestRow request={request} onHide={onHide} onRevert={onRevert} />
    );
  }
  if (request.kind === "tool_suggestion") {
    return (
      <ToolSuggestionRow request={request} onHide={onHide} onRevert={onRevert} />
    );
  }
  return (
    <InstructionSuggestionRow
      request={request}
      onHide={onHide}
      onRevert={onRevert}
    />
  );
}

type AccessRequestItem = Extract<
  PendingAdminRequestItem,
  { kind: "access_request" }
>;
type ToolSuggestionItem = Extract<
  PendingAdminRequestItem,
  { kind: "tool_suggestion" }
>;
type InstructionSuggestionItem = Extract<
  PendingAdminRequestItem,
  { kind: "instruction_suggestion" }
>;

function RowShell({
  request,
  children,
}: {
  request: PendingAdminRequestItem;
  children: React.ReactNode;
}) {
  const kindInfo = getKindInfo(request.kind);
  return (
    <div className="space-y-2 px-5 py-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${kindInfo.className}`}
        >
          {kindInfo.label}
        </span>
        {children}
      </div>
    </div>
  );
}

function AccessRequestRow({
  request,
  onHide,
  onRevert,
}: {
  request: AccessRequestItem;
  onHide: () => void;
  onRevert: () => void;
}) {
  const [credential, setCredential] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"idle" | "approving-cred" | "denying">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const needsCredential = request.toolCredentialMode === "per_agent";

  function approve(credentialValue: string) {
    setError(null);
    onHide();
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/requests/${request.id}/approve`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: credentialValue.trim() }),
          },
        );
        const data = await response.json();
        if (!response.ok) {
          onRevert();
          setError(getErrorMessage(data));
          setMode("idle");
          return;
        }
        unwrapResponseData(data);
      } catch {
        onRevert();
        setError("Request failed.");
        setMode("idle");
      }
    });
  }

  function deny() {
    setError(null);
    onHide();
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/requests/${request.id}/deny`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        });
        const data = await response.json();
        if (!response.ok) {
          onRevert();
          setError(getErrorMessage(data));
          setMode("idle");
          return;
        }
        unwrapResponseData(data);
      } catch {
        onRevert();
        setError("Request failed.");
        setMode("idle");
      }
    });
  }

  function handleApproveClick() {
    if (needsCredential) {
      setMode("approving-cred");
      return;
    }
    approve("");
  }

  return (
    <RowShell request={request}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-medium text-on-surface">
            {request.agentName}
          </span>
          <span className="text-on-surface-variant">→</span>
          <span className="font-medium text-on-surface">
            {request.toolName}
          </span>
          {needsCredential ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              per-agent
            </span>
          ) : null}
        </div>
        {request.reason ? (
          <p className="text-sm italic text-on-surface-variant">
            “{request.reason}”
          </p>
        ) : null}
        {mode === "approving-cred" ? (
          <div className="space-y-2 border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs text-on-surface-variant">
              Per-agent tool — paste a credential just for{" "}
              <span className="text-on-surface">{request.agentName}</span>.
            </p>
            <input
              type="password"
              autoFocus
              autoComplete="off"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              placeholder={`Paste ${request.toolName} credential for ${request.agentName}`}
              className="w-full border border-white/10 bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending || credential.trim().length === 0}
                onClick={() => approve(credential)}
                className="inline-flex items-center justify-center bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setMode("idle");
                  setCredential("");
                }}
                className="inline-flex items-center justify-center px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {mode === "denying" ? (
          <div className="space-y-2 border border-rose-500/20 bg-rose-500/5 p-3">
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              autoFocus
              className="w-full border border-white/10 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-rose-400"
              placeholder='Optional — e.g. "Use the shared bot account instead"'
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={deny}
                className="inline-flex items-center justify-center border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm denial
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setMode("idle");
                  setReason("");
                }}
                className="inline-flex items-center justify-center px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-on-surface-variant/70">
          <TimeAgo date={request.requestedAt} />
        </span>
        {mode === "idle" ? (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={handleApproveClick}
              className="inline-flex items-center justify-center bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setMode("denying")}
              className="inline-flex items-center justify-center border border-white/10 px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-rose-500/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Deny
            </button>
          </>
        ) : null}
      </div>
    </RowShell>
  );
}

function ToolSuggestionRow({
  request,
  onHide,
  onRevert,
}: {
  request: ToolSuggestionItem;
  onHide: () => void;
  onRevert: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const supporters = request.supporters;
  const primary = supporters[0];
  const extraCount = Math.max(0, supporters.length - 1);

  function dismiss() {
    setError(null);
    onHide();
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/suggestions/${request.id}/dismiss`,
          { method: "POST" },
        );
        const data = await response.json();
        if (!response.ok) {
          onRevert();
          setError(getErrorMessage(data));
          return;
        }
        unwrapResponseData(data);
      } catch {
        onRevert();
        setError("Request failed.");
      }
    });
  }

  return (
    <RowShell request={request}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {primary ? (
            <span className="font-medium text-on-surface">
              {primary.agentName}
            </span>
          ) : null}
          <span className="text-on-surface-variant">suggests</span>
          <span className="font-medium text-on-surface">{request.name}</span>
          {extraCount > 0 ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-300/80">
              + {extraCount} more
            </span>
          ) : null}
        </div>
        {primary ? (
          <p className="text-sm italic text-on-surface-variant">
            “{primary.latestReason}”
          </p>
        ) : null}
        {request.url ? (
          <a
            href={request.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center font-mono text-[11px] text-on-surface-variant/60 hover:text-on-surface-variant"
          >
            {request.url}
          </a>
        ) : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-on-surface-variant/70">
          <TimeAgo date={request.requestedAt} />
        </span>
        <a
          href={`/dashboard/tools?suggestionId=${request.id}`}
          className="inline-flex items-center justify-center bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          Add to catalog
        </a>
        <button
          type="button"
          disabled={isPending}
          onClick={dismiss}
          className="inline-flex items-center justify-center border border-white/10 px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-rose-500/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </RowShell>
  );
}

function InstructionSuggestionRow({
  request,
  onHide,
  onRevert,
}: {
  request: InstructionSuggestionItem;
  onHide: () => void;
  onRevert: () => void;
}) {
  const [reason, setReason] = useState("");
  const [isDenying, setIsDenying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const supporters = request.supporters;
  const primary = supporters[0];

  function dismiss() {
    if (reason.trim().length < 5) {
      setError("Add a short reason (5+ chars).");
      return;
    }
    setError(null);
    onHide();
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/instruction-suggestions/${request.id}/dismiss`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          },
        );
        const data = await response.json();
        if (!response.ok) {
          onRevert();
          setError(getErrorMessage(data));
          setIsDenying(false);
          return;
        }
        unwrapResponseData(data);
      } catch {
        onRevert();
        setError("Request failed.");
        setIsDenying(false);
      }
    });
  }

  return (
    <RowShell request={request}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-on-surface-variant">Note for</span>
          <span className="font-medium text-on-surface">
            {request.toolName}
          </span>
          {primary ? (
            <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              from {primary.agentName}
            </span>
          ) : null}
        </div>
        <p className="text-sm italic text-on-surface-variant">
          “{request.learned}”
        </p>
        {isDenying ? (
          <div className="space-y-2 border border-rose-500/20 bg-rose-500/5 p-3">
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              autoFocus
              className="w-full border border-white/10 bg-surface px-3 py-2 text-xs text-on-surface outline-none focus:border-rose-400"
              placeholder="Why dismiss? Required (5+ chars)."
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={dismiss}
                className="inline-flex items-center justify-center border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition-colors hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm dismissal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setIsDenying(false);
                  setReason("");
                  setError(null);
                }}
                className="inline-flex items-center justify-center px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-on-surface-variant/70">
          <TimeAgo date={request.requestedAt} />
        </span>
        {!isDenying ? (
          <>
            <a
              href={`/dashboard/tools?selected=${request.toolId}&instructionSuggestionId=${request.id}`}
              className="inline-flex items-center justify-center bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90"
            >
              Open editor
            </a>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setIsDenying(true)}
              className="inline-flex items-center justify-center border border-white/10 px-3 py-1.5 text-xs text-on-surface-variant transition-colors hover:border-rose-500/40 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Dismiss
            </button>
          </>
        ) : null}
      </div>
    </RowShell>
  );
}
