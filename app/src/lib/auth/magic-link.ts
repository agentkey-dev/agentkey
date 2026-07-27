import { createHash } from "node:crypto";

import { getClientIp } from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";

function hashRateLimitSubject(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/**
 * Delegates to the shared hardened resolver rather than re-deriving the IP.
 *
 * The previous local implementation fell back to the LEFTMOST X-Forwarded-For
 * entry, which is client-supplied — the exact anti-pattern getClientIp exists
 * to prevent. On Cloudflare cf-connecting-ip is normally present so the
 * fallback rarely fired, but keeping two different notions of "client IP" in
 * one codebase is how the hardened one silently stops being the one that runs.
 */
export function getMagicLinkClientIp(request: Pick<Request, "headers">) {
  return getClientIp(request as Request) || "unknown";
}

export function getMagicLinkRateLimitSubjects(
  request: Pick<Request, "headers">,
  email: string,
) {
  const ip = getMagicLinkClientIp(request);
  const normalizedEmail = email.trim().toLowerCase();

  return {
    ip: `ip:${hashRateLimitSubject(ip)}`,
    email: `email:${hashRateLimitSubject(normalizedEmail)}`,
  };
}

/**
 * Per-IP ceiling. Cheap, and applied before any outbound work so an
 * unauthenticated flood cannot drive Turnstile siteverify calls.
 */
export async function enforceMagicLinkIpRateLimit(
  request: Pick<Request, "headers">,
  email: string,
) {
  const subjects = getMagicLinkRateLimitSubjects(request, email);

  await enforceRateLimit(subjects.ip, "magicLinkIp");
}

/**
 * Per-mailbox ceiling (5 per 15 min).
 *
 * SECURITY: this must run only AFTER Turnstile has passed. Incrementing it
 * first let an unauthenticated attacker burn a known address's quota with five
 * junk requests and lock that user out of signing in for 15 minutes — a
 * targeted denial of service needing no challenge solved. Gating it behind the
 * challenge means an attacker has to solve a Turnstile per attempt.
 */
export async function enforceMagicLinkEmailRateLimit(
  request: Pick<Request, "headers">,
  email: string,
) {
  const subjects = getMagicLinkRateLimitSubjects(request, email);

  await enforceRateLimit(subjects.email, "magicLinkEmail");
}

export async function enforceMagicLinkRateLimits(
  request: Pick<Request, "headers">,
  email: string,
) {
  await enforceMagicLinkIpRateLimit(request, email);
  await enforceMagicLinkEmailRateLimit(request, email);
}
