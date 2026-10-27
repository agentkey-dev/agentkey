import { requireAgentRequestContext } from "@/lib/auth/agent";
import {
  agentCorsPreflight,
  assertAllowedAgentOrigin,
  handleAgentRouteError,
  getRequestMetadata,
  jsonSuccess,
  withAgentCors,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { getCredentialForAgent } from "@/lib/services/agent";
import { formatVendedCredentialValue } from "@/lib/totp";
import { assertValidUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

const TOOL_CREDENTIALS_METHODS = ["GET"] as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
} as const;

export async function OPTIONS(request: Request) {
  return agentCorsPreflight(request, [...TOOL_CREDENTIALS_METHODS]);
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
    const credential = await getCredentialForAgent(
      agentContext.organizationId,
      agentContext.agentId,
      toolId,
      agentContext.agentName,
      getRequestMetadata(request),
    );

    const credentialValue = formatVendedCredentialValue(
      credential.authType,
      credential.credential,
    );

    return withAgentCors(
      request,
      jsonSuccess(
        {
          tool_id: credential.toolId,
          tool_name: credential.toolName,
          auth_type: credential.authType,
          credential: credentialValue,
          ...(credential.otp
            ? {
                otp: credential.otp,
                otp_endpoint: `/api/tools/${credential.toolId}/otp`,
              }
            : {}),
          instructions: credential.instructions,
          suggest_instructions_endpoint: `/api/tools/${credential.toolId}/instructions/suggest`,
        },
        200,
        rlHeaders,
      ),
      [...TOOL_CREDENTIALS_METHODS],
    );
  } catch (error) {
    return handleAgentRouteError(
      request,
      error,
      [...TOOL_CREDENTIALS_METHODS],
    );
  }
}
