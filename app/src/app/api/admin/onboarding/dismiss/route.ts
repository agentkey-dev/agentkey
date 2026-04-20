import { getAdminContext } from "@/lib/auth/admin";
import { handleRouteError, jsonData, jsonError } from "@/lib/http";
import { dismissOrganizationOnboarding } from "@/lib/services/admin";

export async function POST() {
  try {
    const context = await getAdminContext();

    if (context.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (context.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const organization = await dismissOrganizationOnboarding(
      context.organization.id,
    );

    return jsonData(organization);
  } catch (error) {
    return handleRouteError(error);
  }
}
