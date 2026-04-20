import { getAdminContext } from "@/lib/auth/admin";
import {
  ADMIN_JSON_BODY_LIMIT,
  handleRouteError,
  jsonData,
  jsonError,
  readJsonBody,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { assignToolToAgent } from "@/lib/services/admin";
import {
  assertValidUuid,
  assignToolToAgentSchema,
} from "@/lib/validation";

export async function POST(
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

    await enforceRateLimit(adminContext.userId, "admin");

    const { agentId } = await context.params;
    assertValidUuid(agentId, "Agent ID");
    const parsed = await readJsonBody(
      request,
      assignToolToAgentSchema,
      ADMIN_JSON_BODY_LIMIT,
    );
    const grant = await assignToolToAgent(
      adminContext.organization.id,
      agentId,
      parsed,
      {
        actorId: adminContext.userId,
        actorEmail: adminContext.userEmail,
      },
    );

    return jsonData(grant, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
