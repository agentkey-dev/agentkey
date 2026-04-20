import { getOptionalAppUrl } from "@/lib/env";

function normalizeOrigin(value: string) {
  return value.replace(/\/+$/, "");
}

export function getAppOrigin() {
  const appUrl = getOptionalAppUrl();

  if (appUrl) {
    return normalizeOrigin(appUrl);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL environment variable is required in production.");
  }

  return "http://localhost:3000";
}
