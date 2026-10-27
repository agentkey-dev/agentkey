import { requireAgentRequestContext } from "@/lib/auth/agent";
import {
  agentCorsPreflight,
  assertAllowedAgentOrigin,
  getRequestMetadata,
  handleAgentRouteError,
  jsonSuccess,
  withAgentCors,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { getOtpForAgent } from "@/lib/services/agent";
import { assertValidUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

const TOOL_OTP_METHODS = ["GET"] as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
} as const;

export async function OPTIONS(request: Request) {
  return agentCorsPreflight(request, [...TOOL_OTP_METHODS]);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ toolId: string }> },
) {
  try {
    assertAllowedAgentOrigin(request);
    const { toolId } = await context.params;
    assertValidUuid(toolId, "Tool ID");
    const agentContext = await requireAgentRequestContext(request);
    const rlHeaders = {
      ...(await enforceRateLimit(agentContext.agentId, "credential")),
      ...NO_STORE_HEADERS,
    };
    const result = await getOtpForAgent(
      agentContext.organizationId,
      agentContext.agentId,
      toolId,
      agentContext.agentName,
      getRequestMetadata(request),
    );

    return withAgentCors(
      request,
      jsonSuccess(
        {
          tool_id: result.toolId,
          tool_name: result.toolName,
          otp: result.otp,
        },
        200,
        rlHeaders,
      ),
      [...TOOL_OTP_METHODS],
    );
  } catch (error) {
    return handleAgentRouteError(request, error, [...TOOL_OTP_METHODS]);
  }
}
