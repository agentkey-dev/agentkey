import { z } from "zod";
import { AppError } from "@/lib/http";
import { normalizeToolUrl } from "@/lib/tool-branding";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertValidUuid(value: string, label = "ID") {
  if (!UUID_RE.test(value)) {
    throw new AppError(
      `${label} is not a valid identifier.`,
      404,
      `Check the ${label.toLowerCase()} value. Use GET /api/tools to find valid tool IDs.`,
    );
  }
}

export const createAgentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(""),
});

export const updateAgentSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
});

export const createToolSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).default(""),
    url: z
      .string()
      .trim()
      .max(500)
      .optional()
      .refine(
        (value) => value === undefined || value === "" || !!normalizeToolUrl(value),
        "Enter a valid HTTP or HTTPS URL.",
      ),
    authType: z.enum(["api_key", "oauth_token", "bot_token", "other"]),
    credentialMode: z.enum(["shared", "per_agent"]),
    credential: z.string().trim().optional(),
    instructions: z.string().trim().max(4000).optional(),
    sourceSuggestionId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.credentialMode === "shared" && !value.credential) {
      ctx.addIssue({
        code: "custom",
        message: "Shared tools require a credential.",
        path: ["credential"],
      });
    }

    if (value.credentialMode === "per_agent" && value.credential) {
      ctx.addIssue({
        code: "custom",
        message: "Per-agent tools cannot store a shared credential.",
        path: ["credential"],
      });
    }
  });

export const updateToolSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine(
      (value) => value === undefined || value === "" || !!normalizeToolUrl(value),
      "Enter a valid HTTP or HTTPS URL.",
    ),
  credential: z.string().trim().optional(),
  instructions: z.string().trim().max(4000).optional(),
  credentialExpiresAt: z.string().datetime().nullable().optional(),
  acceptedInstructionSuggestionId: z.string().uuid().optional(),
  restoreInstructionVersionId: z.string().uuid().optional(),
});

export const requestAccessSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export const suggestToolSchema = z.object({
  name: z.string().trim().min(2).max(120),
  url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine(
      (value) => value === undefined || value === "" || !!normalizeToolUrl(value),
      "Enter a valid HTTP or HTTPS URL.",
    ),
  reason: z.string().trim().min(5).max(500),
});

export const suggestToolInstructionSchema = z.object({
  learned: z.string().trim().min(5),
  why: z.string().trim().min(5),
});

export const approveRequestSchema = z.object({
  credential: z.string().trim().optional(),
});

export const assignToolToAgentSchema = z.object({
  toolId: z.string().uuid(),
  credential: z.string().trim().optional(),
});

export const denyRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const dismissInstructionSuggestionSchema = z.object({
  reason: z.string().trim().min(5),
});

export const notificationSettingsSchema = z.object({
  slackWebhook: z.string().trim().optional(),
  discordWebhook: z.string().trim().optional(),
  clearSlack: z.boolean().optional(),
  clearDiscord: z.boolean().optional(),
});

export const auditFiltersSchema = z.object({
  action: z.string().trim().optional(),
  agent_id: z.string().uuid().optional(),
  tool_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
