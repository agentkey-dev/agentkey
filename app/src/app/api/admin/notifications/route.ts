import { getAdminContext } from "@/lib/auth/admin";
import {
  ADMIN_JSON_BODY_LIMIT,
  handleRouteError,
  jsonData,
  jsonError,
  readJsonBody,
} from "@/lib/http";
import {
  getNotificationSettings,
  upsertNotificationSettings,
} from "@/lib/services/notifications";
import { notificationSettingsSchema } from "@/lib/validation";

export async function GET() {
  try {
    const context = await getAdminContext();

    if (context.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (context.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const settings = await getNotificationSettings(context.organization.id);

    return jsonData(settings);
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

    const parsed = await readJsonBody(
      request,
      notificationSettingsSchema,
      ADMIN_JSON_BODY_LIMIT,
    );
    const settings = await upsertNotificationSettings(
      context.organization.id,
      parsed,
      {
        actorId: context.userId,
        actorEmail: context.userEmail,
      },
    );

    return jsonData(settings);
  } catch (error) {
    return handleRouteError(error);
  }
}
