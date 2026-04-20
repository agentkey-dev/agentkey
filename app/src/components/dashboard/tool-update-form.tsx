"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unwrapResponseData } from "@/components/dashboard/api";
import { buildInstructionSuggestionDraft } from "@/lib/core/tool-instruction-suggestions";
import type { ToolCatalogItem } from "@/lib/tool-catalog";
import type {
  PendingInstructionSuggestionDetail,
  ToolInstructionHistoryEntry,
} from "@/lib/services/tool-instructions";

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Update failed.";
}

function formatDateInputValue(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEndOfDayIso(value: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map((part) => Number(part));
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  return date.toISOString();
}

export function ToolUpdateForm({
  tool,
  autoFocusInstructions = false,
  instructionsCallout,
  instructionSuggestion,
  instructionHistory,
  instructionHistoryLoading = false,
  instructionHistoryError,
  onUpdated,
}: {
  tool: ToolCatalogItem;
  autoFocusInstructions?: boolean;
  instructionsCallout?: string;
  instructionSuggestion?: PendingInstructionSuggestionDetail | null;
  instructionHistory?: ToolInstructionHistoryEntry[];
  instructionHistoryLoading?: boolean;
  instructionHistoryError?: string | null;
  onUpdated?: (tool: ToolCatalogItem) => void;
}) {
  const initialInstructionsValue =
    instructionSuggestion?.toolId === tool.id
      ? buildInstructionSuggestionDraft(tool.instructions, instructionSuggestion.learned)
      : tool.instructions ?? "";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [instructionsValue, setInstructionsValue] = useState(initialInstructionsValue);
  const [acceptedInstructionSuggestionId, setAcceptedInstructionSuggestionId] =
    useState<string | null>(
      instructionSuggestion?.toolId === tool.id ? instructionSuggestion.id : null,
    );
  const [restoreInstructionVersionId, setRestoreInstructionVersionId] =
    useState<string | null>(null);
  const instructionsRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!autoFocusInstructions || !instructionsRef.current) {
      return;
    }

    instructionsRef.current.focus();
    instructionsRef.current.setSelectionRange(
      instructionsRef.current.value.length,
      instructionsRef.current.value.length,
    );
  }, [autoFocusInstructions, tool.id]);

  function getVersionSourceLabel(source: ToolInstructionHistoryEntry["source"]) {
    switch (source) {
      case "manual":
        return "Manual save";
      case "suggestion_accept":
        return "Accepted suggestion";
      case "restore":
        return "Restore";
      case "tool_create":
        return "Tool created";
      case "backfill":
        return "Backfill";
    }
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const payload = {
          name: String(formData.get("name") ?? ""),
          description: String(formData.get("description") ?? ""),
          url: String(formData.get("url") ?? ""),
          instructions: instructionsValue,
          credential: String(formData.get("credential") ?? ""),
          credentialExpiresAt:
            tool.credentialMode === "shared"
              ? getEndOfDayIso(String(formData.get("credentialExpiresAt") ?? ""))
              : undefined,
          acceptedInstructionSuggestionId:
            acceptedInstructionSuggestionId ?? undefined,
          restoreInstructionVersionId: restoreInstructionVersionId ?? undefined,
        };

        setError(null);

        startTransition(async () => {
          const response = await fetch(`/api/admin/tools/${tool.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await response.json();

          if (!response.ok) {
            setError(getErrorMessage(data));
            return;
          }

          const updated = unwrapResponseData<ToolCatalogItem>(data);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
          onUpdated?.({
            ...tool,
            ...updated,
          });
        });
      }}
    >
      <label className="grid gap-1.5 text-sm text-on-surface-variant">
        Tool name
        <input
          name="name"
          defaultValue={tool.name}
          className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
        />
      </label>
      <label className="grid gap-1.5 text-sm text-on-surface-variant">
        Description
        <textarea
          name="description"
          rows={2}
          defaultValue={tool.description}
          className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
        />
      </label>
      <label className="grid gap-1.5 text-sm text-on-surface-variant">
        URL
        <input
          name="url"
          defaultValue={tool.url ?? ""}
          className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          placeholder="https://linear.app"
        />
      </label>
      <div className="space-y-1">
        <label htmlFor={`instructions-${tool.id}`} className="text-xs text-on-surface-variant">
          Usage guide for agents (sent with credential)
        </label>
        {instructionsCallout ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-on-surface">
            {instructionsCallout}
          </div>
        ) : null}
        {instructionSuggestion?.toolId === tool.id ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-on-surface">
            <div className="text-[11px] uppercase tracking-[0.2em] text-primary">
              Pending suggestion
            </div>
            <p className="mt-2 whitespace-pre-wrap">{instructionSuggestion.learned}</p>
            <div className="mt-3 space-y-2 text-on-surface-variant">
              {instructionSuggestion.supporters.map((supporter) => (
                <div key={supporter.agentId}>
                  <span className="font-medium text-on-surface">
                    {supporter.agentName}
                  </span>
                  {": "}
                  {supporter.latestWhy}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {restoreInstructionVersionId ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Restoring from a previous instruction version. Saving will create a new
            current version.
          </div>
        ) : null}
        <textarea
          id={`instructions-${tool.id}`}
          name="instructions"
          rows={6}
          value={instructionsValue}
          onChange={(event) => setInstructionsValue(event.target.value)}
          ref={instructionsRef}
          className="w-full border border-white/10 bg-surface px-3 py-2 font-mono text-sm text-on-surface outline-none focus:border-primary"
          placeholder={`How to use this tool: auth method, base URLs, IDs, conventions, rules...`}
        />
      </div>
      <section className="space-y-3 border border-white/10 bg-surface p-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
          Instruction history
        </div>
        {instructionHistoryLoading ? (
          <p className="text-sm text-on-surface-variant">Loading history...</p>
        ) : instructionHistoryError ? (
          <p className="text-sm text-rose-300">{instructionHistoryError}</p>
        ) : !instructionHistory?.length ? (
          <p className="text-sm text-on-surface-variant">
            No instruction history yet.
          </p>
        ) : (
          <div className="space-y-3">
            {instructionHistory.map((entry) => (
              <div
                key={entry.id}
                className="grid gap-3 border border-white/10 bg-surface-container px-3 py-3 md:grid-cols-[minmax(0,1fr)_140px]"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-on-surface">
                      {getVersionSourceLabel(entry.source)}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-on-surface-variant">
                    {entry.createdByEmail}
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-on-surface-variant">
                    {entry.instructions}
                  </pre>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInstructionsValue(entry.instructions);
                    setRestoreInstructionVersionId(entry.id);
                    setAcceptedInstructionSuggestionId(null);
                  }}
                  className="inline-flex h-fit items-center justify-center border border-white/10 px-3 py-2 text-sm text-on-surface transition-colors hover:border-primary/40"
                >
                  Restore into editor
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      {tool.credentialMode === "shared" ? (
        <>
          <label className="grid gap-1.5 text-sm text-on-surface-variant">
            Credential expires
            <input
              name="credentialExpiresAt"
              type="date"
              defaultValue={formatDateInputValue(tool.credentialExpiresAt)}
              className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            />
            <span className="text-xs text-on-surface-variant/70">
              Advisory only. The credential remains usable after this date until
              you rotate it.
            </span>
          </label>
          <label className="grid gap-1.5 text-sm text-on-surface-variant">
            Rotate shared credential
            <input
              name="credential"
              type="password"
              autoComplete="off"
              className="border border-white/10 bg-surface px-3 py-2 font-mono text-sm text-on-surface outline-none focus:border-primary"
              placeholder={
                tool.authType === "oauth_token"
                  ? 'Paste new JSON to rotate, e.g. {"client_id": "...", "refresh_token": "..."}'
                  : "Paste new credential to rotate (leave blank to keep current)"
              }
            />
            <span className="text-xs text-on-surface-variant/70">
              All agents get the new credential on their next fetch. No
              disruption.
            </span>
          </label>
        </>
      ) : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {saved ? (
        <p className="text-sm text-emerald-400">Changes saved.</p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center border border-white/10 bg-white/5 px-3 py-2 text-sm text-on-surface transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save changes"}
      </button>
      <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/50">
        config key: {tool.configKey}
      </p>
    </form>
  );
}
