"use client";

import { useState, useTransition } from "react";

import { unwrapResponseData } from "@/components/dashboard/api";

type AgentRotateKeyButtonProps = {
  agentId: string;
  agentName: string;
  skipConfirm: boolean;
  compact?: boolean;
  onRotated: (agentId: string, rotatedAt: string) => void;
};

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

export function AgentRotateKeyButton({
  agentId,
  agentName,
  skipConfirm,
  compact = false,
  onRotated,
}: AgentRotateKeyButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  function rotate() {
    if (
      !skipConfirm &&
      !window.confirm(`Rotate the API key for ${agentName}?`)
    ) {
      return;
    }

    setError(null);
    setApiKey(null);
    setCopyStatus("idle");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/agents/${agentId}/rotate-key`, {
          method: "POST",
        });
        const data = await response.json();

        if (!response.ok) {
          setError(getErrorMessage(data));
          return;
        }

        const result = unwrapResponseData<Record<string, unknown>>(data);
        const nextApiKey =
          typeof result.api_key === "string" ? result.api_key : null;

        if (!nextApiKey) {
          setError("Rotation succeeded, but the new key was not returned.");
          return;
        }

        setApiKey(nextApiKey);
        onRotated(agentId, new Date().toISOString());

        try {
          await navigator.clipboard.writeText(nextApiKey);
          setCopyStatus("copied");
        } catch {
          setCopyStatus("failed");
        }
      } catch {
        setError("Request failed.");
      }
    });
  }

  return (
    <div
      className={compact ? "inline-flex max-w-72 flex-col items-end gap-1.5" : "space-y-2"}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={isPending}
        onClick={() => rotate()}
        className={`inline-flex items-center justify-center border border-white/10 bg-white/5 text-on-surface transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${
          compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
        }`}
      >
        {isPending ? "Rotating..." : "Rotate key"}
      </button>
      {copyStatus === "copied" ? (
        <p className={compact ? "text-right text-[11px] text-emerald-300" : "text-sm text-emerald-300"}>
          Copied to clipboard
        </p>
      ) : null}
      {copyStatus === "failed" ? (
        <p className={compact ? "text-right text-[11px] text-amber-300" : "text-sm text-amber-300"}>
          Copy failed. Key shown below.
        </p>
      ) : null}
      {error ? (
        <p className={compact ? "text-right text-[11px] text-rose-300" : "text-sm text-rose-300"}>
          {error}
        </p>
      ) : null}
      {apiKey ? (
        <code
          className={`block max-w-full overflow-x-auto border border-primary/30 bg-primary/10 px-3 py-2 font-mono text-xs text-on-surface ${
            compact ? "text-right" : ""
          }`}
        >
          {apiKey}
        </code>
      ) : null}
    </div>
  );
}
