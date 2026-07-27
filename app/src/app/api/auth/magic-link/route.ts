import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createLoginToken,
  normalizeEmail,
  sendMagicLinkEmail,
} from "@/lib/auth/session";
import {
  enforceMagicLinkEmailRateLimit,
  enforceMagicLinkIpRateLimit,
} from "@/lib/auth/magic-link";
import { verifyTurnstileForAuth } from "@/lib/auth/turnstile";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { getAppOrigin } from "@/lib/origin";

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

    // Ordering matters: IP ceiling first (cheap, bounds outbound siteverify
    // calls), then the challenge, then the per-mailbox ceiling. Incrementing
    // the mailbox counter before the challenge let anyone lock a known address
    // out of sign-in for 15 minutes with five unauthenticated requests.
    await enforceMagicLinkIpRateLimit(request, email);

    const turnstilePassed = await verifyTurnstileForAuth({
      token: parsed.turnstileToken,
      request,
    });

    await enforceMagicLinkEmailRateLimit(request, email);
    const token = await createLoginToken(email, turnstilePassed);

    // SECURITY: the origin of an emailed sign-in link must never be derived
    // from the request. On this stack `new URL(request.url).origin` is
    // attacker-controlled: @opennextjs/aws promotes X-Forwarded-Host onto
    // `host` (core/requestHandler.js), the adapter sets
    // experimental.trustHostHeader (core/util.js), and for Next > 13.4.13 the
    // requestHandlerHost override is stripped from the bundle — so Next builds
    // initURL as `https://${req.headers.host}${req.url}`. Cloudflare rejects a
    // forged `Host` for a custom_domain route, but forwards X-Forwarded-Host
    // untouched. An attacker could therefore request a link for a victim's
    // address and have the victim's email point at a host they control,
    // handing over a live 15-minute login token.
    //
    // getAppOrigin() reads APP_URL (set in wrangler.jsonc) and throws in
    // production if absent.
    const appOrigin = getAppOrigin();

    await sendMagicLinkEmail({
      email,
      token,
      origin: appOrigin,
    });

    if (isForm) {
      return NextResponse.redirect(
        new URL(`/sign-in?sent=1&email=${encodeURIComponent(email)}`, appOrigin),
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
