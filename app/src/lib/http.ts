import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getOptionalAgentCorsOrigins } from "@/lib/env";

export function assertAllowedAgentOrigin(request: Request) {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) {
    return;
  }

  const allowedOrigins = getOptionalAgentCorsOrigins();
  if (!allowedOrigins.includes(requestOrigin)) {
    throw new AppError(
      "Cross-origin browser requests are not allowed.",
      403,
      "Agent API calls should be made from a server or CLI, not a browser. Unset the Origin header or add the origin to AGENT_CORS_ORIGINS.",
    );
  }
}

// Defense-in-depth against CSRF on admin mutation routes that don't read a JSON
// body (and therefore can't rely on the Content-Type: application/json check in
// readJsonBody). Browsers always set Origin on cross-origin POSTs; server-to-
// server callers typically omit it. Reject when Origin is present and does not
// match the request's own host.
export function assertSameOriginMutation(request: Request) {
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    return;
  }

  let originHost: string;
  let targetHost: string;
  try {
    originHost = new URL(originHeader).host;
    targetHost = new URL(request.url).host;
  } catch {
    throw new AppError(
      "Invalid Origin header.",
      403,
      "Origin header must be a valid URL.",
    );
  }

  if (originHost !== targetHost) {
    throw new AppError(
      "Cross-origin requests are not allowed on this endpoint.",
      403,
      "This endpoint only accepts same-origin requests from the AgentKey dashboard.",
    );
  }
}

export class AppError extends Error {
  status: number;
  hint?: string;

  constructor(message: string, status = 400, hint?: string) {
    super(message);
    this.status = status;
    this.hint = hint;
  }
}

export function jsonError(
  message: string,
  status = 400,
  hint?: string,
  headers?: Record<string, string>,
) {
  const body: { error: string; hint?: string } = { error: message };
  if (hint) {
    body.hint = hint;
  }
  return NextResponse.json(body, { status, headers });
}

export function jsonSuccess(
  data: unknown,
  status = 200,
  headers?: Record<string, string>,
) {
  return NextResponse.json(data, { status, headers });
}

export function jsonData(
  data: unknown,
  status = 200,
  headers?: Record<string, string>,
) {
  return jsonSuccess({ data }, status, headers);
}

const textDecoder = new TextDecoder();
const AGENT_CORS_ALLOWED_HEADERS = "Authorization, Content-Type";
const AGENT_CORS_EXPOSED_HEADERS =
  "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset";

export const AGENT_JSON_BODY_LIMIT = 8192;
export const ADMIN_JSON_BODY_LIMIT = 32768;
export const AI_JSON_BODY_LIMIT = 65536;
export const IMPORT_BODY_LIMIT = 262144;

function getBodyLimitHint(maxBytes: number, detail?: string) {
  return `Request body exceeds ${maxBytes} bytes.${detail ? ` ${detail}` : " Reduce the payload and retry."}`;
}

function isJsonContentType(contentType: string | null) {
  if (!contentType) {
    return false;
  }

  const normalized = contentType.split(";")[0]?.trim().toLowerCase();

  return normalized === "application/json" || normalized.endsWith("+json");
}

function getContentLength(request: Request) {
  const header = request.headers.get("content-length");

  if (!header) {
    return null;
  }

  const value = Number.parseInt(header, 10);

  return Number.isFinite(value) ? value : null;
}

async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
  sizeHintDetail?: string,
) {
  const contentLength = getContentLength(request);

  if (contentLength !== null && contentLength > maxBytes) {
    throw new AppError(
      "Request body is too large.",
      413,
      getBodyLimitHint(maxBytes, sizeHintDetail),
    );
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      throw new AppError(
        "Request body is too large.",
        413,
        getBodyLimitHint(maxBytes, sizeHintDetail),
      );
    }

    chunks.push(value);
  }

  if (chunks.length === 0) {
    return "";
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return textDecoder.decode(merged);
}

export async function readJsonBody<T>(
  request: Request,
  schema: { parse: (value: unknown) => T },
  maxBytes: number,
  sizeHintDetail?: string,
) {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw new AppError(
      "Expected an application/json request body.",
      415,
      "Set Content-Type: application/json.",
    );
  }

  const rawBody = await readBodyWithLimit(request, maxBytes, sizeHintDetail);
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new AppError("Malformed JSON request body.", 400, "Request body is not valid JSON.");
  }

  return schema.parse(parsed);
}

export function readTextBody(
  request: Request,
  maxBytes: number,
  sizeHintDetail?: string,
) {
  return readBodyWithLimit(request, maxBytes, sizeHintDetail);
}

export function getRequestMetadata(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const userAgentRaw = request.headers.get("user-agent");
  const userAgent = userAgentRaw ? userAgentRaw.slice(0, 256) : null;

  return { ip, userAgent };
}

function getAllowedAgentCorsOrigin(request: Request) {
  const requestOrigin = request.headers.get("origin");

  if (!requestOrigin) {
    return null;
  }

  const allowedOrigins = getOptionalAgentCorsOrigins();

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

function applyAgentCorsHeaders(
  request: Request,
  headers: Headers,
  methods: string[],
) {
  const allowedOrigin = getAllowedAgentCorsOrigin(request);

  if (!allowedOrigin) {
    return headers;
  }

  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Headers", AGENT_CORS_ALLOWED_HEADERS);
  headers.set(
    "Access-Control-Allow-Methods",
    [...new Set([...methods, "OPTIONS"])].join(", "),
  );
  headers.set("Access-Control-Expose-Headers", AGENT_CORS_EXPOSED_HEADERS);
  headers.set("Access-Control-Max-Age", "600");
  headers.append("Vary", "Origin");

  return headers;
}

export function withAgentCors(
  request: Request,
  response: Response,
  methods: string[],
) {
  applyAgentCorsHeaders(request, response.headers, methods);

  return response;
}

export function agentCorsPreflight(request: Request, methods: string[]) {
  const allowedOrigin = getAllowedAgentCorsOrigin(request);

  if (request.headers.get("origin") && !allowedOrigin) {
    return new NextResponse(null, { status: 403 });
  }

  return withAgentCors(request, new NextResponse(null, { status: 204 }), methods);
}

export function handleAgentRouteError(
  request: Request,
  error: unknown,
  methods: string[],
) {
  return withAgentCors(request, handleRouteError(error), methods);
}

export function handleRouteError(error: unknown) {
  if (
    error instanceof AppError &&
    "headers" in error &&
    typeof (error as { headers?: Record<string, string> }).headers === "object"
  ) {
    const rateLimitHeaders = (error as { headers: Record<string, string> })
      .headers;
    return jsonError(error.message, error.status, error.hint, rateLimitHeaders);
  }

  if (error instanceof AppError) {
    return jsonError(error.message, error.status, error.hint);
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const field = firstIssue?.path?.join(".") || "input";
    const details = error.issues.map((issue) => ({
      field: issue.path.join(".") || "input",
      message: issue.message,
    }));
    return NextResponse.json(
      {
        error: `Validation error: ${firstIssue?.message ?? "invalid input"} (field: ${field}).`,
        details,
        hint: "Check the request body matches the expected format. Call GET on the same endpoint to see the schema.",
      },
      { status: 400 },
    );
  }

  console.error(error);
  return jsonError("Internal server error.", 500);
}
