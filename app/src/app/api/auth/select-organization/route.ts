import { NextResponse } from "next/server";
import { z } from "zod";
import { readAuthFormData } from "@/lib/auth/form";

import {
  getCurrentSession,
  selectOrganizationForSession,
} from "@/lib/auth/session";
import { AppError, assertSameOriginMutation, handleRouteError } from "@/lib/http";
import { getAppOrigin } from "@/lib/origin";

const selectOrganizationSchema = z.object({
  organizationId: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const session = await getCurrentSession();

    if (!session) {
      throw new AppError("Authentication required.", 401);
    }

    const formData = await readAuthFormData(request);
    const input = selectOrganizationSchema.parse({
      organizationId: formData.get("organizationId"),
    });
    await selectOrganizationForSession({
      sessionId: session.session.id,
      userId: session.user.id,
      organizationId: input.organizationId,
    });

    return NextResponse.redirect(new URL("/dashboard", getAppOrigin()), { status: 303 });
  } catch (error) {
    return handleRouteError(error);
  }
}
