import assert from "node:assert/strict";
import test from "node:test";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import type { SQL } from "drizzle-orm";

import { GET as getCallback, POST as postCallback } from "@/app/api/auth/callback/route";
import { POST as postMagicLink } from "@/app/api/auth/magic-link/route";
import { POST as postOrganization } from "@/app/api/auth/organizations/route";
import { POST as postOrganizationSelection } from "@/app/api/auth/select-organization/route";
import { AUTH_FORM_BODY_LIMIT, readAuthFormData } from "@/lib/auth/form";
import { selectOrganizationForSession } from "@/lib/auth/session";
import {
  AppError,
  assertSameOriginMutation,
  isSameOriginRequest,
  jsonData,
  jsonError,
} from "@/lib/http";

const appOrigin = "https://agentkey.dev";

async function withAuthEnvironment(callback: () => Promise<void>, db?: unknown) {
  const previousAppUrl = process.env.APP_URL;
  const previousDb = globalThis.__toolProvisioningDb;
  const contextSymbol = Symbol.for("__cloudflare-context__");
  const previousContext = Reflect.get(globalThis, contextSymbol);
  process.env.APP_URL = appOrigin;
  Reflect.set(globalThis, contextSymbol, { env: { APP_ENV: "production" } });
  if (db !== undefined) {
    globalThis.__toolProvisioningDb = db as never;
  }
  try {
    await callback();
  } finally {
    globalThis.__toolProvisioningDb = previousDb;
    if (previousAppUrl === undefined) {
      Reflect.deleteProperty(process.env, "APP_URL");
    } else {
      process.env.APP_URL = previousAppUrl;
    }
    if (previousContext === undefined) {
      Reflect.deleteProperty(globalThis, contextSymbol);
    } else {
      Reflect.set(globalThis, contextSymbol, previousContext);
    }
  }
}

function post(path: string, body: string, headers: Record<string, string> = {}) {
  return new Request(`${appOrigin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body,
  });
}

test("auth forms reject foreign, sibling, null and absent origins before accessing a session", async () => {
  await withAuthEnvironment(async () => {
    const handlers = [postMagicLink, postOrganization, postOrganizationSelection];
    const headersList: Array<Record<string, string>> = [
      {},
      { origin: "https://evil.example" },
      { origin: "https://untrusted.agentkey.dev", "sec-fetch-site": "same-site" },
      { origin: "null" },
      { origin: "http://agentkey.dev" },
      { origin: "https://evil.example", "sec-fetch-site": "same-origin" },
    ];
    for (const handler of handlers) {
      for (const headers of headersList) {
        const response = await handler(post("/api/auth/test", "name=unwanted", headers));
        assert.equal(response.status, 403);
      }
    }
  });
});

test("mutation checks use the configured origin even if forwarded host controls the request URL", async () => {
  await withAuthEnvironment(async () => {
    const forged = new Request("https://evil.example/api/admin/agents/test/rotate-key", {
      method: "POST",
      headers: { origin: "https://evil.example", "x-forwarded-host": "evil.example" },
    });
    assert.throws(() => assertSameOriginMutation(forged),
      (error) => error instanceof AppError && error.status === 403);
    assert.equal(isSameOriginRequest(post("/", "", {
      origin: appOrigin, "sec-fetch-site": "same-origin",
    }), appOrigin), true);
    assert.equal(isSameOriginRequest(post("/", "", {
      origin: "https://evil.example", "sec-fetch-site": "same-origin",
    }), appOrigin), false);
  });
});

test("auth form byte limit is enforced without trusting Content-Length", async () => {
  const request = post("/api/auth/magic-link", `email=${"x".repeat(AUTH_FORM_BODY_LIMIT)}`, {
    "content-length": "1",
  });
  await assert.rejects(() => readAuthFormData(request),
    (error) => error instanceof AppError && error.status === 413);
  const parsed = await readAuthFormData(post("/", "email=user%2Btest%40example.com", {
    "content-type": "Application/X-Www-Form-Urlencoded; charset=UTF-8",
  }));
  assert.equal(parsed.get("email"), "user+test@example.com");
});

test("public authentication handlers reject oversized forms before DB or outbound calls", async () => {
  await withAuthEnvironment(async () => {
    for (const handler of [postCallback, postMagicLink]) {
      const response = await handler(post("/api/auth/test", `token=${"x".repeat(AUTH_FORM_BODY_LIMIT)}`, {
        origin: appOrigin,
      }));
      assert.equal(response.status, 413);
    }
  });
});

test("callback failures redirect with GET and never resend login tokens to a forged host", async () => {
  await withAuthEnvironment(async () => {
    const rejected = await postCallback(new Request("https://evil.example/api/auth/callback", {
      method: "POST",
      body: "token=sensitive-token",
      headers: { origin: "https://evil.example" },
    }));
    assert.equal(rejected.status, 303);
    assert.equal(rejected.headers.get("location"), `${appOrigin}/sign-in?error=invalid-origin`);
    assert.equal(rejected.headers.get("referrer-policy"), "no-referrer");
    assert.match(rejected.headers.get("cache-control") ?? "", /no-store/);

    const missing = await postCallback(post("/api/auth/callback", "", { origin: appOrigin }));
    assert.equal(missing.status, 303);
    assert.equal(missing.headers.get("location"), `${appOrigin}/sign-in?error=missing-token`);
  });
});

test("callback GET only confirms the account and protects the token-bearing page", async () => {
  let reads = 0;
  const db = {
    query: { authLoginTokens: { findFirst: async () => {
      reads += 1;
      return { email: '<img src=x onerror="alert(1)">@example.com', turnstilePassed: true };
    } } },
    update() { throw new Error("GET must not consume a token or create a session"); },
    insert() { throw new Error("GET must not create a user or session"); },
  };
  await withAuthEnvironment(async () => {
    const response = await getCallback(new Request(`${appOrigin}/api/auth/callback?token=one-time-secret`));
    assert.equal(response.status, 200);
    assert.equal(reads, 1);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(response.headers.get("referrer-policy"), "strict-origin");
    assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    const html = await response.text();
    assert.match(html, /<meta name="referrer" content="strict-origin">/);
    assert.doesNotMatch(html, /no-referrer/);
    assert.match(html, /&lt;img/);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /method="POST"/);
  }, db);
});

test("organization selection SQL enforces admin membership and a live session owned by that user", async () => {
  const dialect = new SQLiteSyncDialect();
  const predicates: Array<ReturnType<typeof dialect.sqlToQuery>> = [];
  const db = {
    query: { organizationMemberships: { findFirst: async ({ where }: { where: SQL }) => {
      predicates.push(dialect.sqlToQuery(where));
      return { id: "membership-1", role: "admin" };
    } } },
    update() { return { set() { return { where: async (where: SQL) => {
      predicates.push(dialect.sqlToQuery(where));
    } }; } }; },
  };
  await withAuthEnvironment(async () => {
    await selectOrganizationForSession({ sessionId: "session-1", userId: "user-1", organizationId: "org-1" });
    assert.match(predicates[0].sql, /"user_id" = \?/);
    assert.match(predicates[0].sql, /"organization_id" = \?/);
    assert.match(predicates[0].sql, /"role" = \?/);
    assert.deepEqual(predicates[0].params, ["user-1", "org-1", "admin"]);
    assert.match(predicates[1].sql, /"id" = \?/);
    assert.match(predicates[1].sql, /"user_id" = \?/);
    assert.match(predicates[1].sql, /"revoked_at" is null/);
    assert.match(predicates[1].sql, /"expires_at" > \?/);
    assert.deepEqual(predicates[1].params.slice(0, 2), ["session-1", "user-1"]);
  }, db);
});

test("API responses containing credentials and auth failures forbid caching", () => {
  assert.equal(jsonData({ api_key: "secret" }).headers.get("cache-control"), "no-store, private");
  assert.equal(jsonError("Authentication required", 401).headers.get("cache-control"), "no-store, private");
});
