import { getAdminContext } from "@/lib/auth/admin";
import {
  assertSameOriginMutation,
  handleRouteError,
  jsonData,
  jsonError,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { revokeAgentToolAccess } from "@/lib/services/admin";
import { assertValidUuid } from "@/lib/validation";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ agentId: string; toolId: string }> },
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

    const { agentId, toolId } = await context.params;
    assertValidUuid(agentId, "Agent ID");
    assertValidUuid(toolId, "Tool ID");
    await revokeAgentToolAccess(
      adminContext.organization.id,
      agentId,
      toolId,
      {
        actorId: adminContext.userId,
        actorEmail: adminContext.userEmail,
      },
    );

    return jsonData({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
