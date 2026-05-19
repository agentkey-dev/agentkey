import type { CloudflareEnv } from "@/lib/db/client";
import { getCloudflareEnv } from "@/lib/db/client";
import { AppError } from "@/lib/http";

type VerifyTurnstileOptions = {
  token?: string;
  request: Request;
  env?: CloudflareEnv;
  fetcher?: typeof fetch;
};

export async function verifyTurnstileForAuth({
  token,
  request,
  env = getCloudflareEnv(),
  fetcher = fetch,
}: VerifyTurnstileOptions) {
  const secret =
    typeof env.TURNSTILE_SECRET_KEY === "string"
      ? env.TURNSTILE_SECRET_KEY
      : undefined;

  if (!secret) {
    return false;
  }

  if (!token) {
    throw new AppError("Complete the verification challenge.", 400);
  }

  const formData = new FormData();
  formData.set("secret", secret);
  formData.set("response", token);
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (ip) {
    formData.set("remoteip", ip);
  }

  const response = await fetcher(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    },
  );
  const result = (await response.json()) as { success?: boolean };

  if (!result.success) {
    throw new AppError("Verification failed. Retry the challenge.", 400);
  }

  return true;
}
