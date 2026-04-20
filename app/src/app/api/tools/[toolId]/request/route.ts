import { TOOLS_REQUEST_SCHEMA } from "@/lib/api-schemas";
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
import { requestAccess } from "@/lib/services/agent";
import { requestAccessSchema, assertValidUuid } from "@/lib/validation";

const TOOL_REQUEST_METHODS = ["GET", "POST"] as const;

export async function OPTIONS(request: Request) {
  return agentCorsPreflight(request, [...TOOL_REQUEST_METHODS]);
}

export async function GET(request: Request) {
  return withAgentCors(
    request,
    jsonSuccess({ schema: TOOLS_REQUEST_SCHEMA }),
    [...TOOL_REQUEST_METHODS],
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
      requestAccessSchema,
      AGENT_JSON_BODY_LIMIT,
      "Shorten your reason field.",
    );
    const result = await requestAccess(
      agentContext.organizationId,
      agentContext.agentId,
      toolId,
      parsed.reason,
      agentContext.agentName,
      getAppOrigin(),
    );

    return withAgentCors(
      request,
      jsonSuccess(
        {
          request_id: result.requestId,
          status: "pending",
          message:
            "Your request has been submitted. A human admin will review it.",
        },
        201,
        rlHeaders,
      ),
      [...TOOL_REQUEST_METHODS],
    );
  } catch (error) {
    return handleAgentRouteError(request, error, [...TOOL_REQUEST_METHODS]);
  }
}
