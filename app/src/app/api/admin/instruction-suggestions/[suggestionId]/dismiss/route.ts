import { getAdminContext } from "@/lib/auth/admin";
import {
  ADMIN_JSON_BODY_LIMIT,
  handleRouteError,
  jsonData,
  jsonError,
  readJsonBody,
} from "@/lib/http";
import { dismissToolInstructionSuggestion } from "@/lib/services/tool-instructions";
import { dismissInstructionSuggestionSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ suggestionId: string }> },
) {
  try {
    const adminContext = await getAdminContext();

    if (adminContext.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (adminContext.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const { suggestionId } = await context.params;
    const parsed = await readJsonBody(
      request,
      dismissInstructionSuggestionSchema,
      ADMIN_JSON_BODY_LIMIT,
    );
    const suggestion = await dismissToolInstructionSuggestion(
      adminContext.organization.id,
      suggestionId,
      parsed.reason,
      {
        actorId: adminContext.userId,
        actorEmail: adminContext.userEmail,
      },
    );

    return jsonData(suggestion);
  } catch (error) {
    return handleRouteError(error);
  }
}
