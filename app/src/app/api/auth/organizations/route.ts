import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { readAuthFormData } from "@/lib/auth/form";
import { normalizeOrganizationIdentity } from "@/lib/core/organizations";
import { runDbMutation } from "@/lib/db/client";
import {
  authSessions,
  organizationMemberships,
  organizations,
} from "@/lib/db/schema";
import { AppError, assertSameOriginMutation, handleRouteError } from "@/lib/http";
import { getAppOrigin } from "@/lib/origin";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    const session = await getCurrentSession();

    if (!session) {
      throw new AppError("Authentication required.", 401);
    }

    const formData = await readAuthFormData(request);
    const input = organizationSchema.parse({
      name: formData.get("name"),
    });
    const normalized = normalizeOrganizationIdentity({
      name: input.name,
    });

    await runDbMutation(async (tx) => {
      const [created] = await tx.insert(organizations).values(normalized).returning();

      await tx.insert(organizationMemberships).values({
        organizationId: created.id,
        userId: session.user.id,
      });

      await tx
        .update(authSessions)
        .set({
          selectedOrganizationId: created.id,
          updatedAt: new Date(),
        })
        .where(and(
          eq(authSessions.id, session.session.id),
          eq(authSessions.userId, session.user.id),
        ));

      return created;
    });

    return NextResponse.redirect(new URL("/dashboard", getAppOrigin()), { status: 303 });
  } catch (error) {
    return handleRouteError(error);
  }
}
