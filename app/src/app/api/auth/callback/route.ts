import { NextResponse } from "next/server";

import {
  consumeLoginToken,
  createSession,
  findLoginToken,
  findOrCreateUser,
  getFirstOrganizationForUser,
  loginTokenHasRequiredVerification,
} from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/http";
import { getAppOrigin } from "@/lib/origin";

/**
 * Sign-in completion is a two-step flow, deliberately.
 *
 * SECURITY: this used to be a single GET that created a session for whoever
 * loaded the URL. That is login CSRF / session fixation — an attacker requests
 * a magic link for THEIR OWN account and sends that URL to a victim. The
 * victim's browser silently becomes authenticated as the attacker, and any
 * credential the victim then adds lands in the attacker's organization.
 * Nothing in the flow told the victim their session had changed.
 *
 * The GET now only *offers* to sign in: it validates the token without
 * consuming it and renders a confirmation naming the account. The session is
 * created solely by the POST, which requires a same-origin submission — so an
 * attacker can neither complete it from their own page nor cause the victim's
 * browser to complete it without a deliberate click on a screen that shows
 * whose account it is.
 *
 * Binding the token to the requesting browser would also stop this, but would
 * break cross-device sign-in (request on a laptop, open on a phone), which is
 * a normal way people use magic links.
 */

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function signInRedirect(error: string) {
  return NextResponse.redirect(
    new URL(`/sign-in?error=${error}`, getAppOrigin()),
  );
}

function renderConfirmation(token: string, email: string) {
  const safeToken = escapeHtml(token);
  const safeEmail = escapeHtml(email);

  return new NextResponse(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Confirm sign in — AgentKey</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#19191d; color:#e6e4ec;
         font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { width:100%; max-width:26rem; padding:2rem; }
  h1 { font-size:1.5rem; letter-spacing:-0.02em; margin:0 0 0.75rem; }
  p { color:#abaab1; line-height:1.6; margin:0 0 1.5rem; font-size:0.925rem; }
  .email { color:#e6e4ec; font-weight:600; overflow-wrap:anywhere; }
  button { width:100%; padding:0.7rem 1rem; border:0; border-radius:0.125rem;
           background:#3B82F6; color:#fff; font-size:0.925rem; font-weight:600; cursor:pointer; }
  button:hover { background:#2f74e0; }
  .note { margin:1.25rem 0 0; font-size:0.8rem; }
</style>
</head>
<body>
<main>
  <h1>Confirm sign in</h1>
  <p>You are about to sign in to AgentKey as <span class="email">${safeEmail}</span>.</p>
  <form method="POST" action="/api/auth/callback">
    <input type="hidden" name="token" value="${safeToken}">
    <button type="submit">Sign in as ${safeEmail}</button>
  </form>
  <p class="note">If you did not request this link, or this is not your account, close this page. No session is created until you confirm.</p>
</main>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // The URL carries a live login token — keep it out of caches and
        // shared proxies, and send no Referer onward.
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return signInRedirect("missing-token");
  }

  // Peek only — never consume on a GET. A link prefetched by an email security
  // scanner must not burn the user's one-time token.
  const loginToken = await findLoginToken(token);

  if (!loginToken) {
    return signInRedirect("expired");
  }

  if (!loginTokenHasRequiredVerification(loginToken)) {
    return signInRedirect("verification");
  }

  return renderConfirmation(token, loginToken.email);
}

export async function POST(request: Request) {
  // Reject anything not submitted from our own confirmation page.
  if (!isSameOriginRequest(request, getAppOrigin())) {
    return signInRedirect("invalid-origin");
  }

  const formData = await request.formData();
  const token = formData.get("token");

  if (typeof token !== "string" || !token) {
    return signInRedirect("missing-token");
  }

  const loginToken = await consumeLoginToken(token);

  if (!loginToken) {
    return signInRedirect("expired");
  }

  if (!loginTokenHasRequiredVerification(loginToken)) {
    return signInRedirect("verification");
  }

  const user = await findOrCreateUser(loginToken.email);
  const organization = await getFirstOrganizationForUser(user.id);

  await createSession({
    userId: user.id,
    selectedOrganizationId: organization?.id ?? null,
  });

  // 303 so the browser follows with GET after the POST.
  return NextResponse.redirect(
    new URL(organization ? "/dashboard" : "/onboarding", getAppOrigin()),
    { status: 303 },
  );
}
