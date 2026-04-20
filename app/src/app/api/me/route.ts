import { requireAgentRequestContext } from "@/lib/auth/agent";
import {
  agentCorsPreflight,
  handleAgentRouteError,
  jsonSuccess,
  withAgentCors,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { listToolsForAgent } from "@/lib/services/agent";

const AGENT_ME_METHODS = ["GET"] as const;

export async function OPTIONS(request: Request) {
  return agentCorsPreflight(request, [...AGENT_ME_METHODS]);
}

export async function GET(request: Request) {
  try {
    const context = await requireAgentRequestContext(request);
    const rlHeaders = await enforceRateLimit(context.agentId, "read");
    const tools = await listToolsForAgent(
      context.organizationId,
      context.agentId,
    );

    const approved = tools.filter((t) => t.your_access === "approved");
    const pending = tools.filter((t) => t.your_access === "pending");
    const denied = tools.filter((t) => t.your_access === "denied");

    return withAgentCors(
      request,
      jsonSuccess(
        {
          agent_id: context.agentId,
          agent_name: context.agentName,
          description: context.agentDescription ?? null,
          created_at: context.createdAt,
          tools_approved: approved.map((t) => t.name),
          tools_pending: pending.map((t) => t.name),
          tools_denied: denied.map((t) => ({
            name: t.name,
            reason: t.denial_reason ?? null,
          })),
          tools_available: tools.length,
          hint:
            approved.length === 0 && pending.length === 0
              ? "You have no tool access yet. Call GET /api/tools to browse the catalog. If the tool exists, use POST /api/tools/{id}/request. If it does not exist, use POST /api/tools/suggest."
              : undefined,
        },
        200,
        rlHeaders,
      ),
      [...AGENT_ME_METHODS],
    );
  } catch (error) {
    return handleAgentRouteError(request, error, [...AGENT_ME_METHODS]);
  }
}
