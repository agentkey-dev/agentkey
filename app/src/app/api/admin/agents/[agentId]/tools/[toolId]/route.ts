import { getAdminContext } from "@/lib/auth/admin";
import { handleRouteError, jsonData, jsonError } from "@/lib/http";
import { revokeAgentToolAccess } from "@/lib/services/admin";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ agentId: string; toolId: string }> },
) {
  try {
    const adminContext = await getAdminContext();

    if (adminContext.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (adminContext.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const { agentId, toolId } = await context.params;
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
