import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/api/admin(.*)",
]);

const isApiRoute = createRouteMatcher(["/api/(.*)"]);

const isDev = process.env.NODE_ENV !== "production";

const baseScriptSources = [
  "'self'",
  "https://clerk.agentkey.dev",
  "https://accounts.clerk.dev",
  "https://*.clerk.accounts.dev",
  "https://challenges.cloudflare.com",
  "https://maps.googleapis.com",
  "https://js.stripe.com",
  "https://*.js.stripe.com",
];

// Cryptographically random per-request nonce. Modern browsers enforcing
// 'strict-dynamic' treat only scripts carrying this nonce (and scripts they
// load) as trusted. 'unsafe-inline' stays in the policy as a legacy-browser
// fallback — per CSP3, browsers that understand 'strict-dynamic' ignore
// 'unsafe-inline' automatically, so this does not weaken the modern policy.
function buildCspHeader(nonce: string) {
  const scriptSrc = [
    ...baseScriptSources,
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "'unsafe-inline'",
    isDev ? "'unsafe-eval'" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://clerk.agentkey.dev https://*.clerk.dev https://*.clerk.accounts.dev https://img.clerk.com https://*.brandfetch.io https://cdn.brandfetch.io",
    "font-src 'self' data:",
    "connect-src 'self' https://clerk.agentkey.dev https://*.clerk.dev https://*.clerk.accounts.dev https://clerk-telemetry.com https://*.clerk-telemetry.com https://api.stripe.com https://maps.googleapis.com https://api.brandfetch.io",
    "frame-src 'self' https://clerk.agentkey.dev https://*.clerk.dev https://*.clerk.accounts.dev https://challenges.cloudflare.com https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://www.loom.com",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Skip CSP rewriting for API routes — they don't execute scripts, and
  // adding per-request headers costs latency on hot credential paths.
  if (isApiRoute(req)) {
    return;
  }

  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = Buffer.from(nonceBytes).toString("base64");
  const csp = buildCspHeader(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("content-security-policy", csp);
  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|mjs|png|jpg|jpeg|gif|svg|ico|ttf|woff2?|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
