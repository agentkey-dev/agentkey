"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unwrapResponseData } from "@/components/dashboard/api";
import { buildInstructionSuggestionDraft } from "@/lib/core/tool-instruction-suggestions";
import type { ToolAuthType, ToolCatalogItem } from "@/lib/tool-catalog";
import type {
  PendingInstructionSuggestionDetail,
  ToolInstructionHistoryEntry,
} from "@/lib/services/tool-instructions";
import {
  detectPlaintextSecretInInstructions,
  serializeLoginCredential,
} from "@/lib/totp";

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
  const [authType, setAuthType] = useState<ToolAuthType>(tool.authType);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [clearTotpSecret, setClearTotpSecret] = useState(false);
  const [instructionsValue, setInstructionsValue] = useState(initialInstructionsValue);
  const [acceptedInstructionSuggestionId, setAcceptedInstructionSuggestionId] =
    useState<string | null>(
      instructionSuggestion?.toolId === tool.id ? instructionSuggestion.id : null,
    );
  const [restoreInstructionVersionId, setRestoreInstructionVersionId] =
    useState<string | null>(null);
  const instructionsRef = useRef<HTMLTextAreaElement | null>(null);
  const secretWarning = detectPlaintextSecretInInstructions(instructionsValue);

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
        const rawCredential = String(formData.get("credential") ?? "");
        const resolvedCredential =
          authType === "login" && loginUsername.trim() && loginPassword
            ? serializeLoginCredential({
                username: loginUsername.trim(),
                password: loginPassword,
              })
            : rawCredential;
        const payload = {
          name: String(formData.get("name") ?? ""),
          description: String(formData.get("description") ?? ""),
          url: String(formData.get("url") ?? ""),
          authType,
          instructions: instructionsValue,
          credential: resolvedCredential,
          totpSecret:
            tool.credentialMode === "shared" &&
            !clearTotpSecret &&
            totpSecret.trim()
              ? totpSecret.trim()
              : undefined,
          clearTotpSecret:
            tool.credentialMode === "shared" && clearTotpSecret
              ? true
              : undefined,
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
          setTotpSecret("");
          setClearTotpSecret(false);
          setLoginUsername("");
          setLoginPassword("");
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
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm text-on-surface-variant">
          URL
          <input
            name="url"
            defaultValue={tool.url ?? ""}
            className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            placeholder="https://linear.app"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-on-surface-variant">
          Auth type
          <select
            value={authType}
            onChange={(event) =>
              setAuthType(event.target.value as ToolAuthType)
            }
            className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          >
            <option value="api_key">API key</option>
            <option value="login">Login (username + password)</option>
            <option value="oauth_token">OAuth token</option>
            <option value="bot_token">Bot token</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
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
        {secretWarning ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
            <span>{secretWarning.warning}</span>
            {secretWarning.extractedTotpSecret &&
            tool.credentialMode === "shared" ? (
              <button
                type="button"
                onClick={() => {
                  setClearTotpSecret(false);
                  setTotpSecret(secretWarning.extractedTotpSecret!);
                  if (secretWarning.cleanedInstructions !== undefined) {
                    setInstructionsValue(secretWarning.cleanedInstructions);
                  }
                }}
                className="shrink-0 border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 font-medium text-amber-100 transition-colors hover:bg-amber-400/25"
              >
                Extract to encrypted 2FA field
              </button>
            ) : null}
          </div>
        ) : null}
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
          {authType === "login" ? (
            <div className="space-y-2 border border-white/10 bg-surface p-3">
              <div className="text-xs font-medium text-on-surface">
                Rotate shared login credential
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs text-on-surface-variant">
                  Username / email
                  <input
                    type="text"
                    autoComplete="off"
                    value={loginUsername}
                    onChange={(event) => setLoginUsername(event.target.value)}
                    className="border border-white/10 bg-surface-container px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
                    placeholder="Leave blank to keep current"
                  />
                </label>
                <label className="grid gap-1 text-xs text-on-surface-variant">
                  Password
                  <input
                    type="password"
                    autoComplete="off"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="border border-white/10 bg-surface-container px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
                    placeholder="Leave blank to keep current"
                  />
                </label>
              </div>
              <p className="text-xs text-on-surface-variant/70">
                Vended as structured{" "}
                <code className="font-mono text-primary">
                  &#123; username, password &#125;
                </code>{" "}
                on next fetch.
              </p>
            </div>
          ) : (
            <label className="grid gap-1.5 text-sm text-on-surface-variant">
              Rotate shared credential
              <input
                name="credential"
                type="password"
                autoComplete="off"
                className="border border-white/10 bg-surface px-3 py-2 font-mono text-sm text-on-surface outline-none focus:border-primary"
                placeholder={
                  authType === "oauth_token"
                    ? 'Paste new JSON to rotate, e.g. {"client_id": "...", "refresh_token": "..."}'
                    : "Paste new credential to rotate (leave blank to keep current)"
                }
              />
              <span className="text-xs text-on-surface-variant/70">
                All agents get the new credential on their next fetch. No
                disruption.
              </span>
            </label>
          )}
          <div className="space-y-2 border border-white/10 bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-on-surface">
                <span>2FA / TOTP secret</span>
                {tool.totpConfigured && !clearTotpSecret ? (
                  <span className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                    2FA active
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant/60">
                    optional · zero seed exposure
                  </span>
                )}
              </div>
              {tool.totpConfigured ? (
                <label className="flex items-center gap-1.5 text-xs text-rose-300">
                  <input
                    type="checkbox"
                    checked={clearTotpSecret}
                    onChange={(event) => {
                      setClearTotpSecret(event.target.checked);
                      if (event.target.checked) {
                        setTotpSecret("");
                      }
                    }}
                  />
                  Remove 2FA secret on save
                </label>
              ) : null}
            </div>
            <input
              type="password"
              autoComplete="off"
              disabled={clearTotpSecret}
              value={totpSecret}
              onChange={(event) => setTotpSecret(event.target.value)}
              className="w-full border border-white/10 bg-surface-container px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary disabled:opacity-50"
              placeholder={
                tool.totpConfigured
                  ? "Paste new Base32 secret or otpauth:// URI to rotate (leave blank to keep current)"
                  : "Paste Base32 secret (e.g. JBSWY3DPEHPK3PXP) or otpauth://totp/... to enable 2FA"
              }
            />
            <p className="text-xs text-on-surface-variant/70">
              AgentKey stores the seed encrypted and computes live 6-digit codes
              in memory (vended via{" "}
              <code className="font-mono text-primary">otp.code</code> and{" "}
              <code className="font-mono text-primary">
                GET /api/tools/&#123;id&#125;/otp
              </code>
              ). Agents never see the raw seed.
            </p>
          </div>
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
