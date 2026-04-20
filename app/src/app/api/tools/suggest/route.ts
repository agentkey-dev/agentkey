import { NextResponse } from "next/server";

import { TOOLS_SUGGEST_SCHEMA } from "@/lib/api-schemas";
import { requireAgentRequestContext } from "@/lib/auth/agent";
import {
  AGENT_JSON_BODY_LIMIT,
  agentCorsPreflight,
  handleAgentRouteError,
  jsonSuccess,
  readJsonBody,
  withAgentCors,
} from "@/lib/http";
import { getAppOrigin } from "@/lib/origin";
import { enforceRateLimit } from "@/lib/ratelimit";
import { suggestTool } from "@/lib/services/agent";
import { suggestToolSchema } from "@/lib/validation";

const TOOLS_SUGGEST_METHODS = ["GET", "POST"] as const;

export async function OPTIONS(request: Request) {
  return agentCorsPreflight(request, [...TOOLS_SUGGEST_METHODS]);
}

export async function GET(request: Request) {
  return withAgentCors(
    request,
    jsonSuccess({ schema: TOOLS_SUGGEST_SCHEMA }),
    [...TOOLS_SUGGEST_METHODS],
  );
}

export async function POST(request: Request) {
  try {
    const agentContext = await requireAgentRequestContext(request);
    const rlHeaders = await enforceRateLimit(agentContext.agentId, "request");
    const parsed = await readJsonBody(
      request,
      suggestToolSchema,
      AGENT_JSON_BODY_LIMIT,
      "Shorten your reason field.",
    );
    const result = await suggestTool(
      agentContext.organizationId,
      agentContext.agentId,
      parsed,
      agentContext.agentName,
      getAppOrigin(),
    );

    if (result.outcome === "existing_tool") {
      return withAgentCors(
        request,
        NextResponse.json(
          {
            error: "This tool already exists in the catalog.",
            tool_id: result.toolId,
            tool_name: result.toolName,
            message:
              "This tool already exists in the catalog. Request access to it directly.",
            hint: "Call POST /api/tools/{tool_id}/request with this tool_id to request access immediately.",
          },
          { status: 409, headers: rlHeaders },
        ),
        [...TOOLS_SUGGEST_METHODS],
      );
    }

    if (result.outcome === "cooldown") {
      return withAgentCors(
        request,
        NextResponse.json(
          {
            error: "This tool suggestion was recently dismissed.",
            suggestion_id: result.suggestionId,
            retry_after: result.retryAfter,
            hint: "Wait for the cooldown to expire, then suggest it again if it is still needed.",
          },
          { status: 409, headers: rlHeaders },
        ),
        [...TOOLS_SUGGEST_METHODS],
      );
    }

    return withAgentCors(
      request,
      jsonSuccess(
        {
          suggestion_id: result.suggestionId,
          status: "pending",
          existing: result.existing,
          message: result.existing
            ? "Your support has been added to an existing pending suggestion."
            : "Your tool suggestion has been submitted. A human admin will review it.",
        },
        201,
        rlHeaders,
      ),
      [...TOOLS_SUGGEST_METHODS],
    );
  } catch (error) {
    return handleAgentRouteError(request, error, [...TOOLS_SUGGEST_METHODS]);
  }
}
