import { getAdminContext } from "@/lib/auth/admin";
import { handleRouteError, jsonData, jsonError } from "@/lib/http";
import { getRecentAgentActivity } from "@/lib/services/admin";

export async function GET(
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

    const url = new URL(request.url);
    const parsedLimit = Number(url.searchParams.get("limit") ?? "5");
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 20)
      : 5;
    const { agentId } = await context.params;
    const activity = await getRecentAgentActivity(
      adminContext.organization.id,
      agentId,
      limit,
    );

    return jsonData(activity);
  } catch (error) {
    return handleRouteError(error);
  }
}
