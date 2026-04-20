import { gateway, generateObject } from "ai";
import { z } from "zod";

import { getAdminContext } from "@/lib/auth/admin";
import {
  AGENTKEY_CONTEXT,
  getToolDocsPromptSections,
  loadToolDocs,
  normalizeToolDraft,
  toolDraftSchema,
} from "@/lib/core/tool-drafting";
import { getOptionalAiDraftModel, isAiDraftingEnabled } from "@/lib/env";
import {
  AI_JSON_BODY_LIMIT,
  AppError,
  handleRouteError,
  jsonData,
  jsonError,
  readJsonBody,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { normalizeToolUrl } from "@/lib/tool-branding";

const draftRequestSchema = z.object({
  docsUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !!normalizeToolUrl(value), "Enter a valid HTTP or HTTPS URL."),
});

export async function POST(request: Request) {
  try {
    const context = await getAdminContext();

    if (context.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (context.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    if (!isAiDraftingEnabled()) {
      return jsonError(
        "AI drafting is not available in this environment.",
        503,
        "Deploy on Vercel with AI Gateway access to use this feature.",
      );
    }

    await enforceRateLimit(context.userId, "admin");

    const parsed = await readJsonBody(
      request,
      draftRequestSchema,
      AI_JSON_BODY_LIMIT,
    );
    const docsUrl = normalizeToolUrl(parsed.docsUrl);

    if (!docsUrl) {
      throw new AppError("Enter a valid HTTP or HTTPS URL.", 400);
    }

    const docs = await loadToolDocs(docsUrl);
    const { object } = await generateObject({
      model: gateway(getOptionalAiDraftModel() ?? "openai/gpt-5.4"),
      schema: toolDraftSchema,
      system: `${AGENTKEY_CONTEXT}

Draft a SaaS tool config for AgentKey. The "instructions" field is sent to AI agents alongside the credential — write for an agent, not a human.

Fields to return:
- name: product name
- description: one sentence, what the tool does
- authType: api_key, oauth_token, bot_token, or other
- url: public product URL (e.g. https://github.com), not the API URL
- instructions: concise technical reference (under 20 lines) — auth header format, API base URL, 3-5 key endpoints, rate limits if relevant. Put API base URLs here, not in "url".
- warnings: facts you're uncertain about or caveats the admin should verify. Empty array if confident.

API details only — no setup tutorials, no GUI, no marketing. Only include facts grounded in the provided docs.`,
      prompt: [
        "Draft a tool config with these fields: name, description, authType, url, instructions, warnings.",
        "",
        ...getToolDocsPromptSections(docs),
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return jsonData(normalizeToolDraft(object));
  } catch (error) {
    return handleRouteError(error);
  }
}
