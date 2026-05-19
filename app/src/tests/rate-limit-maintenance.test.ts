import assert from "node:assert/strict";
import test from "node:test";

import { runScheduledMaintenance } from "@/lib/maintenance";
import {
  enforceRateLimit,
  getRateLimitDecision,
  RateLimitError,
} from "@/lib/ratelimit";

async function withMockRateLimitD1(
  d1: unknown,
  callback: () => Promise<unknown>,
) {
  const previousD1 = globalThis.__toolProvisioningRateLimitD1;
  globalThis.__toolProvisioningRateLimitD1 = d1 as never;

  try {
    return await callback();
  } finally {
    globalThis.__toolProvisioningRateLimitD1 = previousD1;
  }
}

async function withFixedNow<T>(now: number, callback: () => Promise<T>) {
  const previousNow = Date.now;
  Date.now = () => now;

  try {
    return await callback();
  } finally {
    Date.now = previousNow;
  }
}

test("rate-limit decisions expose tier headers and reset expired windows", () => {
  const fresh = getRateLimitDecision(null, "request", 1_000);

  assert.deepEqual(fresh.headers, {
    "X-RateLimit-Limit": "10",
    "X-RateLimit-Remaining": "9",
    "X-RateLimit-Reset": "3601000",
    "X-RateLimit-Policy": "10;w=3600",
  });

  const reset = getRateLimitDecision(
    {
      count: 120,
      windowStart: 1_000,
      windowMs: 60_000,
    },
    "read",
    61_000,
  );

  assert.equal(reset.count, 1);
  assert.equal(reset.headers["X-RateLimit-Remaining"], "119");

  const magicLinkEmail = getRateLimitDecision(
    {
      count: 5,
      windowStart: 10_000,
      windowMs: 900_000,
    },
    "magicLinkEmail",
    11_000,
  );

  assert.equal(magicLinkEmail.exceeded, true);
  assert.deepEqual(magicLinkEmail.headers, {
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": "910000",
    "X-RateLimit-Policy": "5;w=900",
  });
});

test("rate limiting updates buckets with one atomic D1 upsert", async () => {
  let preparedSql = "";
  let bucket: {
    key: string;
    count: number;
    windowStart: number;
    windowMs: number;
    updatedAt: number;
  } | null = null;
  const d1 = {
    prepare(sql: string) {
      preparedSql = sql;

      return {
        bind(key: string, now: number, windowMs: number, updatedAt: number) {
          return {
            first: async () => {
              const shouldReset =
                !bucket ||
                now - bucket.windowStart >= windowMs ||
                bucket.windowMs !== windowMs;
              bucket = {
                key,
                count: shouldReset ? 1 : bucket.count + 1,
                windowStart: shouldReset ? now : bucket.windowStart,
                windowMs,
                updatedAt,
              };

              return {
                count: bucket.count,
                windowStart: bucket.windowStart,
                windowMs: bucket.windowMs,
              };
            },
          };
        },
      };
    },
  };

  await withMockRateLimitD1(d1, async () => {
    await withFixedNow(5_000, async () => {
      const first = await enforceRateLimit("agent-1", "request");
      const second = await enforceRateLimit("agent-1", "request");

      assert.equal(first["X-RateLimit-Remaining"], "9");
      assert.equal(second["X-RateLimit-Remaining"], "8");
      assert.equal(bucket?.count, 2);
      assert.match(preparedSql, /on conflict\(key\) do update/);
    });
  });
});

test("rate limiting throws with headers when a bucket exceeds its tier", async () => {
  let bucket = {
    key: "request:agent-1",
    count: 10,
    windowStart: 5_000,
    windowMs: 3_600_000,
    updatedAt: 5_000,
  };
  const d1 = {
    prepare() {
      return {
        bind(key: string, now: number, windowMs: number, updatedAt: number) {
          return {
            first: async () => {
              const shouldReset =
                now - bucket.windowStart >= windowMs ||
                bucket.windowMs !== windowMs;
              bucket = {
                key,
                count: shouldReset ? 1 : bucket.count + 1,
                windowStart: shouldReset ? now : bucket.windowStart,
                windowMs,
                updatedAt,
              };

              return {
                count: bucket.count,
                windowStart: bucket.windowStart,
                windowMs: bucket.windowMs,
              };
            },
          };
        },
      };
    },
  };

  await withMockRateLimitD1(d1, async () => {
    await withFixedNow(6_000, async () => {
      await assert.rejects(
        () => enforceRateLimit("agent-1", "request"),
        (error) =>
          error instanceof RateLimitError &&
          error.status === 429 &&
          error.headers["X-RateLimit-Remaining"] === "0",
      );
    });
  });

  assert.equal(bucket.count, 11);
});

test("scheduled maintenance purges expired auth and stale rate-limit rows", async () => {
  const statements: Array<{ sql: string; value: number }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(value: number) {
          statements.push({ sql, value });

          return { sql, value };
        },
      };
    },
    batch: async () =>
      [
        { success: true, meta: { changes: 2 } },
        { success: true, meta: { changes: 3 } },
        { success: true, meta: { changes: 4 } },
      ] as D1Result[],
  };

  const result = await runScheduledMaintenance(db as never, 1_000_000);

  assert.deepEqual(result, {
    authLoginTokensDeleted: 2,
    authSessionsDeleted: 3,
    rateLimitBucketsDeleted: 4,
  });
  assert.deepEqual(statements, [
    {
      sql: "delete from auth_login_tokens where expires_at <= ?",
      value: 1_000_000,
    },
    {
      sql: "delete from auth_sessions where expires_at <= ? or revoked_at is not null",
      value: 1_000_000,
    },
    {
      sql: "delete from rate_limit_buckets where updated_at <= ?",
      value: 1_000_000 - 24 * 60 * 60 * 1000,
    },
  ]);
});
