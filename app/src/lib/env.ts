function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    return undefined;
  }

  return value;
}

export function getDatabaseUrl() {
  return getRequiredEnv("DATABASE_URL");
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
  return Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);
}
