import { getAdminContext } from "@/lib/auth/admin";
import {
  handleRouteError,
  IMPORT_BODY_LIMIT,
  jsonData,
  jsonError,
  readTextBody,
} from "@/lib/http";
import {
  applyToolCatalogImport,
  previewToolCatalogImport,
} from "@/lib/services/admin";

export async function PUT(request: Request) {
  try {
    const context = await getAdminContext();

    if (context.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (context.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "1";
    const body = await readTextBody(request, IMPORT_BODY_LIMIT);
    const contentType = request.headers.get("content-type");
    const result = dryRun
      ? await previewToolCatalogImport(context.organization.id, {
          body,
          contentType,
        })
      : await applyToolCatalogImport(
          context.organization.id,
          {
            body,
            contentType,
          },
          {
            actorId: context.userId,
            actorEmail: context.userEmail,
          },
        );

    return jsonData(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
