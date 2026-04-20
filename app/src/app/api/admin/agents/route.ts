import { getAdminContext } from "@/lib/auth/admin";
import {
  ADMIN_JSON_BODY_LIMIT,
  handleRouteError,
  jsonData,
  jsonError,
  readJsonBody,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { createAgentSchema } from "@/lib/validation";
import { createAgent, listAgents } from "@/lib/services/admin";

export async function GET() {
  try {
    const context = await getAdminContext();

    if (context.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (context.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const agents = await listAgents(context.organization.id);

    return jsonData(agents);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getAdminContext();

    if (context.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (context.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    await enforceRateLimit(context.userId, "admin");

    const parsed = await readJsonBody(
      request,
      createAgentSchema,
      ADMIN_JSON_BODY_LIMIT,
    );
    const result = await createAgent(
      context.organization.id,
      parsed,
      {
        actorId: context.userId,
        actorEmail: context.userEmail,
      },
    );

    return jsonData(
      {
        agent_id: result.agentId,
        api_key: result.apiKey,
        instructions: result.instructions,
        agent: result.agent,
      },
      201,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
