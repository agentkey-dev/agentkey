import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getCurrentSession,
  selectOrganizationForSession,
} from "@/lib/auth/session";
import { AppError, handleRouteError } from "@/lib/http";

const selectOrganizationSchema = z.object({
  organizationId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      throw new AppError("Authentication required.", 401);
    }

    const formData = await request.formData();
    const input = selectOrganizationSchema.parse({
      organizationId: formData.get("organizationId"),
    });
    await selectOrganizationForSession({
      sessionId: session.session.id,
      userId: session.user.id,
      organizationId: input.organizationId,
    });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    return handleRouteError(error);
  }
}
