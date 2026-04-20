import { requireAgentRequestContext } from "@/lib/auth/agent";
import {
  agentCorsPreflight,
  handleAgentRouteError,
  jsonSuccess,
  withAgentCors,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { listToolsForAgent } from "@/lib/services/agent";

const TOOLS_ROUTE_METHODS = ["GET"] as const;

export async function OPTIONS(request: Request) {
  return agentCorsPreflight(request, [...TOOLS_ROUTE_METHODS]);
}

export async function GET(request: Request) {
  try {
    const context = await requireAgentRequestContext(request);
    const rlHeaders = await enforceRateLimit(context.agentId, "read");
    const tools = await listToolsForAgent(
      context.organizationId,
      context.agentId,
    );

    return withAgentCors(
      request,
      jsonSuccess({ tools }, 200, rlHeaders),
      [...TOOLS_ROUTE_METHODS],
    );
  } catch (error) {
    return handleAgentRouteError(request, error, [...TOOLS_ROUTE_METHODS]);
  }
}
