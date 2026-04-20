import { getAdminContext } from "@/lib/auth/admin";
import { handleRouteError, jsonData, jsonError } from "@/lib/http";
import { listToolInstructionHistory } from "@/lib/services/tool-instructions";
import { assertValidUuid } from "@/lib/validation";

export async function GET(
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
    assertValidUuid(toolId, "Tool ID");
    const history = await listToolInstructionHistory(
      adminContext.organization.id,
      toolId,
    );

    return jsonData(history);
  } catch (error) {
    return handleRouteError(error);
  }
}
