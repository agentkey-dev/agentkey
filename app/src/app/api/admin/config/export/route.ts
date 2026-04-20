import { NextResponse } from "next/server";

import { getAdminContext } from "@/lib/auth/admin";
import { exportToolCatalog } from "@/lib/services/admin";
import { AppError, handleRouteError, jsonError } from "@/lib/http";
import type { ToolCatalogFormat } from "@/lib/core/tool-config";

function getRequestedFormat(request: Request): ToolCatalogFormat {
  const format = new URL(request.url).searchParams.get("format") ?? "yaml";

  if (format !== "yaml" && format !== "json") {
    throw new AppError(
      "Unsupported export format.",
      400,
      "Use ?format=yaml or ?format=json.",
    );
  }

  return format;
}

export async function GET(request: Request) {
  try {
    const context = await getAdminContext();

    if (context.kind === "signed-out") {
      return jsonError("Authentication required.", 401);
    }

    if (context.kind === "missing-org") {
      return jsonError("Select or create an organization first.", 409);
    }

    const format = getRequestedFormat(request);
    const body = await exportToolCatalog(context.organization.id, format);
    const extension = format === "yaml" ? "yaml" : "json";
    const contentType =
      format === "yaml" ? "application/yaml; charset=utf-8" : "application/json; charset=utf-8";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="tool-catalog.${extension}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
