import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";

import { getCloudflareEnv, getDb } from "@/lib/db/client";
import {
  authLoginTokens,
  authSessions,
  organizationMemberships,
  organizations,
  users,
} from "@/lib/db/schema";
import { isProductionAppEnvironment } from "@/lib/env";
import { AppError } from "@/lib/http";

export const SESSION_COOKIE_NAME = "agentkey_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSecretToken(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

function getSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function getSessionCookieValue() {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function setSessionCookie(token: string, expires: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expires));
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getCurrentSession() {
  const token = await getSessionCookieValue();

  if (!token) {
    return null;
  }

  const db = getDb();
  const tokenHash = hashToken(token);
  const now = new Date();
  const row = await db
    .select({
      session: authSessions,
      user: users,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, now),
      ),
    )
    .limit(1);

  return row[0] ?? null;
}

export async function createSession(input: {
  userId: string;
  selectedOrganizationId?: string | null;
}) {
  const session = await createSessionRecord(input);

  await setSessionCookie(session.token, session.expiresAt);
}

export async function createSessionRecord(
  input: {
    userId: string;
    selectedOrganizationId?: string | null;
  },
  options?: {
    token?: string;
    now?: Date;
  },
) {
  const db = getDb();
  const token = options?.token ?? generateSecretToken();
  const now = options?.now ?? new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.insert(authSessions).values({
    userId: input.userId,
    tokenHash: hashToken(token),
    selectedOrganizationId: input.selectedOrganizationId ?? null,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function revokeCurrentSession() {
  const token = await getSessionCookieValue();

  if (token) {
    await revokeSessionToken(token);
  }

  await clearSessionCookie();
}

export async function revokeSessionToken(token: string, now = new Date()) {
  await getDb()
    .update(authSessions)
    .set({ revokedAt: now, updatedAt: now })
    .where(eq(authSessions.tokenHash, hashToken(token)));
}

export async function createLoginToken(email: string, turnstilePassed: boolean) {
  const db = getDb();
  const token = generateSecretToken();

  await db.insert(authLoginTokens).values({
    email: normalizeEmail(email),
    tokenHash: hashToken(token),
    turnstilePassed,
    expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
  });

  return token;
}

export async function consumeLoginToken(token: string) {
  const db = getDb();
  const tokenHash = hashToken(token);
  const now = new Date();
  const [loginToken] = await db
    .update(authLoginTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(authLoginTokens.tokenHash, tokenHash),
        isNull(authLoginTokens.consumedAt),
        gt(authLoginTokens.expiresAt, now),
      ),
    )
    .returning();

  if (!loginToken) {
    return null;
  }

  return loginToken;
}

export function loginTokenHasRequiredVerification(
  loginToken: { turnstilePassed: boolean },
  env: ReturnType<typeof getCloudflareEnv> = getCloudflareEnv(),
) {
  return !isProductionAppEnvironment(env) || loginToken.turnstilePassed === true;
}

export async function findOrCreateUser(email: string) {
  const db = getDb();
  const normalizedEmail = normalizeEmail(email);
  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (existing) {
    await db
      .update(users)
      .set({ lastSignedInAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      email: normalizedEmail,
      lastSignedInAt: new Date(),
    })
    .returning();

  return created;
}

export async function getFirstOrganizationForUser(userId: string) {
  const rows = await getDb()
    .select({ organization: organizations })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizationMemberships.organizationId, organizations.id),
    )
    .where(eq(organizationMemberships.userId, userId))
    .limit(1);

  return rows[0]?.organization ?? null;
}

export async function selectOrganizationForSession(input: {
  sessionId: string;
  userId: string;
  organizationId: string;
}) {
  const db = getDb();
  const membership = await db.query.organizationMemberships.findFirst({
    where: and(
      eq(organizationMemberships.userId, input.userId),
      eq(organizationMemberships.organizationId, input.organizationId),
    ),
  });

  if (!membership) {
    throw new AppError("Organization not found.", 404);
  }

  await db
    .update(authSessions)
    .set({
      selectedOrganizationId: input.organizationId,
      updatedAt: new Date(),
    })
    .where(eq(authSessions.id, input.sessionId));
}

export async function sendMagicLinkEmail(input: {
  email: string;
  token: string;
  origin: string;
}) {
  await sendMagicLinkEmailWithEnv(input, getCloudflareEnv());
}

export async function sendMagicLinkEmailWithEnv(
  input: {
    email: string;
    token: string;
    origin: string;
  },
  env: ReturnType<typeof getCloudflareEnv>,
) {
  const from =
    typeof env.AUTH_EMAIL_FROM === "string"
      ? env.AUTH_EMAIL_FROM
      : "AgentKey <login@agentkey.dev>";
  const loginUrl = `${input.origin}/api/auth/callback?token=${encodeURIComponent(
    input.token,
  )}`;
  const text = [
    "Sign in to AgentKey",
    "",
    `Open this link to sign in: ${loginUrl}`,
    "",
    "This link expires in 15 minutes. If you did not request it, you can ignore this email.",
  ].join("\n");
  const html = `<p>Open this link to sign in to AgentKey:</p><p><a href="${loginUrl}">Sign in to AgentKey</a></p><p>This link expires in 15 minutes.</p>`;

  if ("EMAIL" in env && env.EMAIL) {
    await env.EMAIL.send({
      to: input.email,
      from,
      subject: "Sign in to AgentKey",
      text,
      html,
    });
    return;
  }

  if (isProductionAppEnvironment(env)) {
    throw new AppError(
      "Email service is not configured.",
      500,
      "Cloudflare Email Sending binding EMAIL is required in production.",
    );
  }

  console.warn(
    JSON.stringify({
      event: "magic_link_email_not_sent",
      reason: "missing_email_binding",
      email: input.email,
    }),
  );
}
