import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import { getEncryptionKeyValue } from "@/lib/env";

function resolveEncryptionKey() {
  const raw = getEncryptionKeyValue();

  const base64Buffer = Buffer.from(raw, "base64");
  if (base64Buffer.length === 32) {
    return base64Buffer;
  }

  const utf8Buffer = Buffer.from(raw, "utf8");
  if (utf8Buffer.length === 32) {
    return utf8Buffer;
  }

  throw new Error(
    "ENCRYPTION_KEY must be a 32-byte base64 value or a 32-character string.",
  );
}

export function encryptSecret(plaintext: string) {
  const key = resolveEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSecret(payload: string) {
  const key = resolveEncryptionKey();
  const buffer = Buffer.from(payload, "base64url");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

