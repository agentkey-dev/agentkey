import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_JSON_BODY_LIMIT,
  agentCorsPreflight,
  AppError,
  jsonData,
  readJsonBody,
} from "@/lib/http";
import {
  assignToolToAgentSchema,
  requestAccessSchema,
  suggestToolInstructionSchema,
  updateAgentSchema,
} from "@/lib/validation";
import {
  GET as getSuggestSchema,
  OPTIONS as optionsSuggestSchema,
} from "@/app/api/tools/suggest/route";
import {
  GET as getInstructionSuggestSchema,
  OPTIONS as optionsInstructionSuggestSchema,
} from "@/app/api/tools/[toolId]/instructions/suggest/route";
import {
  GET as getRequestSchema,
  OPTIONS as optionsRequestSchema,
} from "@/app/api/tools/[toolId]/request/route";

test("readJsonBody rejects malformed JSON with a correction hint", async () => {
  const request = new Request("https://agentkey.test/api/tools/suggest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: '{"reason": "missing quote}',
  });

  await assert.rejects(
    () => readJsonBody(request, requestAccessSchema, AGENT_JSON_BODY_LIMIT),
    (error) =>
      error instanceof AppError &&
      error.status === 400 &&
      error.hint === "Request body is not valid JSON.",
  );
});

test("readJsonBody rejects oversized payloads with the byte limit in the hint", async () => {
  const request = new Request("https://agentkey.test/api/tools/suggest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(AGENT_JSON_BODY_LIMIT + 1),
    },
    body: JSON.stringify({
      reason: "x".repeat(AGENT_JSON_BODY_LIMIT),
    }),
  });

  await assert.rejects(
    () =>
      readJsonBody(
        request,
        requestAccessSchema,
        AGENT_JSON_BODY_LIMIT,
        "Shorten your reason field.",
      ),
    (error) =>
      error instanceof AppError &&
      error.status === 413 &&
      error.hint ===
        `Request body exceeds ${AGENT_JSON_BODY_LIMIT} bytes. Shorten your reason field.`,
  );
});

test("readJsonBody rejects non-json content types", async () => {
  const request = new Request("https://agentkey.test/api/tools/suggest", {
    method: "POST",
    headers: {
      "content-type": "text/plain",
    },
    body: '{"reason":"Need access"}',
  });

  await assert.rejects(
    () => readJsonBody(request, requestAccessSchema, AGENT_JSON_BODY_LIMIT),
    (error) =>
      error instanceof AppError &&
      error.status === 415 &&
      error.hint === "Set Content-Type: application/json.",
  );
});

test("jsonData wraps successful responses in a data envelope", async () => {
  const response = jsonData({ ok: true }, 201);

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    data: {
      ok: true,
    },
  });
});

test("agent CORS preflight returns allow headers for approved origins", async () => {
  const previousOrigins = process.env.AGENT_CORS_ORIGINS;
  process.env.AGENT_CORS_ORIGINS = "https://agent-ui.example.com";

  try {
    const request = new Request("https://agentkey.test/api/tools/suggest", {
      method: "OPTIONS",
      headers: {
        origin: "https://agent-ui.example.com",
      },
    });

    const response = agentCorsPreflight(request, ["GET", "POST"]);

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://agent-ui.example.com",
    );
    assert.equal(
      response.headers.get("Access-Control-Allow-Methods"),
      "GET, POST, OPTIONS",
    );
  } finally {
    process.env.AGENT_CORS_ORIGINS = previousOrigins;
  }
});

test("schema discovery GET and OPTIONS handlers remain available on suggest", async () => {
  const previousOrigins = process.env.AGENT_CORS_ORIGINS;
  process.env.AGENT_CORS_ORIGINS = "https://agent-ui.example.com";

  try {
    const getRequest = new Request("https://agentkey.test/api/tools/suggest", {
      headers: {
        origin: "https://agent-ui.example.com",
      },
    });
    const getResponse = await getSuggestSchema(getRequest);

    assert.equal(getResponse.status, 200);
    assert.ok((await getResponse.json()).schema);
    assert.equal(
      getResponse.headers.get("Access-Control-Allow-Origin"),
      "https://agent-ui.example.com",
    );

    const optionsRequest = new Request(
      "https://agentkey.test/api/tools/suggest",
      {
        method: "OPTIONS",
        headers: {
          origin: "https://agent-ui.example.com",
        },
      },
    );
    const optionsResponse = await optionsSuggestSchema(optionsRequest);

    assert.equal(optionsResponse.status, 204);
    assert.equal(
      optionsResponse.headers.get("Access-Control-Allow-Methods"),
      "GET, POST, OPTIONS",
    );
  } finally {
    process.env.AGENT_CORS_ORIGINS = previousOrigins;
  }
});

test("schema discovery GET and OPTIONS handlers remain available on request", async () => {
  const previousOrigins = process.env.AGENT_CORS_ORIGINS;
  process.env.AGENT_CORS_ORIGINS = "https://agent-ui.example.com";

  try {
    const getRequest = new Request(
      "https://agentkey.test/api/tools/tool-id/request",
      {
        headers: {
          origin: "https://agent-ui.example.com",
        },
      },
    );
    const getResponse = await getRequestSchema(getRequest);

    assert.equal(getResponse.status, 200);
    assert.ok((await getResponse.json()).schema);

    const optionsRequest = new Request(
      "https://agentkey.test/api/tools/tool-id/request",
      {
        method: "OPTIONS",
        headers: {
          origin: "https://agent-ui.example.com",
        },
      },
    );
    const optionsResponse = await optionsRequestSchema(optionsRequest);

    assert.equal(optionsResponse.status, 204);
    assert.equal(
      optionsResponse.headers.get("Access-Control-Allow-Origin"),
      "https://agent-ui.example.com",
    );
  } finally {
    process.env.AGENT_CORS_ORIGINS = previousOrigins;
  }
});

test("schema discovery GET and OPTIONS handlers remain available on instruction suggest", async () => {
  const previousOrigins = process.env.AGENT_CORS_ORIGINS;
  process.env.AGENT_CORS_ORIGINS = "https://agent-ui.example.com";

  try {
    const getRequest = new Request(
      "https://agentkey.test/api/tools/tool-id/instructions/suggest",
      {
        headers: {
          origin: "https://agent-ui.example.com",
        },
      },
    );
    const getResponse = await getInstructionSuggestSchema(getRequest);

    assert.equal(getResponse.status, 200);
    assert.ok((await getResponse.json()).schema);

    const optionsRequest = new Request(
      "https://agentkey.test/api/tools/tool-id/instructions/suggest",
      {
        method: "OPTIONS",
        headers: {
          origin: "https://agent-ui.example.com",
        },
      },
    );
    const optionsResponse = await optionsInstructionSuggestSchema(optionsRequest);

    assert.equal(optionsResponse.status, 204);
    assert.equal(
      optionsResponse.headers.get("Access-Control-Allow-Origin"),
      "https://agent-ui.example.com",
    );
  } finally {
    process.env.AGENT_CORS_ORIGINS = previousOrigins;
  }
});

test("suggestToolInstructionSchema accepts notes longer than 500 characters", () => {
  const parsed = suggestToolInstructionSchema.parse({
    learned: "A".repeat(1200),
    why: "B".repeat(1200),
  });

  assert.equal(parsed.learned.length, 1200);
  assert.equal(parsed.why.length, 1200);
});


test("assignToolToAgentSchema accepts a uuid tool id and trims credential", () => {
  const parsed = assignToolToAgentSchema.parse({
    toolId: "123e4567-e89b-12d3-a456-426614174000",
    credential: "  discord_bot_token  ",
  });

  assert.deepEqual(parsed, {
    toolId: "123e4567-e89b-12d3-a456-426614174000",
    credential: "discord_bot_token",
  });
});

test("assignToolToAgentSchema rejects invalid tool ids", () => {
  const parsed = assignToolToAgentSchema.safeParse({
    toolId: "not-a-uuid",
  });

  assert.equal(parsed.success, false);
});

test("updateAgentSchema accepts trimmed name and description", () => {
  const parsed = updateAgentSchema.parse({
    name: "  Bug Bot  ",
    description: "  Tracks bugs and triages tickets.  ",
  });

  assert.deepEqual(parsed, {
    name: "Bug Bot",
    description: "Tracks bugs and triages tickets.",
  });
});

test("updateAgentSchema rejects too-short names", () => {
  const parsed = updateAgentSchema.safeParse({
    name: "a",
  });

  assert.equal(parsed.success, false);
});

test("updateAgentSchema rejects overlong descriptions", () => {
  const parsed = updateAgentSchema.safeParse({
    description: "x".repeat(501),
  });

  assert.equal(parsed.success, false);
});
