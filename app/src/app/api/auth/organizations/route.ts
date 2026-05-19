import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { normalizeOrganizationIdentity } from "@/lib/core/organizations";
import { runDbMutation } from "@/lib/db/client";
import {
  authSessions,
  organizationMemberships,
  organizations,
} from "@/lib/db/schema";
import { AppError, handleRouteError } from "@/lib/http";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      throw new AppError("Authentication required.", 401);
    }

    const formData = await request.formData();
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
        .where(eq(authSessions.id, session.session.id));

      return created;
    });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    return handleRouteError(error);
  }
}
