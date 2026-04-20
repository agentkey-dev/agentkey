import { getAdminContext } from "@/lib/auth/admin";
import { handleRouteError, jsonData, jsonError } from "@/lib/http";
import { listAuditEvents } from "@/lib/services/admin";
import { auditFiltersSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const context = await getAdminContext();

    if (context.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (context.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const url = new URL(request.url);
    const parsed = auditFiltersSchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const events = await listAuditEvents(context.organization.id, {
      action: parsed.action,
      agentId: parsed.agent_id,
      toolId: parsed.tool_id,
      from: parsed.from,
      to: parsed.to,
    });

    return jsonData(events);
  } catch (error) {
    return handleRouteError(error);
  }
}
