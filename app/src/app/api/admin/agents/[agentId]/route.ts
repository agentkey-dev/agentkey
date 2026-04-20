import { getAdminContext } from "@/lib/auth/admin";
import {
  ADMIN_JSON_BODY_LIMIT,
  handleRouteError,
  jsonData,
  jsonError,
  readJsonBody,
} from "@/lib/http";
import { updateAgentSchema } from "@/lib/validation";
import { suspendAgent, updateAgent } from "@/lib/services/admin";

export async function PUT(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  try {
    const adminContext = await getAdminContext();

    if (adminContext.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (adminContext.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const { agentId } = await context.params;
    const parsed = await readJsonBody(
      request,
      updateAgentSchema,
      ADMIN_JSON_BODY_LIMIT,
    );
    const updated = await updateAgent(
      adminContext.organization.id,
      agentId,
      parsed,
      {
        actorId: adminContext.userId,
        actorEmail: adminContext.userEmail,
      },
    );

    return jsonData(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  try {
    const adminContext = await getAdminContext();

    if (adminContext.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (adminContext.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const { agentId } = await context.params;
    await suspendAgent(
      adminContext.organization.id,
      agentId,
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
