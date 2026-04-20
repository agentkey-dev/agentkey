import { getAdminContext } from "@/lib/auth/admin";
import {
  assertSameOriginMutation,
  handleRouteError,
  jsonData,
  jsonError,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { rotateAgentKey } from "@/lib/services/admin";
import { assertValidUuid } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  try {
    assertSameOriginMutation(request);
    const adminContext = await getAdminContext();

    if (adminContext.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (adminContext.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    await enforceRateLimit(adminContext.userId, "admin");

    const { agentId } = await context.params;
    assertValidUuid(agentId, "Agent ID");
    const result = await rotateAgentKey(
      adminContext.organization.id,
      agentId,
      {
        actorId: adminContext.userId,
        actorEmail: adminContext.userEmail,
      },
    );

    return jsonData({
      agent_id: result.agentId,
      api_key: result.apiKey,
      instructions: result.instructions,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
