import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createLoginToken,
  normalizeEmail,
  sendMagicLinkEmail,
} from "@/lib/auth/session";
import { enforceMagicLinkRateLimits } from "@/lib/auth/magic-link";
import { verifyTurnstileForAuth } from "@/lib/auth/turnstile";
import { handleRouteError, readJsonBody } from "@/lib/http";

const magicLinkSchema = z.object({
  email: z.string().email(),
  turnstileToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isForm = contentType.includes("application/x-www-form-urlencoded");
    let body: {
      email?: FormDataEntryValue | string;
      turnstileToken?: FormDataEntryValue | string;
      turnstileFormToken?: FormDataEntryValue;
    };

    if (isForm) {
      const formData = await request.formData();
      body = {
        email: formData.get("email") ?? undefined,
        turnstileToken: formData.get("turnstileToken") ?? undefined,
        turnstileFormToken: formData.get("cf-turnstile-response") ?? undefined,
      };
    } else {
      body = await readJsonBody(request, magicLinkSchema, 8192);
    }

    const parsed = magicLinkSchema.parse({
      email: body.email,
      turnstileToken: body.turnstileToken ?? body.turnstileFormToken,
    });
    const email = normalizeEmail(parsed.email);

    await enforceMagicLinkRateLimits(request, email);

    const turnstilePassed = await verifyTurnstileForAuth({
      token: parsed.turnstileToken,
      request,
    });
    const token = await createLoginToken(email, turnstilePassed);

    await sendMagicLinkEmail({
      email,
      token,
      origin: new URL(request.url).origin,
    });

    if (isForm) {
      return NextResponse.redirect(
        new URL(`/sign-in?sent=1&email=${encodeURIComponent(email)}`, request.url),
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
