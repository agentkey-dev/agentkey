import { getCloudflareEnv } from "@/lib/db/client";
import { AppError } from "@/lib/http";

export type RateLimitTier =
  | "request"
  | "credential"
  | "read"
  | "admin"
  | "preauth"
  | "magicLinkIp"
  | "magicLinkEmail";

type RateLimitPolicy = { limit: number; windowMs: number; policy: string };
type RateLimitBucketState = {
  count: number;
  windowStart: number;
  windowMs: number;
} | null | undefined;
type RateLimitD1 = Pick<D1Database, "prepare">;
type RateLimitRow = {
  count: number;
  windowStart: number;
  windowMs: number;
};

declare global {
  var __toolProvisioningRateLimitD1: RateLimitD1 | undefined;
}

const policies: Record<RateLimitTier, RateLimitPolicy> = {
  request: { limit: 10, windowMs: 60 * 60 * 1000, policy: "10;w=3600" },
  credential: { limit: 60, windowMs: 60 * 1000, policy: "60;w=60" },
  read: { limit: 120, windowMs: 60 * 1000, policy: "120;w=60" },
  admin: { limit: 30, windowMs: 60 * 1000, policy: "30;w=60" },
  preauth: { limit: 600, windowMs: 60 * 1000, policy: "600;w=60" },
  magicLinkIp: { limit: 20, windowMs: 15 * 60 * 1000, policy: "20;w=900" },
  magicLinkEmail: { limit: 5, windowMs: 15 * 60 * 1000, policy: "5;w=900" },
};

function getBucketKey(agentId: string, tier: RateLimitTier) {
  return `${tier}:${agentId}`;
}

function getRateLimitHeaders(
  policy: RateLimitPolicy,
  count: number,
  windowStart: number,
) {
  const reset = windowStart + policy.windowMs;
  const remaining = Math.max(policy.limit - count, 0);

  return {
    "X-RateLimit-Limit": String(policy.limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(reset),
    "X-RateLimit-Policy": policy.policy,
  };
}

function getRateLimitD1() {
  return globalThis.__toolProvisioningRateLimitD1 ?? getCloudflareEnv().DB;
}

export function getRateLimitDecision(
  existing: RateLimitBucketState,
  tier: RateLimitTier,
  now = Date.now(),
) {
  const policy = policies[tier];
  const expired =
    !existing ||
    existing.windowMs !== policy.windowMs ||
    now - existing.windowStart >= policy.windowMs;
  const count = expired ? 1 : existing.count + 1;
  const windowStart = expired ? now : existing.windowStart;
  const headers = getRateLimitHeaders(policy, count, windowStart);

  return {
    count,
    windowStart,
    windowMs: policy.windowMs,
    exceeded: count > policy.limit,
    headers,
  };
}

export async function enforceRateLimit(agentId: string, tier: RateLimitTier) {
  const now = Date.now();
  const bucketKey = getBucketKey(agentId, tier);
  const policy = policies[tier];
  const row = await getRateLimitD1()
    .prepare(
      `
      insert into rate_limit_buckets
        (key, count, window_start, window_ms, updated_at)
      values
        (?1, 1, ?2, ?3, ?4)
      on conflict(key) do update set
        count = case
          when (?2 - rate_limit_buckets.window_start) >= ?3
            or rate_limit_buckets.window_ms != ?3
          then 1
          else rate_limit_buckets.count + 1
        end,
        window_start = case
          when (?2 - rate_limit_buckets.window_start) >= ?3
            or rate_limit_buckets.window_ms != ?3
          then ?2
          else rate_limit_buckets.window_start
        end,
        window_ms = ?3,
        updated_at = ?4
      returning
        count,
        window_start as windowStart,
        window_ms as windowMs
      `,
    )
    .bind(bucketKey, now, policy.windowMs, now)
    .first<RateLimitRow>();

  if (!row) {
    throw new AppError("Rate limit update failed.", 500);
  }

  const count = Number(row.count);
  const windowStart = Number(row.windowStart);
  const headers = getRateLimitHeaders(policy, count, windowStart);

  if (count > policy.limit) {
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
