import { getAdminContext } from "@/lib/auth/admin";
import { toAccessGrantResponse } from "@/lib/core/grants";
import { denyRequest } from "@/lib/services/admin";
import {
  ADMIN_JSON_BODY_LIMIT,
  handleRouteError,
  jsonData,
  jsonError,
  readJsonBody,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { assertValidUuid, denyRequestSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
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

    const { requestId } = await context.params;
    assertValidUuid(requestId, "Request ID");
    const parsed = await readJsonBody(
      request,
      denyRequestSchema,
      ADMIN_JSON_BODY_LIMIT,
    );
    const updated = await denyRequest(
      adminContext.organization.id,
      requestId,
      parsed.reason,
      {
        actorId: adminContext.userId,
        actorEmail: adminContext.userEmail,
      },
    );

    return jsonData(toAccessGrantResponse(updated));
  } catch (error) {
    return handleRouteError(error);
  }
}
