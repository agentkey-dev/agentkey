import { createHash } from "node:crypto";

import { enforceRateLimit } from "@/lib/ratelimit";

function hashRateLimitSubject(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function getMagicLinkClientIp(request: Pick<Request, "headers">) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
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
