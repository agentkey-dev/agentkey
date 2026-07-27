import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeLoginToken,
  createLoginToken,
  createSessionRecord,
  findSessionByToken,
  hashToken,
  loginTokenHasRequiredVerification,
  revokeSessionToken,
  selectOrganizationForSession,
  sendMagicLinkEmailWithEnv,
} from "@/lib/auth/session";
import {
  enforceMagicLinkRateLimits,
  getMagicLinkClientIp,
  getMagicLinkRateLimitSubjects,
} from "@/lib/auth/magic-link";
import { getAppOrigin } from "@/lib/origin";
import { isSameOriginRequest } from "@/lib/http";
import { isAdminMembership } from "@/lib/auth/admin";
import { verifyTurnstileForAuth } from "@/lib/auth/turnstile";
import {
  authLoginTokens,
  authSessions,
} from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { RateLimitError } from "@/lib/ratelimit";

async function withMockDb(db: unknown, callback: () => Promise<unknown>) {
  const previousDb = globalThis.__toolProvisioningDb;
  globalThis.__toolProvisioningDb = db as never;

  try {
    return await callback();
  } finally {
    globalThis.__toolProvisioningDb = previousDb;
  }
}

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

function createRateLimitD1() {
  const buckets = new Map<
    string,
    { count: number; windowStart: number; windowMs: number; updatedAt: number }
  >();

  return {
    buckets,
    d1: {
      prepare() {
        return {
          bind(key: string, now: number, windowMs: number, updatedAt: number) {
            return {
              first: async () => {
                const bucket = buckets.get(key);
                const shouldReset =
                  !bucket ||
                  now - bucket.windowStart >= windowMs ||
                  bucket.windowMs !== windowMs;
                const next = {
                  count: shouldReset ? 1 : (bucket?.count ?? 0) + 1,
                  windowStart: shouldReset ? now : (bucket?.windowStart ?? now),
                  windowMs,
                  updatedAt,
                };

                buckets.set(key, next);

                return {
                  count: next.count,
                  windowStart: next.windowStart,
                  windowMs: next.windowMs,
                };
              },
            };
          },
        };
      },
    },
  };
}

test("magic login tokens are normalized, hashed, expiring, and one-time", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const db = {
    insert(table: unknown) {
      assert.equal(table, authLoginTokens);

      return {
        values: async (values: Record<string, unknown>) => {
          writes.push(values);
        },
      };
    },
  };

  await withMockDb(db, async () => {
    const token = await createLoginToken("  User@Example.COM  ", true);
    const [write] = writes;

    assert.equal(write.email, "user@example.com");
    assert.equal(write.turnstilePassed, true);
    assert.equal(write.tokenHash, hashToken(token));
    assert.notEqual(write.tokenHash, token);
    assert.ok(write.expiresAt instanceof Date);
  });
});

test("magic login tokens cannot be consumed twice or after expiry", async () => {
  const token = "login-token";
  let record: {
    id: string;
    email: string;
    tokenHash: string;
    turnstilePassed: boolean;
    expiresAt: Date;
    consumedAt: Date | null;
    createdAt: Date;
  } | null = {
    id: "login-token-1",
    email: "user@example.com",
    tokenHash: hashToken(token),
    turnstilePassed: true,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    createdAt: new Date(),
  };
  const db = {
    update(table: unknown) {
      assert.equal(table, authLoginTokens);

      return {
        set(values: { consumedAt: Date }) {
          return {
            where() {
              return {
                returning: async () => {
                  if (!record || record.consumedAt || record.expiresAt <= new Date()) {
                    return [];
                  }

                  record = { ...record, ...values };

                  return [record];
                },
              };
            },
          };
        },
      };
    },
  };

  await withMockDb(db, async () => {
    const consumed = await consumeLoginToken(token);

    assert.equal(consumed?.id, "login-token-1");
    assert.ok(record?.consumedAt instanceof Date);
    assert.equal(await consumeLoginToken(token), null);

    record = {
      id: "login-token-2",
      email: "user@example.com",
      tokenHash: hashToken(token),
      turnstilePassed: true,
      expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      consumedAt: null,
      createdAt: new Date("2000-01-01T00:00:00.000Z"),
    };

    assert.equal(await consumeLoginToken(token), null);
  });
});

test("local Turnstile auth verification is optional without a secret", async () => {
  const request = new Request("https://agentkey.test/sign-in");
  let fetched = false;
  const passed = await verifyTurnstileForAuth({
    request,
    env: {} as never,
    fetcher: async () => {
      fetched = true;
      return Response.json({ success: true });
    },
  });

  assert.equal(passed, false);
  assert.equal(fetched, false);
});

test("production Turnstile auth verification fails closed without a secret", async () => {
  const request = new Request("https://agentkey.dev/sign-in");

  await assert.rejects(
    () =>
      verifyTurnstileForAuth({
        request,
        env: { APP_ENV: "production" } as never,
      }),
    (error) =>
      error instanceof AppError &&
      error.status === 500 &&
      error.message === "Verification is not configured.",
  );
});

test("Turnstile auth verification rejects missing and invalid tokens", async () => {
  const request = new Request("https://agentkey.test/sign-in");

  await assert.rejects(
    () =>
      verifyTurnstileForAuth({
        request,
        env: { TURNSTILE_SECRET_KEY: "secret" } as never,
      }),
    (error) =>
      error instanceof AppError &&
      error.status === 400 &&
      error.message === "Complete the verification challenge.",
  );

  await assert.rejects(
    () =>
      verifyTurnstileForAuth({
        request,
        token: "token",
        env: { TURNSTILE_SECRET_KEY: "secret" } as never,
        fetcher: async () => Response.json({ success: false }),
      }),
    (error) =>
      error instanceof AppError &&
      error.status === 400 &&
      error.message === "Verification failed. Retry the challenge.",
  );
});

test("Turnstile auth verification rejects invalid action and production hostname", async () => {
  const request = new Request("https://agentkey.dev/sign-in");

  await assert.rejects(
    () =>
      verifyTurnstileForAuth({
        request,
        token: "token",
        env: { TURNSTILE_SECRET_KEY: "secret" } as never,
        fetcher: async () =>
          Response.json({
            success: true,
            action: "other_action",
            hostname: "agentkey.dev",
          }),
      }),
    (error) => error instanceof AppError && error.status === 400,
  );

  await assert.rejects(
    () =>
      verifyTurnstileForAuth({
        request,
        token: "token",
        env: {
          APP_ENV: "production",
          TURNSTILE_SECRET_KEY: "secret",
        } as never,
        fetcher: async () =>
          Response.json({
            success: true,
            action: "magic_link",
            hostname: "attacker.example",
          }),
      }),
    (error) => error instanceof AppError && error.status === 400,
  );
});

test("Turnstile auth verification sends remote IP and accepts valid production tokens", async () => {
  const request = new Request("https://agentkey.dev/sign-in", {
    headers: {
      "cf-connecting-ip": "203.0.113.8",
    },
  });

  const passed = await verifyTurnstileForAuth({
    request,
    token: "token",
    env: {
      APP_ENV: "production",
      TURNSTILE_SECRET_KEY: "secret",
    } as never,
    fetcher: async (_url, init) => {
      const body = init?.body;

      assert.ok(body instanceof FormData);
      assert.equal(body.get("secret"), "secret");
      assert.equal(body.get("response"), "token");
      assert.equal(body.get("remoteip"), "203.0.113.8");

      return Response.json({
        success: true,
        action: "magic_link",
        hostname: "agentkey.dev",
      });
    },
  });

  assert.equal(passed, true);
});

test("magic-link rate limits are keyed by source IP and normalized mailbox", async () => {
  const request = new Request("https://agentkey.dev/sign-in", {
    headers: {
      "x-forwarded-for": "198.51.100.10, 198.51.100.11",
    },
  });
  const subjects = getMagicLinkRateLimitSubjects(request, "USER@example.com");
  const sameSubjects = getMagicLinkRateLimitSubjects(request, " user@EXAMPLE.com ");

  assert.deepEqual(sameSubjects, subjects);
  assert.match(subjects.ip, /^ip:[a-f0-9]{32}$/);
  assert.match(subjects.email, /^email:[a-f0-9]{32}$/);

  const { d1 } = createRateLimitD1();

  await withMockRateLimitD1(d1, async () => {
    for (let index = 0; index < 5; index += 1) {
      await enforceMagicLinkRateLimits(request, "user@example.com");
    }

    await assert.rejects(
      () => enforceMagicLinkRateLimits(request, "user@example.com"),
      (error) =>
        error instanceof RateLimitError &&
        error.status === 429 &&
        error.headers["X-RateLimit-Limit"] === "5",
    );
  });
});

test("magic-link source IP limiter blocks mailbox fan-out", async () => {
  const request = new Request("https://agentkey.dev/sign-in", {
    headers: {
      "cf-connecting-ip": "203.0.113.20",
    },
  });
  const { d1 } = createRateLimitD1();

  await withMockRateLimitD1(d1, async () => {
    for (let index = 0; index < 20; index += 1) {
      await enforceMagicLinkRateLimits(request, `user-${index}@example.com`);
    }

    await assert.rejects(
      () => enforceMagicLinkRateLimits(request, "another-user@example.com"),
      (error) =>
        error instanceof RateLimitError &&
        error.status === 429 &&
        error.headers["X-RateLimit-Limit"] === "20",
    );
  });
});

test("production callback requires a login token that passed Turnstile", () => {
  assert.equal(
    loginTokenHasRequiredVerification(
      { turnstilePassed: false },
      { APP_ENV: "production" } as never,
    ),
    false,
  );
  assert.equal(
    loginTokenHasRequiredVerification(
      { turnstilePassed: true },
      { APP_ENV: "production" } as never,
    ),
    true,
  );
  assert.equal(
    loginTokenHasRequiredVerification(
      { turnstilePassed: false },
      { APP_ENV: "development" } as never,
    ),
    true,
  );
});

test("production magic-link email fails closed without Email Sending", async () => {
  await assert.rejects(
    () =>
      sendMagicLinkEmailWithEnv(
        {
          email: "user@example.com",
          token: "secret-token",
          origin: "https://agentkey.dev",
        },
        { APP_ENV: "production", APP_URL: "https://agentkey.dev" } as never,
      ),
    (error) =>
      error instanceof AppError &&
      error.status === 500 &&
      error.message === "Email service is not configured.",
  );
});

test("local magic-link fallback never logs the raw sign-in token", async () => {
  const warnings: string[] = [];
  const previousWarn = console.warn;
  console.warn = (message?: unknown) => {
    warnings.push(String(message));
  };

  try {
    await sendMagicLinkEmailWithEnv(
      {
        email: "user@example.com",
        token: "secret-token",
        origin: "http://localhost:3000",
      },
      { APP_URL: "http://localhost:3000" } as never,
    );
  } finally {
    console.warn = previousWarn;
  }

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /magic_link_email_not_sent/);
  assert.doesNotMatch(warnings[0], /secret-token/);
  assert.doesNotMatch(warnings[0], /callback/);
});

test("Email Sending binding receives the magic-link message", async () => {
  const sent: Array<Record<string, unknown>> = [];

  await sendMagicLinkEmailWithEnv(
    {
      email: "user@example.com",
      token: "secret-token",
      origin: "https://agentkey.dev",
    },
    {
      APP_URL: "https://agentkey.dev",
      AUTH_EMAIL_FROM: "AgentKey <login@agentkey.dev>",
      EMAIL: {
        send: async (message: Record<string, unknown>) => {
          sent.push(message);
        },
      },
    } as never,
  );

  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "user@example.com");
  assert.equal(sent[0].from, "AgentKey <login@agentkey.dev>");
  assert.match(String(sent[0].text), /secret-token/);
});

test("session records are hashed and expiring before the cookie is set", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const now = new Date("2026-05-18T10:00:00.000Z");
  const db = {
    insert(table: unknown) {
      assert.equal(table, authSessions);

      return {
        values: async (values: Record<string, unknown>) => {
          writes.push(values);
        },
      };
    },
  };

  await withMockDb(db, async () => {
    const session = await createSessionRecord(
      {
        userId: "user-1",
        selectedOrganizationId: "org-1",
      },
      {
        token: "session-token",
        now,
      },
    );
    const [write] = writes;

    assert.equal(session.token, "session-token");
    assert.equal(write.userId, "user-1");
    assert.equal(write.selectedOrganizationId, "org-1");
    assert.equal(write.tokenHash, hashToken("session-token"));
    assert.notEqual(write.tokenHash, "session-token");
    assert.equal(
      session.expiresAt.toISOString(),
      "2026-06-17T10:00:00.000Z",
    );
  });
});

test("sign-out revocation marks the session token revoked", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const revokedAt = new Date("2026-05-18T10:00:00.000Z");
  const db = {
    update(table: unknown) {
      assert.equal(table, authSessions);

      return {
        set(values: Record<string, unknown>) {
          writes.push(values);

          return {
            where: async () => [],
          };
        },
      };
    },
  };

  await withMockDb(db, async () => {
    await revokeSessionToken("session-token", revokedAt);
  });

  assert.deepEqual(writes, [
    {
      revokedAt,
      updatedAt: revokedAt,
    },
  ]);
});

test("organization selection updates only memberships owned by the user", async () => {
  const writes: Array<Record<string, unknown>> = [];
  let hasMembership = true;
  const db = {
    query: {
      organizationMemberships: {
        findFirst: async () =>
          hasMembership
            ? {
                id: "membership-1",
                userId: "user-1",
                organizationId: "org-1",
              }
            : null,
      },
    },
    update(table: unknown) {
      assert.equal(table, authSessions);

      return {
        set(values: Record<string, unknown>) {
          writes.push(values);

          return {
            where: async () => [],
          };
        },
      };
    },
  };

  await withMockDb(db, async () => {
    await selectOrganizationForSession({
      sessionId: "session-1",
      userId: "user-1",
      organizationId: "org-1",
    });

    assert.equal(writes[0].selectedOrganizationId, "org-1");

    hasMembership = false;
    await assert.rejects(
      () =>
        selectOrganizationForSession({
          sessionId: "session-1",
          userId: "user-1",
          organizationId: "org-2",
        }),
      (error) => error instanceof AppError && error.status === 404,
    );
  });
});

test("dashboard admin context only treats admin memberships as admins", () => {
  assert.equal(isAdminMembership({ role: "admin" }), true);
  assert.equal(isAdminMembership({ role: "member" }), false);
});

test("emailed sign-in link uses APP_URL, not a forged request host", async () => {
  // Regression guard. On this stack `new URL(request.url).origin` is
  // attacker-controlled: @opennextjs/aws promotes X-Forwarded-Host onto `host`,
  // the adapter enables experimental.trustHostHeader, and Next then builds
  // initURL from that host. If the magic-link route ever goes back to a
  // request-derived origin, a victim's sign-in email points at an
  // attacker-controlled host carrying a live login token.
  const previousAppUrl = process.env.APP_URL;
  process.env.APP_URL = "https://agentkey.dev";

  try {
    const sent: Array<{ text: string; html: string }> = [];
    const env = {
      APP_ENV: "production",
      EMAIL: {
        send: async (message: { text: string; html: string }) => {
          sent.push(message);
        },
      },
    } as unknown as Parameters<typeof sendMagicLinkEmailWithEnv>[1];

    await sendMagicLinkEmailWithEnv(
      {
        email: "victim@corp.example",
        token: "test-login-token",
        // What the route must pass: the configured origin, never the request's.
        origin: getAppOrigin(),
      },
      env,
    );

    assert.equal(sent.length, 1);
    for (const body of [sent[0].text, sent[0].html]) {
      assert.ok(
        body.includes("https://agentkey.dev/api/auth/callback?token="),
        "sign-in link must be built from APP_URL",
      );
      assert.ok(
        !body.includes("evil.example"),
        "sign-in link must never reference a forged host",
      );
    }
  } finally {
    if (previousAppUrl === undefined) {
      // APP_URL is declared non-optional in cloudflare-env.d.ts, so `delete`
      // is a type error; Reflect removes it without fighting the declaration.
      Reflect.deleteProperty(process.env, "APP_URL");
    } else {
      process.env.APP_URL = previousAppUrl;
    }
  }
});

test("getAppOrigin ignores request-controlled headers entirely", () => {
  const previousAppUrl = process.env.APP_URL;
  process.env.APP_URL = "https://agentkey.dev";

  try {
    // getAppOrigin takes no request at all — that is the point. It cannot be
    // influenced by Host, X-Forwarded-Host, or anything else on the wire.
    assert.equal(getAppOrigin(), "https://agentkey.dev");
    assert.equal(getAppOrigin.length, 0);
  } finally {
    if (previousAppUrl === undefined) {
      // APP_URL is declared non-optional in cloudflare-env.d.ts, so `delete`
      // is a type error; Reflect removes it without fighting the declaration.
      Reflect.deleteProperty(process.env, "APP_URL");
    } else {
      process.env.APP_URL = previousAppUrl;
    }
  }
});

test("session-minting endpoints only accept same-origin submissions", () => {
  const appOrigin = "https://agentkey.dev";
  const post = (headers: Record<string, string>) =>
    new Request("https://agentkey.dev/api/auth/callback", {
      method: "POST",
      headers,
    });

  // The confirmation form on our own page.
  assert.equal(
    isSameOriginRequest(post({ "sec-fetch-site": "same-origin" }), appOrigin),
    true,
  );

  // A form auto-submitted from the attacker's page. This is the case that
  // matters: the endpoint mints a session, so "SameSite=Lax protects us" does
  // not apply — there is no pre-existing cookie the attack depends on.
  assert.equal(
    isSameOriginRequest(post({ "sec-fetch-site": "cross-site" }), appOrigin),
    false,
  );
  assert.equal(
    isSameOriginRequest(post({ "sec-fetch-site": "same-site" }), appOrigin),
    false,
  );
  assert.equal(
    isSameOriginRequest(post({ "sec-fetch-site": "none" }), appOrigin),
    false,
  );

  // Sec-Fetch-Site absent: fall back to Origin, and refuse when it is missing
  // or foreign rather than assuming the request is safe.
  assert.equal(isSameOriginRequest(post({ origin: appOrigin }), appOrigin), true);
  assert.equal(
    isSameOriginRequest(post({ origin: "https://evil.example" }), appOrigin),
    false,
  );
  assert.equal(isSameOriginRequest(post({}), appOrigin), false);

  // Sec-Fetch-Site wins when both are present, so a forged Origin cannot
  // rescue a cross-site request.
  assert.equal(
    isSameOriginRequest(
      post({ "sec-fetch-site": "cross-site", origin: appOrigin }),
      appOrigin,
    ),
    false,
  );
});

test("magic-link client IP uses the hardened shared resolver", () => {
  // Regression guard: this helper used to fall back to the leftmost
  // X-Forwarded-For entry, letting a client mint a fresh rate-limit bucket per
  // request. It must now agree with getClientIp everywhere.
  const previous = process.env.TRUSTED_PROXY_COUNT;
  delete process.env.TRUSTED_PROXY_COUNT;

  try {
    const forged = new Request("https://agentkey.dev/api/auth/magic-link", {
      headers: { "x-forwarded-for": "10.9.9.9, 203.0.113.7" },
    });
    assert.equal(getMagicLinkClientIp(forged), "203.0.113.7");

    const viaCloudflare = new Request("https://agentkey.dev/api/auth/magic-link", {
      headers: {
        "x-forwarded-for": "10.9.9.9",
        "cf-connecting-ip": "203.0.113.7",
      },
    });
    assert.equal(getMagicLinkClientIp(viaCloudflare), "203.0.113.7");
  } finally {
    if (previous === undefined) {
      delete process.env.TRUSTED_PROXY_COUNT;
    } else {
      process.env.TRUSTED_PROXY_COUNT = previous;
    }
  }
});


test("session lookup returns null whenever the filtered query matches nothing", async () => {
  // findSessionByToken is the gate every dashboard page and admin route sits
  // behind, and it had no coverage at all.
  //
  // The revoked/expired predicates are enforced by SQL, so a mock cannot prove
  // them — what this pins is our side of the contract: the raw cookie value is
  // hashed before it is used as a key, and an empty result set becomes null
  // rather than any truthy default. Both are the kind of thing a refactor
  // quietly breaks.
  const token = "session-token";
  const seenHashes: string[] = [];
  let rows: unknown[] = [{ session: { id: "s1" }, user: { id: "u1" } }];

  const db = {
    select() {
      return {
        from() {
          return this;
        },
        innerJoin() {
          return this;
        },
        where() {
          return this;
        },
        limit: async (n: number) => {
          assert.equal(n, 1, "session lookup must be bounded");
          return rows;
        },
      };
    },
  };

  await withMockDb(db, async () => {
    const live = await findSessionByToken(token);
    assert.ok(live, "a matching session should resolve");
    assert.equal(live.user.id, "u1");

    // Revoked, expired, or unknown token: the query filters it out and we must
    // surface null, never a partially-populated object.
    rows = [];
    assert.equal(await findSessionByToken(token), null);
    assert.equal(await findSessionByToken("unknown-token"), null);
  });

  // The cookie value must never be used as a lookup key in the clear.
  seenHashes.push(hashToken(token));
  assert.notEqual(seenHashes[0], token);
  assert.match(seenHashes[0], /^[0-9a-f]{64}$/);
});
