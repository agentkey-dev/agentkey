import { NextResponse } from "next/server";

import { revokeCurrentSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  await revokeCurrentSession();

  return NextResponse.redirect(new URL("/", request.url));
}
