import type { CloudflareEnv } from "@/lib/db/client";
import { getCloudflareEnv } from "@/lib/db/client";
import { isProductionAppEnvironment } from "@/lib/env";
import { AppError, getClientIp } from "@/lib/http";

export const MAGIC_LINK_TURNSTILE_ACTION = "magic_link";
const PRODUCTION_TURNSTILE_HOSTNAME = "agentkey.dev";

type VerifyTurnstileOptions = {
  token?: string;
  request: Request;
  env?: CloudflareEnv;
  fetcher?: typeof fetch;
  expectedAction?: string;
};

export async function verifyTurnstileForAuth({
  token,
  request,
  env = getCloudflareEnv(),
  fetcher = fetch,
  expectedAction = MAGIC_LINK_TURNSTILE_ACTION,
}: VerifyTurnstileOptions) {
  const secret =
    typeof env.TURNSTILE_SECRET_KEY === "string"
      ? env.TURNSTILE_SECRET_KEY
      : undefined;
  const isProduction = isProductionAppEnvironment(env);

  if (!secret) {
    if (isProduction) {
      throw new AppError(
        "Verification is not configured.",
        500,
        "TURNSTILE_SECRET_KEY is required in production.",
      );
    }

    return false;
  }

  if (!token) {
    throw new AppError("Complete the verification challenge.", 400);
  }

  const formData = new FormData();
  formData.set("secret", secret);
  formData.set("response", token);
  // Shared hardened resolver — never the leftmost X-Forwarded-For entry.
  const ip = getClientIp(request);

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
  const result = (await response.json()) as {
    success?: boolean;
    action?: string;
    hostname?: string;
  };

  if (!result.success) {
    throw new AppError("Verification failed. Retry the challenge.", 400);
  }

  if (result.action !== expectedAction) {
    throw new AppError("Verification failed. Retry the challenge.", 400);
  }

  if (isProduction && result.hostname !== PRODUCTION_TURNSTILE_HOSTNAME) {
    throw new AppError("Verification failed. Retry the challenge.", 400);
  }

  return true;
}
