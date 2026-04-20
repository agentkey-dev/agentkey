import { eq } from "drizzle-orm";

import { hashAgentApiKey } from "@/lib/agent-keys";
import { appendAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";

function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Best-effort logging of failed authentication attempts.
 * Failures here must never block the 401 response.
 */
function logFailedAuth(reason: string, request: Request) {
  console.warn(
    JSON.stringify({
      event: "auth_failure",
      reason,
      ip: getRequestIp(request),
      ts: new Date().toISOString(),
    }),
  );
}

export async function requireAgentRequestContext(request: Request) {
  // Pre-auth rate limit keyed on client IP. Prevents log-flood, DB pressure,
  // and API-key brute-force at wire-speed regardless of whether the caller
  // ever presents a valid key.
  const ip = getRequestIp(request);
  await enforceRateLimit(ip, "preauth");

  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    logFailedAuth("missing_bearer_token", request);
    throw new AppError(
      "Missing bearer token.",
      401,
      "Include an Authorization header: Bearer <your_api_key>. Get your API key from the AgentKey dashboard.",
    );
  }

  const apiKey = authHeader.slice("Bearer ".length).trim();
  const apiKeyHash = hashAgentApiKey(apiKey);
  const db = getDb();

  const agent = await db.query.agents.findFirst({
    where: eq(agents.apiKeyHash, apiKeyHash),
  });

  if (!agent) {
    logFailedAuth("invalid_api_key", request);
    throw new AppError(
      "Invalid API key.",
      401,
      "This API key is not recognized. Check that AGENTKEY_API_KEY is set correctly. If the key was rotated, ask your admin for the new one.",
    );
  }

  if (agent.status !== "active") {
    appendAuditLog({
      organizationId: agent.organizationId,
      actorType: "agent",
      actorId: agent.id,
      actorLabel: agent.name,
      action: "auth.rejected_suspended",
      targetType: "agent",
      targetId: agent.id,
    }).catch(() => {});

    throw new AppError(
      "This agent has been suspended.",
      403,
      "Contact your admin to reactivate this agent or create a new one.",
    );
  }

  return {
    agentId: agent.id,
    agentName: agent.name,
    agentDescription: agent.description,
    organizationId: agent.organizationId,
    createdAt: agent.createdAt,
  };
}
