import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeLoginToken,
  createLoginToken,
  createSessionRecord,
  hashToken,
  revokeSessionToken,
  selectOrganizationForSession,
  sendMagicLinkEmailWithEnv,
} from "@/lib/auth/session";
import { verifyTurnstileForAuth } from "@/lib/auth/turnstile";
import {
  authLoginTokens,
  authSessions,
} from "@/lib/db/schema";
import { AppError } from "@/lib/http";

async function withMockDb(db: unknown, callback: () => Promise<unknown>) {
  const previousDb = globalThis.__toolProvisioningDb;
  globalThis.__toolProvisioningDb = db as never;

  try {
    return await callback();
  } finally {
    globalThis.__toolProvisioningDb = previousDb;
  }
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

test("Turnstile auth verification is optional without a secret", async () => {
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

test("Turnstile auth verification sends remote IP and accepts valid tokens", async () => {
  const request = new Request("https://agentkey.test/sign-in", {
    headers: {
      "cf-connecting-ip": "203.0.113.8",
    },
  });

  const passed = await verifyTurnstileForAuth({
    request,
    token: "token",
    env: { TURNSTILE_SECRET_KEY: "secret" } as never,
    fetcher: async (_url, init) => {
      const body = init?.body;

      assert.ok(body instanceof FormData);
      assert.equal(body.get("secret"), "secret");
      assert.equal(body.get("response"), "token");
      assert.equal(body.get("remoteip"), "203.0.113.8");

      return Response.json({ success: true });
    },
  });

  assert.equal(passed, true);
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
        { APP_URL: "https://agentkey.dev" } as never,
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
