import { getAdminContext } from "@/lib/auth/admin";
import {
  assertSameOriginMutation,
  handleRouteError,
  jsonData,
  jsonError,
} from "@/lib/http";
import { dismissToolSuggestion } from "@/lib/services/tool-suggestions";
import { assertValidUuid } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ suggestionId: string }> },
) {
  try {
    assertSameOriginMutation(request);
    const adminContext = await getAdminContext();

    if (adminContext.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (adminContext.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const { suggestionId } = await context.params;
    assertValidUuid(suggestionId, "Suggestion ID");
    const suggestion = await dismissToolSuggestion(
      adminContext.organization.id,
      suggestionId,
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
