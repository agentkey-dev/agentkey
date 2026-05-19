import { NextResponse } from "next/server";

import {
  consumeLoginToken,
  createSession,
  findOrCreateUser,
  getFirstOrganizationForUser,
} from "@/lib/auth/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/sign-in?error=missing-token", url));
  }

  const loginToken = await consumeLoginToken(token);

  if (!loginToken) {
    return NextResponse.redirect(new URL("/sign-in?error=expired", url));
  }

  const user = await findOrCreateUser(loginToken.email);
  const organization = await getFirstOrganizationForUser(user.id);

  await createSession({
    userId: user.id,
    selectedOrganizationId: organization?.id ?? null,
  });

  return NextResponse.redirect(
    new URL(organization ? "/dashboard" : "/onboarding", url),
  );
}
