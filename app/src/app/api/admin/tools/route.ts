import { getAdminContext } from "@/lib/auth/admin";
import {
  ADMIN_JSON_BODY_LIMIT,
  handleRouteError,
  jsonData,
  jsonError,
  readJsonBody,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { createToolSchema } from "@/lib/validation";
import { createTool, listTools } from "@/lib/services/admin";

export async function GET() {
  try {
    const context = await getAdminContext();

    if (context.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (context.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const tools = await listTools(context.organization.id);

    return jsonData(tools);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getAdminContext();

    if (context.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (context.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    await enforceRateLimit(context.userId, "admin");

    const parsed = await readJsonBody(
      request,
      createToolSchema,
      ADMIN_JSON_BODY_LIMIT,
    );
    const created = await createTool(
      context.organization.id,
      parsed,
      {
        actorId: context.userId,
        actorEmail: context.userEmail,
      },
    );

    return jsonData(created, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
