import { NextResponse } from "next/server";

import { TOOLS_INSTRUCTION_SUGGEST_SCHEMA } from "@/lib/api-schemas";
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
import { suggestToolInstruction } from "@/lib/services/agent";
import { assertValidUuid, suggestToolInstructionSchema } from "@/lib/validation";

const TOOL_INSTRUCTION_SUGGEST_METHODS = ["GET", "POST"] as const;

export async function OPTIONS(request: Request) {
  return agentCorsPreflight(request, [...TOOL_INSTRUCTION_SUGGEST_METHODS]);
}

export async function GET(request: Request) {
  return withAgentCors(
    request,
    jsonSuccess({ schema: TOOLS_INSTRUCTION_SUGGEST_SCHEMA }),
    [...TOOL_INSTRUCTION_SUGGEST_METHODS],
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ toolId: string }> },
) {
  try {
    const { toolId } = await context.params;
    assertValidUuid(toolId, "Tool ID");
    const agentContext = await requireAgentRequestContext(request);
    const rlHeaders = await enforceRateLimit(agentContext.agentId, "request");
    const parsed = await readJsonBody(
      request,
      suggestToolInstructionSchema,
      AGENT_JSON_BODY_LIMIT,
      "Reduce the overall JSON body size.",
    );
    const result = await suggestToolInstruction(
      agentContext.organizationId,
      agentContext.agentId,
      toolId,
      parsed,
      agentContext.agentName,
      getAppOrigin(),
    );

    if (result.outcome === "dismissed") {
      return withAgentCors(
        request,
        NextResponse.json(
          {
            error:
              "This instruction suggestion was dismissed for the current guide version.",
            suggestion_id: result.suggestionId,
            dismissal_reason: result.dismissalReason,
            message:
              "The admin dismissed this suggestion for the current guide version. Submit it again only after the guide changes.",
          },
          { status: 409, headers: rlHeaders },
        ),
        [...TOOL_INSTRUCTION_SUGGEST_METHODS],
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
            ? "Your support has been added to an existing pending instruction suggestion."
            : "Your instruction suggestion has been submitted. A human admin will review it.",
        },
        201,
        rlHeaders,
      ),
      [...TOOL_INSTRUCTION_SUGGEST_METHODS],
    );
  } catch (error) {
    return handleAgentRouteError(request, error, [
      ...TOOL_INSTRUCTION_SUGGEST_METHODS,
    ]);
  }
}
