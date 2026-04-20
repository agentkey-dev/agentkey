"use client";

import { useState, useTransition } from "react";

import { unwrapResponseData } from "@/components/dashboard/api";
import type { AgentCatalogItem } from "@/lib/agent-catalog";

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

export function AgentUpdateForm({
  agent,
  onUpdated,
}: {
  agent: AgentCatalogItem;
  onUpdated?: (agent: AgentCatalogItem) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="grid gap-3 border border-white/10 bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const payload = {
          name: String(formData.get("name") ?? ""),
          description: String(formData.get("description") ?? ""),
        };

        setError(null);

        startTransition(async () => {
          const response = await fetch(`/api/admin/agents/${agent.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await response.json();

          if (!response.ok) {
            setError(getErrorMessage(data));
            return;
          }

          const updated = unwrapResponseData<AgentCatalogItem>(data);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
          onUpdated?.(updated);
        });
      }}
    >
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
          Edit agent
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">
          Update the agent&apos;s display name and description without affecting
          its API key or access.
        </p>
      </div>
      <label className="grid gap-1.5 text-sm text-on-surface-variant">
        Agent name
        <input
          name="name"
          defaultValue={agent.name}
          className="border border-white/10 bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
        />
      </label>
      <label className="grid gap-1.5 text-sm text-on-surface-variant">
        Description
        <textarea
          name="description"
          rows={3}
          defaultValue={agent.description}
          className="border border-white/10 bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
        />
      </label>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Changes saved.</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center border border-white/10 bg-white/5 px-3 py-2 text-sm text-on-surface transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
