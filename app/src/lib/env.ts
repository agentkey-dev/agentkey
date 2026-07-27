import { getCloudflareEnv } from "@/lib/db/client";

function getEnvValue(name: string) {
  const processValue = process.env[name];

  if (processValue) {
    return processValue;
  }

  try {
    const env = getCloudflareEnv();
    const value = env[name as keyof typeof env];

    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function getRequiredEnv(name: string) {
  const value = getEnvValue(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string) {
  const value = getEnvValue(name);

  if (!value) {
    return undefined;
  }

  return value;
}

export function getEncryptionKeyValue() {
  return getRequiredEnv("ENCRYPTION_KEY");
}

export function getOptionalAppUrl() {
  return getOptionalEnv("APP_URL");
}

export function getOptionalAppEnvironment() {
  return getOptionalEnv("APP_ENV");
}

export function isProductionAppEnvironment(env?: { APP_ENV?: unknown }) {
  const appEnv =
    typeof env?.APP_ENV === "string"
      ? env.APP_ENV
      : getOptionalAppEnvironment();

  return appEnv === "production";
}

export function getOptionalBrandfetchClientId() {
  return getOptionalEnv("NEXT_PUBLIC_BRANDFETCH_CLIENT_ID");
}

export function getOptionalAiDraftModel() {
  return getOptionalEnv("AI_DRAFT_MODEL");
}

export function getOptionalTurnstileSiteKey() {
  return getOptionalEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
}

export function getOptionalAuthEmailFrom() {
  return getOptionalEnv("AUTH_EMAIL_FROM");
}

// Number of trusted reverse proxies in front of the app. The rightmost N
// entries of X-Forwarded-For are appended by infrastructure we trust; anything
// further left is client-supplied and forgeable. Defaults to 1 (Cloudflare).
// Set to 0 only when nothing proxies the app.
export function getTrustedProxyCount() {
  const raw = getOptionalEnv("TRUSTED_PROXY_COUNT");

  if (raw === undefined) {
    return 1;
  }

  const value = Number.parseInt(raw, 10);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error("TRUSTED_PROXY_COUNT must be a non-negative integer.");
  }

  return value;
}

export function getOptionalAgentCorsOrigins() {
  const value = getOptionalEnv("AGENT_CORS_ORIGINS");

  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAiDraftingEnabled() {
  return true;
}
