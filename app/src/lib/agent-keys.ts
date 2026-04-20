import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateAgentApiKey() {
  return `sk_agent_${randomBytes(24).toString("base64url")}`;
}

export function hashAgentApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function verifyAgentApiKey(apiKey: string, expectedHash: string) {
  const actual = Buffer.from(hashAgentApiKey(apiKey), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

