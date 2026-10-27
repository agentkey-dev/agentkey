import { AppError } from "@/lib/http";

export type TotpAlgorithm = "SHA1" | "SHA256" | "SHA512";

export type NormalizedTotpConfig = {
  secret: string;
  algorithm: TotpAlgorithm;
  digits: 6 | 7 | 8;
  period: number;
};

export type TotpSnapshot = {
  code: string;
  expires_in_seconds: number;
  period_seconds: number;
  next_code: string;
};

export type LoginCredentialPayload = {
  username: string;
  password: string;
};

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_CLEAN_RE = /^[A-Z2-7]+$/;
const DEFAULT_TOTP_ALGORITHM: TotpAlgorithm = "SHA1";
const DEFAULT_TOTP_DIGITS = 6 as const;
const DEFAULT_TOTP_PERIOD = 30;
const MIN_SECRET_BYTES = 5;
const MAX_SECRET_BYTES = 128;

function normalizeBase32Secret(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[\s-]+/g, "")
    .replace(/=+$/g, "")
    .toUpperCase();

  if (!cleaned) {
    throw new AppError(
      "TOTP secret cannot be empty.",
      400,
      "Paste a Base32 TOTP secret (A–Z, 2–7) or an otpauth://totp/... URI.",
    );
  }

  if (!BASE32_CLEAN_RE.test(cleaned)) {
    throw new AppError(
      "TOTP secret must be valid Base32 (letters A–Z and digits 2–7).",
      400,
      "Remove any non-Base32 characters or paste the full otpauth://totp/... URI.",
    );
  }

  const decoded = decodeBase32(cleaned);

  if (decoded.byteLength < MIN_SECRET_BYTES) {
    throw new AppError(
      "TOTP secret is too short (must be at least 8 Base32 characters).",
      400,
    );
  }

  if (decoded.byteLength > MAX_SECRET_BYTES) {
    throw new AppError("TOTP secret is too long.", 400);
  }

  return cleaned;
}

export function decodeBase32(normalizedBase32: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < normalizedBase32.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(normalizedBase32[i]);

    if (idx === -1) {
      throw new AppError(
        "TOTP secret must be valid Base32 (letters A–Z and digits 2–7).",
        400,
      );
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

export function parseTotpSecretInput(input: string): NormalizedTotpConfig {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new AppError(
      "TOTP secret cannot be empty.",
      400,
      "Paste a Base32 TOTP secret or an otpauth://totp/... URI.",
    );
  }

  if (/^otpauth:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new AppError("Invalid otpauth:// URI.", 400);
    }

    const type = url.hostname.toLowerCase();
    if (type !== "totp") {
      throw new AppError(
        "Only time-based OTP (otpauth://totp/...) is supported.",
        400,
      );
    }

    const secretParam = url.searchParams.get("secret");
    if (!secretParam) {
      throw new AppError(
        "The otpauth:// URI is missing a secret parameter.",
        400,
      );
    }

    const secret = normalizeBase32Secret(secretParam);

    const rawAlgo = (
      url.searchParams.get("algorithm") ?? DEFAULT_TOTP_ALGORITHM
    )
      .trim()
      .toUpperCase();
    if (rawAlgo !== "SHA1" && rawAlgo !== "SHA256" && rawAlgo !== "SHA512") {
      throw new AppError(
        "Unsupported TOTP algorithm. Must be SHA1, SHA256, or SHA512.",
        400,
      );
    }

    const rawDigits = url.searchParams.get("digits");
    const digitsNum = rawDigits ? Number.parseInt(rawDigits, 10) : DEFAULT_TOTP_DIGITS;
    if (digitsNum !== 6 && digitsNum !== 7 && digitsNum !== 8) {
      throw new AppError("TOTP digits must be 6, 7, or 8.", 400);
    }

    const rawPeriod = url.searchParams.get("period");
    const period = rawPeriod ? Number.parseInt(rawPeriod, 10) : DEFAULT_TOTP_PERIOD;
    if (!Number.isFinite(period) || period < 15 || period > 300) {
      throw new AppError(
        "TOTP period must be between 15 and 300 seconds.",
        400,
      );
    }

    return {
      secret,
      algorithm: rawAlgo,
      digits: digitsNum,
      period,
    };
  }

  return {
    secret: normalizeBase32Secret(trimmed),
    algorithm: DEFAULT_TOTP_ALGORITHM,
    digits: DEFAULT_TOTP_DIGITS,
    period: DEFAULT_TOTP_PERIOD,
  };
}

export function serializeNormalizedTotpConfig(
  config: NormalizedTotpConfig,
): string {
  if (
    config.algorithm === DEFAULT_TOTP_ALGORITHM &&
    config.digits === DEFAULT_TOTP_DIGITS &&
    config.period === DEFAULT_TOTP_PERIOD
  ) {
    return config.secret;
  }

  const params = new URLSearchParams({
    secret: config.secret,
    algorithm: config.algorithm,
    digits: String(config.digits),
    period: String(config.period),
  });
  return `otpauth://totp/AgentKey?${params.toString()}`;
}

export function normalizeTotpSecretForStorage(input: string): string {
  return serializeNormalizedTotpConfig(parseTotpSecretInput(input));
}

export function serializeLoginCredential(input: {
  username?: string;
  password: string;
}): string {
  const username = input.username?.trim() ?? "";
  const password = input.password;

  if (!username) {
    return password;
  }

  return JSON.stringify({
    username,
    password,
  });
}

export function parseLoginCredential(
  raw: string,
): LoginCredentialPayload | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof (parsed as Record<string, unknown>).password === "string"
    ) {
      const record = parsed as Record<string, unknown>;
      return {
        username: typeof record.username === "string" ? record.username : "",
        password: record.password as string,
      };
    }
  } catch {
    // not JSON
  }

  return null;
}

export function formatVendedCredentialValue(
  authType: string,
  rawCredential: string,
): string | Record<string, unknown> {
  if (authType === "oauth_token" || authType === "login") {
    try {
      const parsed: unknown = JSON.parse(rawCredential);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // not JSON — return as-is
    }
  }

  return rawCredential;
}

export type PlaintextSecretDetection = {
  kind: "totp_uri" | "totp_line" | "private_key";
  extractedTotpSecret?: string;
  cleanedInstructions?: string;
  message: string;
  warning: string;
};

const TOTP_LINE_RE =
  /^(.*?(?:totp|2fa|otp|authenticator)\s*(?:secret(?:\s*key)?|seed|key)?\s*[:=]\s*)([A-Za-z2-7]{12,64})\s*$/im;
const OTPAUTH_URI_RE = /(otpauth:\/\/totp\/[^\s"'<>]+)/i;
const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;

export function detectPlaintextSecretInInstructions(
  instructions: string,
): PlaintextSecretDetection | null {
  if (!instructions) {
    return null;
  }

  const uriMatch = instructions.match(OTPAUTH_URI_RE);
  if (uriMatch?.[1]) {
    try {
      parseTotpSecretInput(uriMatch[1]);
      const cleaned = instructions
        .replace(uriMatch[1], "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const message =
        "This usage guide contains a plaintext otpauth:// TOTP secret. Move it to the encrypted TOTP field so the seed is encrypted at rest and never exposed in plaintext.";
      return {
        kind: "totp_uri",
        extractedTotpSecret: normalizeTotpSecretForStorage(uriMatch[1]),
        cleanedInstructions: cleaned,
        message,
        warning: message,
      };
    } catch {
      // ignore invalid URI
    }
  }

  const lineMatch = instructions.match(TOTP_LINE_RE);
  if (lineMatch?.[2]) {
    try {
      parseTotpSecretInput(lineMatch[2]);
      const cleaned = instructions
        .split("\n")
        .filter((line) => !TOTP_LINE_RE.test(line))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const message =
        "This usage guide contains a plaintext TOTP secret key. Move it to the encrypted TOTP field so AgentKey vends short-lived 6-digit codes instead of exposing your permanent 2FA seed.";
      return {
        kind: "totp_line",
        extractedTotpSecret: normalizeTotpSecretForStorage(lineMatch[2]),
        cleanedInstructions: cleaned,
        message,
        warning: message,
      };
    } catch {
      // ignore non-base32 match
    }
  }

  if (PRIVATE_KEY_RE.test(instructions)) {
    const message =
      "This usage guide appears to contain a PEM private key. Usage guides are stored unencrypted — keep private keys in the encrypted Credential field instead.";
    return {
      kind: "private_key",
      message,
      warning: message,
    };
  }

  return null;
}
