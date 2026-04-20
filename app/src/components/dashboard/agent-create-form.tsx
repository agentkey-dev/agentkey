"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { unwrapResponseData } from "@/components/dashboard/api";
import type { AgentCatalogItem } from "@/lib/agent-catalog";

import {
  getAgentEnvBlock,
  getAgentSystemPromptBlock,
} from "@/lib/agent-onboarding";

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "Something went wrong.";
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 rounded-sm border border-white/10 bg-surface-container-high px-3 py-1.5 font-mono text-[11px] text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
    >
      {copied ? "Copied!" : label ?? "Copy"}
    </button>
  );
}

export function AgentCreateForm({
  baseUrl,
  onCreated,
}: {
  baseUrl: string;
  onCreated?: (agent: AgentCatalogItem) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    apiKey: string;
    agentName: string;
  } | null>(null);

  if (created) {
    const envBlock = getAgentEnvBlock(created.apiKey);
    const instructionsBlock = getAgentSystemPromptBlock(baseUrl);

    return (
      <div className="space-y-8 border border-white/10 bg-surface-container p-6">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.5 8.5 6.5 11.5 12.5 5.5" />
            </svg>
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-on-surface">
              {created.agentName} is ready
            </h2>
            <p className="text-sm text-on-surface-variant">
              Three steps left — save the key, teach the agent, add a tool.
              The API key is shown once and cannot be recovered.
            </p>
          </div>
        </div>

        {/* Step 1: API key + env var together */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary text-on-primary font-mono text-xs font-bold">
              1
            </span>
            <span className="text-base font-semibold text-on-surface">
              Save your API key
            </span>
          </div>
          <div className="ml-10 space-y-3">
            <p className="text-sm text-on-surface-variant">
              Store this as{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-on-surface">
                AGENTKEY_API_KEY
              </code>{" "}
              in your agent&apos;s runtime — <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-on-surface">.env</code>, secrets manager, or shell.
            </p>
            <div className="relative border border-white/10 bg-surface-container-lowest p-4">
              <pre className="overflow-x-auto pr-20 font-mono text-sm text-on-surface">
                {envBlock}
              </pre>
              <div className="absolute right-3 top-3">
                <CopyButton text={envBlock} label="Copy line" />
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Agent instructions — the killer block */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary text-on-primary font-mono text-xs font-bold">
              2
            </span>
            <span className="text-base font-semibold text-on-surface">
              Teach your agent about AgentKey
            </span>
          </div>
          <div className="ml-10 space-y-3">
            <p className="text-sm text-on-surface-variant">
              Paste this block into wherever your agent reads instructions —{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-on-surface">
                CLAUDE.md
              </code>
              ,{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-on-surface">
                TOOLS.md
              </code>
              {" "}(OpenClaw),{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-on-surface">
                .cursorrules
              </code>
              ,{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[12px] text-on-surface">
                AGENTS.md
              </code>
              , or its system prompt field. That&apos;s it — no SDK, no wrapper.
            </p>
            <div className="relative border border-white/10 bg-surface-container-lowest">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  agent instructions · paste as-is
                </span>
                <CopyButton text={instructionsBlock} label="Copy block" />
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-relaxed text-on-surface/90">
                {instructionsBlock}
              </pre>
            </div>
          </div>
        </div>

        {/* Step 3: Add a tool — the next real action */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary text-on-primary font-mono text-xs font-bold">
              3
            </span>
            <span className="text-base font-semibold text-on-surface">
              Add a tool your agent needs
            </span>
          </div>
          <div className="ml-10 space-y-3">
            <p className="text-sm text-on-surface-variant">
              Once your agent is running with the instructions above, it can
              request tools on its own. You can also pre-add the ones you
              already know it needs.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard/tools"
                className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
              >
                Add a tool
                <span aria-hidden="true">→</span>
              </Link>
              <button
                type="button"
                onClick={() => setCreated(null)}
                className="text-sm text-on-surface-variant transition-colors hover:text-on-surface"
              >
                or create another agent
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 border border-white/10 bg-surface-container p-6">
      <div>
        <h2 className="text-lg font-semibold text-on-surface">Create agent</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Register a new agent identity. You&apos;ll get an API key and
          ready-to-paste configuration snippets.
        </p>
      </div>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const payload = {
            name: String(new FormData(form).get("name") ?? ""),
            description: String(new FormData(form).get("description") ?? ""),
          };

          setError(null);

          startTransition(async () => {
            const response = await fetch("/api/admin/agents", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (!response.ok) {
              setError(getErrorMessage(data));
              return;
            }

            const created = unwrapResponseData<{
              agent_id: string;
              api_key: string;
              agent: AgentCatalogItem;
            }>(data);

            setCreated({
              apiKey: created.api_key,
              agentName: payload.name,
            });
            onCreated?.(created.agent);
            form.reset();
          });
        }}
      >
        <label className="grid gap-2 text-sm text-on-surface-variant">
          Agent name
          <input
            name="name"
            required
            className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none transition-colors focus:border-primary"
            placeholder="Bug Tracker Agent"
          />
        </label>
        <label className="grid gap-2 text-sm text-on-surface-variant">
          Description
          <textarea
            name="description"
            rows={3}
            className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none transition-colors focus:border-primary"
            placeholder="Tracks, triages, and updates bug tickets for the engineering team."
          />
        </label>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create agent"}
        </button>
      </form>
    </div>
  );
}
