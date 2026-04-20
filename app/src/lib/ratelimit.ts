import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { AppError } from "@/lib/http";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Agent request endpoints: 10 requests per hour per agent
const requestLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  prefix: "rl:request",
});

// Credential fetches: 60 per minute per agent
const credentialLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "rl:credential",
});

// General reads (GET /tools, GET /me): 120 per minute per agent
const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, "1 m"),
  prefix: "rl:read",
});

// Admin mutation endpoints: 30 per minute per user
const adminLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "rl:admin",
});

// Pre-auth ceiling keyed on client IP: 600 per minute. Protects the auth path
// against log-flood and DB pressure from unauthenticated traffic without
// starving legitimate multi-agent deployments behind a shared NAT.
const preauthLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(600, "1 m"),
  prefix: "rl:preauth",
});

type RateLimitTier = "request" | "credential" | "read" | "admin" | "preauth";

const limiters: Record<RateLimitTier, Ratelimit> = {
  request: requestLimiter,
  credential: credentialLimiter,
  read: readLimiter,
  admin: adminLimiter,
  preauth: preauthLimiter,
};

export async function enforceRateLimit(agentId: string, tier: RateLimitTier) {
  const limiter = limiters[tier];
  const { success, limit, remaining, reset } = await limiter.limit(agentId);

  const headers = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(reset),
  };

  if (!success) {
    throw new RateLimitError(
      "Rate limit exceeded. Slow down and retry later.",
      headers,
    );
  }

  return headers;
}

export class RateLimitError extends AppError {
  headers: Record<string, string>;

  constructor(message: string, headers: Record<string, string>) {
    super(message, 429, "You are making requests too quickly. Wait and retry.");
    this.headers = headers;
  }
}
