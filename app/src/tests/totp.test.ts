import assert from "node:assert/strict";
import test from "node:test";

import { encryptSecret } from "@/lib/crypto";
import { auditLog } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { getCredentialForAgent, getOtpForAgent } from "@/lib/services/agent";
import {
  decodeBase32,
  detectPlaintextSecretInInstructions,
  formatVendedCredentialValue,
  normalizeTotpSecretForStorage,
  parseLoginCredential,
  parseTotpSecretInput,
  serializeLoginCredential,
} from "@/lib/totp";
import { generateTotpSnapshot } from "@/lib/totp-server";
import {
  approveRequestSchema,
  assignToolToAgentSchema,
  createToolSchema,
  updateToolSchema,
} from "@/lib/validation";

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const RFC_6238_BASE32_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

async function withDb<T>(db: unknown, run: () => Promise<T>): Promise<T> {
  const previous = globalThis.__toolProvisioningDb;
  globalThis.__toolProvisioningDb = db as never;
  try {
    return await run();
  } finally {
    globalThis.__toolProvisioningDb = previous;
  }
}

test("decodeBase32 decodes RFC 6238 ASCII secret and parseTotpSecretInput normalizes formatting", () => {
  const parsed = parseTotpSecretInput("gezd gnbv-gy3t qojq gezd gnbv gy3t qojq===");
  const bytes = decodeBase32(parsed.secret);
  assert.equal(bytes.toString("ascii"), "12345678901234567890");
});

test("parseTotpSecretInput rejects invalid characters and too-short secrets", () => {
  assert.throws(() => parseTotpSecretInput("INVALID1890!"), /Base32/);
  assert.throws(() => parseTotpSecretInput("JBSWY"), /at least 8/);
});

test("generateTotpSnapshot matches RFC 6238 SHA1 test vectors and computes next_code", () => {
  const at59s = generateTotpSnapshot(RFC_6238_BASE32_SECRET, 59_000);
  assert.equal(at59s.code, "287082");
  assert.equal(at59s.period_seconds, 30);
  assert.equal(at59s.expires_in_seconds, 1);

  const at89s = generateTotpSnapshot(RFC_6238_BASE32_SECRET, 89_000);
  assert.equal(at59s.next_code, at89s.code);

  const eightDigitsAt59s = generateTotpSnapshot(
    `otpauth://totp/ACME:agent@example.com?secret=${RFC_6238_BASE32_SECRET}&digits=8&period=30&algorithm=SHA1`,
    59_000,
  );
  assert.equal(eightDigitsAt59s.code, "94287082");
});

test("parseTotpSecretInput supports Microsoft-style 16-char Base32 secrets and otpauth URIs", () => {
  const parsedRaw = parseTotpSecretInput("JBSWY3DPEHPK3PXP");
  assert.equal(parsedRaw.secret, "JBSWY3DPEHPK3PXP");
  assert.equal(parsedRaw.digits, 6);
  assert.equal(parsedRaw.period, 30);
  assert.equal(parsedRaw.algorithm, "SHA1");
  assert.equal(
    normalizeTotpSecretForStorage("JBSWY3DPEHPK3PXP"),
    "JBSWY3DPEHPK3PXP",
  );

  const snapshot = generateTotpSnapshot("JBSWY3DPEHPK3PXP", 1_700_000_000_000);
  assert.match(snapshot.code, /^\d{6}$/);
  assert.match(snapshot.next_code, /^\d{6}$/);

  const uri =
    "otpauth://totp/Microsoft:antoine%40elba.security?secret=JBSWY3DPEHPK3PXP&issuer=Microsoft&algorithm=SHA256&digits=6&period=30";
  const parsedUri = parseTotpSecretInput(uri);
  assert.equal(parsedUri.secret, "JBSWY3DPEHPK3PXP");
  assert.equal(parsedUri.algorithm, "SHA256");
  assert.equal(
    normalizeTotpSecretForStorage(uri),
    "otpauth://totp/AgentKey?secret=JBSWY3DPEHPK3PXP&algorithm=SHA256&digits=6&period=30",
  );

  assert.throws(
    () => parseTotpSecretInput("otpauth://hotp/Test?secret=JBSWY3DPEHPK3PXP"),
    /otpauth:\/\/totp/,
  );
});

test("login credential helpers serialize, parse, and format structured credentials", () => {
  const serialized = serializeLoginCredential({
    username: "antoine@elba.security",
    password: "super-secret-password",
  });
  const parsed = parseLoginCredential(serialized);
  assert.deepEqual(parsed, {
    username: "antoine@elba.security",
    password: "super-secret-password",
  });

  assert.deepEqual(formatVendedCredentialValue("login", serialized), {
    username: "antoine@elba.security",
    password: "super-secret-password",
  });
  assert.equal(
    formatVendedCredentialValue("api_key", "lin_api_123"),
    "lin_api_123",
  );
});

test("detectPlaintextSecretInInstructions flags and extracts TOTP seeds from instructions", () => {
  const instructions =
    "antoine@elba.security\nsecret key for TOTP : JBSWY3DPEHPK3PXP";
  const detected = detectPlaintextSecretInInstructions(instructions);

  assert.ok(detected);
  assert.equal(detected.extractedTotpSecret, "JBSWY3DPEHPK3PXP");
  assert.equal(detected.cleanedInstructions, "antoine@elba.security");

  const otpauthDetected = detectPlaintextSecretInInstructions(
    "Login at https://login.microsoftonline.com\notpauth://totp/Microsoft?secret=JBSWY3DPEHPK3PXP",
  );
  assert.ok(otpauthDetected);
  assert.equal(otpauthDetected.extractedTotpSecret, "JBSWY3DPEHPK3PXP");
  assert.equal(
    otpauthDetected.cleanedInstructions,
    "Login at https://login.microsoftonline.com",
  );

  const pemDetected = detectPlaintextSecretInInstructions(
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END PRIVATE KEY-----",
  );
  assert.ok(pemDetected);
  assert.equal(pemDetected.extractedTotpSecret, undefined);

  assert.equal(
    detectPlaintextSecretInInstructions(
      "Use as Bearer token. Base URL: https://api.linear.app",
    ),
    null,
  );
});

test("validation schemas accept login authType and totpSecret and reject invalid TOTP secrets", () => {
  const validCreate = createToolSchema.safeParse({
    name: "Microsoft",
    authType: "login",
    credentialMode: "shared",
    credential: serializeLoginCredential({
      username: "antoine@elba.security",
      password: "pw",
    }),
    totpSecret: "JBSWY3DPEHPK3PXP",
    instructions: "Sign in at login.microsoftonline.com",
  });
  assert.equal(validCreate.success, true);

  const invalidTotpCreate = createToolSchema.safeParse({
    name: "Microsoft",
    authType: "login",
    credentialMode: "shared",
    credential: "pw",
    totpSecret: "not-base32-!@#",
  });
  assert.equal(invalidTotpCreate.success, false);

  const perAgentWithSharedTotp = createToolSchema.safeParse({
    name: "Microsoft",
    authType: "login",
    credentialMode: "per_agent",
    totpSecret: "JBSWY3DPEHPK3PXP",
  });
  assert.equal(perAgentWithSharedTotp.success, false);

  assert.equal(
    updateToolSchema.safeParse({
      name: "Microsoft",
      authType: "login",
      totpSecret: "JBSWY3DPEHPK3PXP",
    }).success,
    true,
  );
  assert.equal(
    approveRequestSchema.safeParse({
      credential: "secret",
      totpSecret: "JBSWY3DPEHPK3PXP",
    }).success,
    true,
  );
  assert.equal(
    assignToolToAgentSchema.safeParse({
      toolId: "5e2f895b-3430-4fb3-b7b7-ca1d9b984874",
      credential: "secret",
      totpSecret: "JBSWY3DPEHPK3PXP",
    }).success,
    true,
  );
});

test("getCredentialForAgent and getOtpForAgent vend computed OTP codes without exposing the raw seed", async () => {
  const rawSeed = "JBSWY3DPEHPK3PXP";
  const encryptedSeed = encryptSecret(rawSeed);
  const encryptedLogin = encryptSecret(
    serializeLoginCredential({
      username: "antoine@elba.security",
      password: "password-123",
    }),
  );
  const audits: Array<Record<string, unknown>> = [];

  const db = {
    query: {
      tools: {
        findFirst: async () => ({
          id: "tool-ms",
          organizationId: "org-1",
          name: "Microsoft",
          authType: "login" as const,
          credentialMode: "shared" as const,
          credentialEncrypted: encryptedLogin,
          totpSecretEncrypted: encryptedSeed,
          credentialExpiresAt: null,
          instructions: "Sign in at https://login.microsoftonline.com",
        }),
      },
      accessGrants: {
        findFirst: async () => ({
          status: "approved" as const,
          credentialEncrypted: null,
          totpSecretEncrypted: null,
        }),
      },
    },
    insert(table: unknown) {
      assert.equal(table, auditLog);
      return {
        values: async (entry: Record<string, unknown>) => {
          audits.push(entry);
        },
      };
    },
  };

  const credentialResult = await withDb(db, () =>
    getCredentialForAgent("org-1", "agent-1", "tool-ms", "Agent"),
  );
  assert.equal(credentialResult.authType, "login");
  assert.ok(credentialResult.otp);
  assert.match(credentialResult.otp.code, /^\d{6}$/);
  assert.match(credentialResult.otp.next_code, /^\d{6}$/);
  assert.equal(
    JSON.stringify(credentialResult).includes(rawSeed),
    false,
    "Raw TOTP seed must never appear in vended credential payload",
  );
  assert.equal(audits[0].action, "credential.vended");

  const otpResult = await withDb(db, () =>
    getOtpForAgent("org-1", "agent-1", "tool-ms", "Agent"),
  );
  assert.equal(otpResult.toolId, "tool-ms");
  assert.match(otpResult.otp.code, /^\d{6}$/);
  assert.equal(
    JSON.stringify(otpResult).includes(rawSeed),
    false,
    "Raw TOTP seed must never appear in vended OTP payload",
  );
  assert.equal(audits[1].action, "otp.vended");
});

test("getOtpForAgent returns 404 when a tool has no TOTP secret configured", async () => {
  const db = {
    query: {
      tools: {
        findFirst: async () => ({
          id: "tool-linear",
          organizationId: "org-1",
          name: "Linear",
          authType: "api_key" as const,
          credentialMode: "shared" as const,
          credentialEncrypted: encryptSecret("lin_api_123"),
          totpSecretEncrypted: null,
          credentialExpiresAt: null,
          instructions: null,
        }),
      },
      accessGrants: {
        findFirst: async () => ({
          status: "approved" as const,
          credentialEncrypted: null,
          totpSecretEncrypted: null,
        }),
      },
    },
    insert() {
      throw new Error("should not write audit log when TOTP is not configured");
    },
  };

  await withDb(db, () =>
    assert.rejects(
      () => getOtpForAgent("org-1", "agent-1", "tool-linear", "Agent"),
      (error) => error instanceof AppError && error.status === 404,
    ),
  );
});
