import assert from "node:assert/strict";
import test from "node:test";

import {
  extractReadableDoc,
  extractReadableTextFromHtml,
  loadToolDocs,
  normalizeToolDraft,
  normalizeToolInstructionsDraft,
  normalizeToolSetupGuideMetadata,
} from "@/lib/core/tool-drafting";
import { AppError } from "@/lib/http";

test("html docs extraction strips chrome and preserves readable text", () => {
  const extracted = extractReadableTextFromHtml(`
    <html>
      <head>
        <title>Linear API</title>
        <style>.hidden { display: none; }</style>
      </head>
      <body>
        <script>console.log("ignore")</script>
        <h1>Authentication</h1>
        <p>Use a personal API key in the Authorization header.</p>
      </body>
    </html>
  `);

  assert.equal(extracted.title, "Linear API");
  assert.match(extracted.text, /Authentication/);
  assert.match(extracted.text, /Authorization header/);
  assert.doesNotMatch(extracted.text, /console\.log/);
});

test("doc extraction fails for thin pages with a concrete hint", () => {
  assert.throws(
    () =>
      extractReadableDoc({
        body: "<html><body><p>Too short</p></body></html>",
        contentType: "text/html; charset=utf-8",
      }),
    (error) =>
      error instanceof AppError &&
      error.message === "This page returned too little content." &&
      error.hint === "Try pasting the API reference page instead.",
  );
});

test("tool draft normalization rejects malformed model output", () => {
  assert.throws(
    () =>
      normalizeToolDraft({
        name: "Linear",
        description: "Issue tracker",
        authType: "api_key",
        instructions: "too short",
      }),
    (error) =>
      error instanceof AppError &&
      error.message === "AI drafting returned an invalid response.",
  );

  const normalized = normalizeToolDraft({
    name: "Linear",
    description: "Issue tracker",
    authType: "api_key",
    url: "linear.app",
    instructions:
      "Use this as a Bearer token. Base URL: https://api.linear.app. Create tickets instead of pushing code changes directly.",
    warnings: ["Workspace-specific IDs were not visible on this page."],
  });

  assert.equal(normalized.url, "https://linear.app/");
  assert.equal(normalized.warnings.length, 1);
});

test("tool draft normalization accepts explicit null urls", () => {
  const normalized = normalizeToolDraft({
    name: "Internal Tool",
    description: "Private admin tool",
    authType: "other",
    url: null,
    instructions:
      "Use the documented internal auth flow. Confirm the base URL from the environment before making requests.",
    warnings: [],
  });

  assert.equal(normalized.url, undefined);
});

test("setup guide metadata normalization accepts valid payloads", () => {
  const normalized = normalizeToolSetupGuideMetadata({
    authType: "oauth_token",
    warnings: ["Only workspace admins can create tokens."],
    scopeRecommendations: ["Issues: Read and write", "Projects: Read only"],
  });

  assert.equal(normalized.authType, "oauth_token");
  assert.deepEqual(normalized.scopeRecommendations, [
    "Issues: Read and write",
    "Projects: Read only",
  ]);
});

test("setup guide metadata normalization rejects malformed payloads", () => {
  assert.throws(
    () =>
      normalizeToolSetupGuideMetadata({
        authType: "session_cookie",
        warnings: [],
        scopeRecommendations: [],
      }),
    (error) =>
      error instanceof AppError &&
      error.message === "AI setup guide returned invalid metadata.",
  );
});

test("instructions normalization rejects malformed model output", () => {
  assert.throws(
    () =>
      normalizeToolInstructionsDraft({
        instructions: "short",
        warnings: [],
      }),
    (error) =>
      error instanceof AppError &&
      error.message === "AI instructions drafting returned an invalid response.",
  );
});

test("load tool docs skips fetching when no docs url is provided", async () => {
  const originalFetch = global.fetch;
  let called = false;

  global.fetch = (async () => {
    called = true;
    throw new Error("fetch should not be called");
  }) as typeof global.fetch;

  try {
    const docs = await loadToolDocs();

    assert.equal(docs.docsUrl, undefined);
    assert.equal(docs.docsPage, undefined);
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("load tool docs fetches and extracts readable content when docs url is provided", async () => {
  const originalFetch = global.fetch;

  global.fetch = (async () =>
    new Response(
      `<!doctype html>
      <html>
        <head><title>Linear API</title></head>
        <body>
          <h1>Authentication</h1>
          <p>${"Use the Authorization header. ".repeat(20)}</p>
        </body>
      </html>`,
      {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    )) as typeof global.fetch;

  try {
    const docs = await loadToolDocs("https://docs.linear.app/api/graphql/overview");

    assert.equal(docs.docsUrl, "https://docs.linear.app/api/graphql/overview");
    assert.equal(docs.docsPage?.title, "Linear API");
    assert.match(docs.docsPage?.text ?? "", /Authorization header/);
  } finally {
    global.fetch = originalFetch;
  }
});
