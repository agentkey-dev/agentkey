import { createHash } from "node:crypto";

import { getToolDomain, normalizeToolUrl } from "@/lib/tool-branding";

export const TOOL_SUGGESTION_COOLDOWN_HOURS = 24;

export type ToolIdentityInput = {
  name: string;
  url?: string | null;
};

export type ToolSuggestionIdentity = {
  normalizedName: string;
  normalizedUrl: string | null;
  normalizedDomain: string | null;
};

export function normalizeToolSuggestionName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getToolSuggestionIdentity(
  input: ToolIdentityInput,
): ToolSuggestionIdentity {
  const normalizedUrl = normalizeToolUrl(input.url) ?? null;

  return {
    normalizedName: normalizeToolSuggestionName(input.name),
    normalizedUrl,
    normalizedDomain: getToolDomain(normalizedUrl) ?? null,
  };
}

export function getToolSuggestionLockTokens(
  organizationId: string,
  identity: Pick<ToolSuggestionIdentity, "normalizedName" | "normalizedDomain">,
) {
  const tokens = new Set([`name:${organizationId}:${identity.normalizedName}`]);

  if (identity.normalizedDomain) {
    tokens.add(`domain:${organizationId}:${identity.normalizedDomain}`);

    const primaryDomainLabel = identity.normalizedDomain.split(".")[0]?.trim();

    if (primaryDomainLabel) {
      tokens.add(`name:${organizationId}:${primaryDomainLabel}`);
    }
  }

  return [...tokens].sort();
}

export function getToolSuggestionLockKeyParts(token: string): [number, number] {
  const digest = createHash("sha256").update(token).digest();

  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

export function toolMatchesSuggestionIdentity(
  input: ToolIdentityInput,
  identity: Pick<ToolSuggestionIdentity, "normalizedName" | "normalizedDomain">,
) {
  const toolIdentity = getToolSuggestionIdentity(input);

  if (identity.normalizedDomain) {
    return toolIdentity.normalizedDomain === identity.normalizedDomain;
  }

  return toolIdentity.normalizedName === identity.normalizedName;
}

export function toolSuggestionsMatch(
  left: Pick<ToolSuggestionIdentity, "normalizedName" | "normalizedDomain">,
  right: Pick<ToolSuggestionIdentity, "normalizedName" | "normalizedDomain">,
) {
  if (left.normalizedDomain && right.normalizedDomain) {
    return left.normalizedDomain === right.normalizedDomain;
  }

  return left.normalizedName === right.normalizedName;
}

export function getToolSuggestionCooldownUntil(now = new Date()) {
  return new Date(now.getTime() + TOOL_SUGGESTION_COOLDOWN_HOURS * 60 * 60 * 1000);
}
