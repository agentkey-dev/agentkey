"use client";

import { useState, useTransition } from "react";

import { unwrapResponseData } from "@/components/dashboard/api";

type ActionButtonProps = {
  endpoint: string;
  method: "POST" | "DELETE";
  label: string;
  confirmMessage?: string;
  body?: Record<string, unknown>;
  tone?: "default" | "danger";
  onCompleted?: (result: Record<string, unknown>) => void;
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

export function ActionButton({
  endpoint,
  method,
  label,
  confirmMessage,
  body,
  tone = "default",
  onCompleted,
}: ActionButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const className =
    tone === "danger"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:border-rose-400"
      : "border-white/10 bg-white/5 text-on-surface hover:border-primary/40";

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        className={`inline-flex items-center justify-center border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        onClick={() => {
          if (confirmMessage && !window.confirm(confirmMessage)) {
            return;
          }

          setError(null);
          setSecret(null);

          startTransition(async () => {
            const response = await fetch(endpoint, {
              method,
              headers: body ? { "Content-Type": "application/json" } : undefined,
              body: body ? JSON.stringify(body) : undefined,
            });
            const data = await response.json();

            if (!response.ok) {
              setError(getErrorMessage(data));
              return;
            }

            const result = unwrapResponseData<Record<string, unknown>>(data);

            if (typeof result.api_key === "string") {
              setSecret(result.api_key);
            }

            onCompleted?.(result);
          });
        }}
      >
        {isPending ? "Working..." : label}
      </button>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {secret ? (
        <code className="block overflow-x-auto border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-on-surface">
          {secret}
        </code>
      ) : null}
    </div>
  );
}

export const AgentActionButton = ActionButton;
