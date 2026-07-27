import { NextResponse } from "next/server";

import { revokeCurrentSession } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/http";
import { getAppOrigin } from "@/lib/origin";

export async function POST(request: Request) {
  // Same-origin gate. Sign-out clears the cookie unconditionally, so without
  // this any site could log the user out on demand — low severity on its own,
  // but a free nuisance primitive and trivial to close.
  if (isSameOriginRequest(request, getAppOrigin())) {
    await revokeCurrentSession();
  }

  // Redirect target comes from APP_URL, never request.url — see
  // lib/origin.ts and the note in api/auth/magic-link/route.ts.
  return NextResponse.redirect(new URL("/", getAppOrigin()), { status: 303 });
}
