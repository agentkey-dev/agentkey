import assert from "node:assert/strict";
import test from "node:test";

import {
  detectToolCatalogFormat,
  diffToolCatalog,
  formatToolCatalog,
  getUniqueToolConfigKey,
  parseToolCatalogDocument,
  slugifyToolConfigKey,
} from "@/lib/core/tool-config";
import { AppError } from "@/lib/http";

test("tool config keys are slugified and collision-safe", () => {
  assert.equal(slugifyToolConfigKey("  GitHub Enterprise  "), "github-enterprise");
  assert.equal(slugifyToolConfigKey("!!!"), "tool");

  const existing = new Set(["linear", "linear-2", "linear-3"]);
  const next = getUniqueToolConfigKey("Linear", (candidate) =>
    existing.has(candidate),
  );

  assert.equal(next, "linear-4");
});

test("tool catalog format detection trusts content type before sniffing", () => {
  assert.equal(
    detectToolCatalogFormat('{"version":1,"tools":[]}', "application/json"),
    "json",
  );
  assert.equal(
    detectToolCatalogFormat("version: 1\ntools: []", "text/plain"),
    "yaml",
  );
  assert.equal(
    detectToolCatalogFormat('{"version":1,"tools":[]}', undefined),
    "json",
  );
});

test("tool catalog parsing reports invalid and duplicate items without rejecting the whole document", () => {
  const parsed = parseToolCatalogDocument({
    body: `version: 1
tools:
  - key: linear
    name: Linear
    description: Issue tracker
    url: https://linear.app
    authType: api_key
    credentialMode: shared
    instructions: Use as Bearer token.
  - key: linear
    name: Duplicate
    description: Duplicate key
    authType: api_key
    credentialMode: shared
    instructions: Use as Bearer token.
  - key: bad key
    name: Broken
    description: bad
    authType: api_key
    credentialMode: shared
    instructions: short`,
    contentType: "text/plain",
  });

  assert.equal(parsed.importedTools.length, 1);
  assert.equal(parsed.invalidItems.length, 2);
  assert.match(parsed.invalidItems[0].errors?.[0] ?? "", /Duplicate tool key/);
  assert.match(
    parsed.invalidItems[1].errors?.join(" ") ?? "",
    /lowercase letters, numbers, and hyphens only/,
  );
});

test("tool catalog parsing rejects mismatched declared json bodies", () => {
  assert.throws(
    () =>
      parseToolCatalogDocument({
        body: "version: 1\ntools: []",
        contentType: "application/json",
      }),
    (error) =>
      error instanceof AppError &&
      error.message === "Could not parse JSON config.",
  );
});

test("tool catalog diff reports create update unchanged remove and invalid counts", () => {
  const diff = diffToolCatalog(
    [
      {
        id: "tool_1",
        configKey: "linear",
        name: "Linear",
        description: "Issue tracker",
        url: "https://linear.app/",
        authType: "api_key",
        credentialMode: "shared",
        instructions: "Use as Bearer token.",
        credentialConfigured: true,
      },
      {
        id: "tool_2",
        configKey: "github",
        name: "GitHub",
        description: "Code hosting",
        url: "https://github.com/",
        authType: "oauth_token",
        credentialMode: "shared",
        instructions: "Use as Bearer token.",
        credentialConfigured: false,
      },
    ],
    [
      {
        key: "linear",
        name: "Linear",
        description: "Issue tracker",
        url: "https://linear.app/",
        authType: "api_key",
        credentialMode: "shared",
        instructions: "Use as Bearer token.",
      },
      {
        key: "notion",
        name: "Notion",
        description: "Docs",
        url: "https://www.notion.so/",
        authType: "oauth_token",
        credentialMode: "per_agent",
        instructions: "Use OAuth token.",
      },
      {
        key: "github",
        name: "GitHub",
        description: "Source control",
        url: "https://github.com/",
        authType: "oauth_token",
        credentialMode: "shared",
        instructions: "Use as Bearer token.",
      },
    ],
    [
      {
        action: "invalid",
        key: "broken",
        name: "Broken",
        errors: ["description: Required"],
      },
    ],
  );

  assert.deepEqual(diff.counts, {
    create: 1,
    update: 1,
    unchanged: 1,
    remove: 0,
    invalid: 1,
  });
  assert.equal(diff.items.filter((item) => item.action === "update")[0]?.key, "github");
  assert.deepEqual(
    diff.items.filter((item) => item.action === "update")[0]?.changes,
    ["description"],
  );
});

test("tool catalog formatter exports yaml and json documents", () => {
  const document = {
    version: 1 as const,
    tools: [
      {
        key: "linear",
        name: "Linear",
        description: "Issue tracker",
        url: "https://linear.app/",
        authType: "api_key" as const,
        credentialMode: "shared" as const,
        instructions: "Use as Bearer token.",
        credentialConfigured: true,
      },
    ],
  };

  const yaml = formatToolCatalog(document, "yaml");
  const json = formatToolCatalog(document, "json");

  assert.match(yaml, /version: 1/);
  assert.match(yaml, /credentialConfigured: true/);
  assert.match(json, /"key": "linear"/);
});
