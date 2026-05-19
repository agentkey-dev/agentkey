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

export async function enforceMagicLinkRateLimits(
  request: Pick<Request, "headers">,
  email: string,
) {
  const subjects = getMagicLinkRateLimitSubjects(request, email);

  await enforceRateLimit(subjects.ip, "magicLinkIp");
  await enforceRateLimit(subjects.email, "magicLinkEmail");
}
