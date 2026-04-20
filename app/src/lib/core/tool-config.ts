import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

import type { ToolAuthType, ToolCredentialMode } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { normalizeToolUrl } from "@/lib/tool-branding";

const CONFIG_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const configCatalogVersionSchema = z.object({
  version: z.literal(1),
  tools: z.array(z.unknown()),
});

const importedToolSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(
        CONFIG_KEY_RE,
        "Tool keys must use lowercase letters, numbers, and hyphens only.",
      ),
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
    instructions: z.string().trim().max(4000).default(""),
    credentialConfigured: z.boolean().optional(),
  })
  .transform((value) => ({
    key: value.key,
    name: value.name,
    description: value.description,
    url: normalizeToolUrl(value.url) ?? null,
    authType: value.authType,
    credentialMode: value.credentialMode,
    instructions: value.instructions,
  }));

export type ImportedToolConfig = z.infer<typeof importedToolSchema>;

export type ExportedToolConfig = {
  key: string;
  name: string;
  description: string;
  url: string | null;
  authType: ToolAuthType;
  credentialMode: ToolCredentialMode;
  instructions: string;
  credentialConfigured: boolean;
};

export type ToolCatalogDocument = {
  version: 1;
  tools: ExportedToolConfig[];
};

export type ToolCatalogFormat = "json" | "yaml";

export type ExistingToolConfigSnapshot = {
  id: string;
  configKey: string;
  name: string;
  description: string;
  url: string | null;
  authType: ToolAuthType;
  credentialMode: ToolCredentialMode;
  instructions: string | null;
  credentialConfigured: boolean;
};

export type ToolCatalogDiffItem = {
  action: "create" | "update" | "unchanged" | "remove" | "invalid";
  key: string;
  name: string;
  changes?: string[];
  errors?: string[];
};

export type ToolCatalogDiff = {
  counts: Record<ToolCatalogDiffItem["action"], number>;
  items: ToolCatalogDiffItem[];
  importedTools: ImportedToolConfig[];
};

function formatZodIssues(issues: z.ZodIssue[]) {
  return issues.map((issue) => {
    const field = issue.path.join(".");
    return field ? `${field}: ${issue.message}` : issue.message;
  });
}

export function slugifyToolConfigKey(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "tool";
}

export function getUniqueToolConfigKey(
  label: string,
  isTaken: (candidate: string) => boolean,
) {
  const base = slugifyToolConfigKey(label);

  if (!isTaken(base)) {
    return base;
  }

  let suffix = 2;

  while (isTaken(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

export function formatToolCatalog(
  document: ToolCatalogDocument,
  format: ToolCatalogFormat,
) {
  if (format === "json") {
    return JSON.stringify(document, null, 2);
  }

  return stringifyYaml(document, {
    blockQuote: "literal",
    defaultStringType: "PLAIN",
    lineWidth: 0,
  });
}

export function detectToolCatalogFormat(
  body: string,
  contentType: string | null | undefined,
): ToolCatalogFormat {
  const mediaType = contentType?.split(";")[0]?.trim().toLowerCase();

  if (mediaType === "application/json") {
    return "json";
  }

  if (
    mediaType === "application/yaml" ||
    mediaType === "application/x-yaml" ||
    mediaType === "text/yaml" ||
    mediaType === "text/x-yaml"
  ) {
    return "yaml";
  }

  if (!mediaType || mediaType === "text/plain") {
    const trimmed = body.trim();
    return trimmed.startsWith("{") || trimmed.startsWith("[") ? "json" : "yaml";
  }

  throw new AppError(
    "Unsupported config format.",
    400,
    "Send YAML or JSON. If you paste plain text, use a YAML or JSON document body.",
  );
}

export function parseToolCatalogDocument(input: {
  body: string;
  contentType?: string | null;
}) {
  const format = detectToolCatalogFormat(input.body, input.contentType);
  let parsed: unknown;

  try {
    parsed = format === "json" ? JSON.parse(input.body) : parseYaml(input.body);
  } catch {
    throw new AppError(
      `Could not parse ${format.toUpperCase()} config.`,
      400,
      "Fix the syntax errors in the imported catalog and try again.",
    );
  }

  const catalog = configCatalogVersionSchema.safeParse(parsed);

  if (!catalog.success) {
    throw new AppError(
      "Invalid tool catalog document.",
      400,
      formatZodIssues(catalog.error.issues).join(" "),
    );
  }

  const invalidItems: ToolCatalogDiffItem[] = [];
  const importedTools: ImportedToolConfig[] = [];
  const seenKeys = new Set<string>();

  for (const [index, entry] of catalog.data.tools.entries()) {
    const result = importedToolSchema.safeParse(entry);

    if (!result.success) {
      invalidItems.push({
        action: "invalid",
        key: `item-${index + 1}`,
        name: `Entry ${index + 1}`,
        errors: formatZodIssues(result.error.issues),
      });
      continue;
    }

    if (seenKeys.has(result.data.key)) {
      invalidItems.push({
        action: "invalid",
        key: result.data.key,
        name: result.data.name,
        errors: ["Duplicate tool key in import document."],
      });
      continue;
    }

    seenKeys.add(result.data.key);
    importedTools.push(result.data);
  }

  return { format, importedTools, invalidItems };
}

export function diffToolCatalog(
  existingTools: ExistingToolConfigSnapshot[],
  importedTools: ImportedToolConfig[],
  invalidItems: ToolCatalogDiffItem[] = [],
): ToolCatalogDiff {
  const byKey = new Map(existingTools.map((tool) => [tool.configKey, tool]));
  const seenKeys = new Set<string>();
  const items: ToolCatalogDiffItem[] = [...invalidItems];
  const counts: ToolCatalogDiff["counts"] = {
    create: 0,
    update: 0,
    unchanged: 0,
    remove: 0,
    invalid: invalidItems.length,
  };

  for (const imported of importedTools) {
    const existing = byKey.get(imported.key);
    seenKeys.add(imported.key);

    if (!existing) {
      counts.create += 1;
      items.push({
        action: "create",
        key: imported.key,
        name: imported.name,
      });
      continue;
    }

    const changes: string[] = [];

    if (existing.name !== imported.name) changes.push("name");
    if (existing.description !== imported.description) changes.push("description");
    if ((existing.url ?? null) !== imported.url) changes.push("url");
    if (existing.authType !== imported.authType) changes.push("authType");
    if (existing.credentialMode !== imported.credentialMode) {
      changes.push("credentialMode");
    }
    if ((existing.instructions ?? "") !== imported.instructions) {
      changes.push("instructions");
    }

    if (changes.length === 0) {
      counts.unchanged += 1;
      items.push({
        action: "unchanged",
        key: imported.key,
        name: imported.name,
      });
      continue;
    }

    counts.update += 1;
    items.push({
      action: "update",
      key: imported.key,
      name: imported.name,
      changes,
    });
  }

  for (const existing of existingTools) {
    if (seenKeys.has(existing.configKey)) {
      continue;
    }

    counts.remove += 1;
    items.push({
      action: "remove",
      key: existing.configKey,
      name: existing.name,
    });
  }

  return {
    counts,
    items,
    importedTools,
  };
}
