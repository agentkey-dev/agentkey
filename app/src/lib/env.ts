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
