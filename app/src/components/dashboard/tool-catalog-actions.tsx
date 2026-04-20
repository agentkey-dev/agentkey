"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { unwrapResponseData } from "@/components/dashboard/api";
import type { ToolCatalogDiff, ToolCatalogDiffItem } from "@/lib/core/tool-config";

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    const hint =
      "hint" in payload && typeof payload.hint === "string"
        ? ` ${payload.hint}`
        : "";

    return `${payload.error}${hint}`;
  }

  return "Import failed.";
}

function getActionTone(action: ToolCatalogDiffItem["action"]) {
  switch (action) {
    case "create":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
    case "update":
      return "border-blue-500/30 bg-blue-500/10 text-blue-100";
    case "remove":
      return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    case "invalid":
      return "border-rose-500/30 bg-rose-500/10 text-rose-100";
    default:
      return "border-white/10 bg-white/5 text-on-surface-variant";
  }
}

function getUploadContentType(fileName: string | null) {
  if (fileName?.toLowerCase().endsWith(".json")) {
    return "application/json";
  }

  return "text/plain";
}

export function ToolCatalogActions() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ToolCatalogDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isApplyPending, startApplyTransition] = useTransition();

  const canApply = Boolean(preview) && (preview?.counts.invalid ?? 0) === 0;

  function resetState() {
    setRawContent("");
    setFileName(null);
    setPreview(null);
    setError(null);
    setIsDragActive(false);
  }

  async function loadFile(file: File) {
    setRawContent(await file.text());
    setFileName(file.name);
    setPreview(null);
    setError(null);
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <a
          href="/api/admin/config/export?format=yaml"
          className="inline-flex items-center justify-center border border-white/10 bg-white/5 px-4 py-2 text-sm text-on-surface hover:border-primary/40"
        >
          Export YAML
        </a>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center justify-center border border-white/10 bg-white/5 px-4 py-2 text-sm text-on-surface hover:border-primary/40"
        >
          Import YAML
        </button>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-white/10 bg-surface-container p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-on-surface">
                  Import tool catalog
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
                  Paste YAML or drop a file to preview creates, updates, and
                  preview-only removals before applying.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  resetState();
                }}
                className="border border-white/10 px-3 py-2 text-sm text-on-surface hover:border-primary/40"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label
                className={`block border p-4 ${
                  isDragActive
                    ? "border-primary bg-primary/10"
                    : "border-white/10 bg-white/5"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragActive(false);
                  const file = event.dataTransfer.files[0];

                  if (file) {
                    void loadFile(file);
                  }
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-on-surface">
                      Paste config or drop a file
                    </div>
                    <div className="mt-1 text-xs text-on-surface-variant">
                      YAML is the primary dashboard flow. JSON also works.
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".yaml,.yml,.json,text/yaml,application/yaml,application/json"
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        void loadFile(file);
                      }
                    }}
                    className="max-w-full text-xs text-on-surface-variant"
                  />
                </div>
                <textarea
                  value={rawContent}
                  onChange={(event) => {
                    setRawContent(event.target.value);
                    setFileName(null);
                    setPreview(null);
                    setError(null);
                  }}
                  rows={14}
                  className="mt-4 w-full border border-white/10 bg-surface px-3 py-2 font-mono text-sm text-on-surface outline-none focus:border-primary"
                  placeholder={`version: 1
tools:
  - key: linear
    name: Linear
    description: Issue tracking for engineering teams.
    url: https://linear.app
    authType: api_key
    credentialMode: shared
    instructions: |
      Use as Bearer token.
      Base URL: https://api.linear.app`}
                />
              </label>

              {fileName ? (
                <div className="text-xs text-on-surface-variant">
                  Loaded file: <span className="text-on-surface">{fileName}</span>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isPreviewPending || !rawContent.trim()}
                  onClick={() => {
                    setError(null);

                    startPreviewTransition(async () => {
                      const response = await fetch(
                        "/api/admin/config/import?dryRun=1",
                        {
                          method: "PUT",
                          headers: {
                            "Content-Type": getUploadContentType(fileName),
                          },
                          body: rawContent,
                        },
                      );
                      const data = await response.json();

                      if (!response.ok) {
                        setPreview(null);
                        setError(getErrorMessage(data));
                        return;
                      }

                      setPreview(unwrapResponseData<ToolCatalogDiff>(data));
                    });
                  }}
                  className="inline-flex items-center justify-center bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPreviewPending ? "Previewing..." : "Preview import"}
                </button>
                <button
                  type="button"
                  disabled={isApplyPending || !canApply}
                  onClick={() => {
                    setError(null);

                    startApplyTransition(async () => {
                      const response = await fetch("/api/admin/config/import", {
                        method: "PUT",
                        headers: {
                          "Content-Type": getUploadContentType(fileName),
                        },
                        body: rawContent,
                      });
                      const data = await response.json();

                      if (!response.ok) {
                        setError(getErrorMessage(data));
                        return;
                      }

                      setPreview(unwrapResponseData<ToolCatalogDiff>(data));
                      router.refresh();
                    });
                  }}
                  className="inline-flex items-center justify-center border border-white/10 bg-white/5 px-4 py-2 text-sm text-on-surface hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApplyPending ? "Applying..." : "Confirm import"}
                </button>
              </div>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}

              {preview ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-5">
                    {(
                      [
                        ["New", preview.counts.create],
                        ["Updated", preview.counts.update],
                        ["Removed", preview.counts.remove],
                        ["Invalid", preview.counts.invalid],
                        ["Unchanged", preview.counts.unchanged],
                      ] as const
                    ).map(([label, count]) => (
                      <div
                        key={label}
                        className="border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">
                          {label}
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-on-surface">
                          {count}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border border-white/10 bg-surface-container-low p-4">
                    <div className="mb-3 text-sm font-semibold text-on-surface">
                      Diff preview
                    </div>
                    <div className="space-y-3">
                      {preview.items.map((item) => (
                        <div
                          key={`${item.action}:${item.key}:${item.name}`}
                          className="border border-white/10 bg-surface px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${getActionTone(item.action)}`}
                            >
                              {item.action}
                            </span>
                            <code className="text-xs text-primary">{item.key}</code>
                            <span className="text-sm text-on-surface">{item.name}</span>
                          </div>
                          {item.changes?.length ? (
                            <p className="mt-2 text-xs text-on-surface-variant">
                              Changes: {item.changes.join(", ")}
                            </p>
                          ) : null}
                          {item.action === "remove" ? (
                            <p className="mt-2 text-xs text-on-surface-variant">
                              Preview only. This import will not delete the tool.
                            </p>
                          ) : null}
                          {item.errors?.length ? (
                            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-rose-300">
                              {item.errors.map((entry) => (
                                <li key={entry}>{entry}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {preview.counts.invalid > 0 ? (
                    <p className="text-sm text-amber-100">
                      Fix the invalid entries before applying this import.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
