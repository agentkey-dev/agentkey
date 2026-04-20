import { getAdminContext } from "@/lib/auth/admin";
import {
  ADMIN_JSON_BODY_LIMIT,
  handleRouteError,
  jsonData,
  jsonError,
  readJsonBody,
} from "@/lib/http";
import { updateToolSchema } from "@/lib/validation";
import { deleteTool, updateTool } from "@/lib/services/admin";

export async function PUT(
  request: Request,
  context: { params: Promise<{ toolId: string }> },
) {
  try {
    const adminContext = await getAdminContext();

    if (adminContext.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (adminContext.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const { toolId } = await context.params;
    const parsed = await readJsonBody(
      request,
      updateToolSchema,
      ADMIN_JSON_BODY_LIMIT,
    );
    const updated = await updateTool(
      adminContext.organization.id,
      toolId,
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
  context: { params: Promise<{ toolId: string }> },
) {
  try {
    const adminContext = await getAdminContext();

    if (adminContext.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (adminContext.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const { toolId } = await context.params;
    const deleted = await deleteTool(
      adminContext.organization.id,
      toolId,
      {
        actorId: adminContext.userId,
        actorEmail: adminContext.userEmail,
      },
    );

    return jsonData({
      ok: true,
      tool_id: deleted.toolId,
      approved_revocations: deleted.approvedCount,
      pending_revocations: deleted.pendingCount,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
