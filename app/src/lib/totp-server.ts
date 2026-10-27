import { createHmac } from "node:crypto";

import {
  decodeBase32,
  parseTotpSecretInput,
  type TotpAlgorithm,
  type TotpSnapshot,
} from "@/lib/totp";

function computeHotp(
  keyBytes: Buffer,
  counter: bigint,
  algorithm: TotpAlgorithm,
  digits: 6 | 7 | 8,
): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter, 0);

  const nodeAlgo =
    algorithm === "SHA256"
      ? "sha256"
      : algorithm === "SHA512"
        ? "sha512"
        : "sha1";
  const digest = createHmac(nodeAlgo, keyBytes).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  const modulo = 10 ** digits;

  return String(binaryCode % modulo).padStart(digits, "0");
}

export function generateTotpSnapshot(
  storedSecret: string,
  nowMs = Date.now(),
): TotpSnapshot {
  const config = parseTotpSecretInput(storedSecret);
  const keyBytes = decodeBase32(config.secret);
  const nowSeconds = Math.floor(Math.max(0, nowMs) / 1000);
  const period = config.period;
  const counter = BigInt(Math.floor(nowSeconds / period));
  const elapsedInWindow = nowSeconds % period;
  const expiresInSeconds = period - elapsedInWindow;

  return {
    code: computeHotp(keyBytes, counter, config.algorithm, config.digits),
    expires_in_seconds: expiresInSeconds,
    period_seconds: period,
    next_code: computeHotp(
      keyBytes,
      counter + BigInt(1),
      config.algorithm,
      config.digits,
    ),
  };
}
