import type { SuggestedToolContext, ToolAuthType, ToolCredentialMode } from "@/lib/tool-catalog";

export type ToolSetupFormState = {
  name: string;
  description: string;
  url: string;
  authType: ToolAuthType;
  credentialMode: ToolCredentialMode;
  credential: string;
  instructions: string;
};

export const EMPTY_TOOL_SETUP_FORM: ToolSetupFormState = {
  name: "",
  description: "",
  url: "",
  authType: "api_key",
  credentialMode: "shared",
  credential: "",
  instructions: "",
};

export type ToolDraftFields = {
  name: string;
  description: string;
  authType: ToolAuthType;
  url?: string;
  instructions: string;
};

export function getInitialToolSetupForm(
  suggestion?: SuggestedToolContext | null,
): ToolSetupFormState {
  if (!suggestion) {
    return EMPTY_TOOL_SETUP_FORM;
  }

  return {
    ...EMPTY_TOOL_SETUP_FORM,
    name: suggestion.name,
    url: suggestion.url ?? "",
  };
}

export function getSuggestionAgentContext(
  suggestion?: SuggestedToolContext | null,
) {
  if (!suggestion) {
    return [];
  }

  return suggestion.supporters
    .map((supporter) => supporter.latestReason.trim())
    .filter((reason, index, reasons) => reason.length > 0 && reasons.indexOf(reason) === index);
}

export function withCredentialMode(
  form: ToolSetupFormState,
  credentialMode: ToolCredentialMode,
): ToolSetupFormState {
  return {
    ...form,
    credentialMode,
    credential: credentialMode === "per_agent" ? "" : form.credential,
  };
}

export function canContinueFromGuideStep(form: ToolSetupFormState) {
  return form.credentialMode === "per_agent" || form.credential.trim().length > 0;
}

export function applyToolDraft(
  form: ToolSetupFormState,
  draft: ToolDraftFields,
): ToolSetupFormState {
  return {
    ...form,
    name: draft.name,
    description: draft.description,
    url: draft.url ?? form.url,
    authType: draft.authType,
    instructions: draft.instructions,
  };
}

export function normalizeGuideMarkdown(markdown: string) {
  const trimmed = markdown.replace(/\r/g, "").trim();

  if (!trimmed.startsWith("```")) {
    return markdown;
  }

  const withoutOpeningFence = trimmed.replace(/^```[a-zA-Z0-9_-]*\n?/, "");

  return withoutOpeningFence.replace(/\n?```[\t ]*$/, "");
}
