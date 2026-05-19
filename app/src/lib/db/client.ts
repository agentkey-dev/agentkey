import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "@/lib/db/schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbScope = Db | DbTransaction;

export type CloudflareEnv = Cloudflare.Env & {
  AGENT_CORS_ORIGINS?: string;
  NEXT_PUBLIC_BRANDFETCH_CLIENT_ID?: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

declare global {
  var __toolProvisioningDb: Db | undefined;
}

export function getCloudflareEnv() {
  return getCloudflareContext<IncomingRequestCfProperties, ExecutionContext>()
    .env as CloudflareEnv;
}

export function getDb() {
  if (!globalThis.__toolProvisioningDb) {
    const env = getCloudflareEnv() as CloudflareEnv;

    if (!env.DB) {
      throw new Error("Cloudflare D1 binding DB is not available.");
    }

    globalThis.__toolProvisioningDb = drizzle(env.DB, { schema });
  }

  return globalThis.__toolProvisioningDb;
}

function canRunMutationDirectly(db: unknown): db is Db {
  return (
    typeof db === "object" &&
    db !== null &&
    "select" in db &&
    "insert" in db &&
    "update" in db
  );
}

export async function runDbMutation<T>(
  callback: (db: DbScope) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const transactionalDb = db as unknown as {
    transaction: (callback: (tx: DbTransaction) => Promise<T>) => Promise<T>;
  };

  // Drizzle's D1 transaction path emits explicit BEGIN statements, which D1
  // rejects in the deployed Worker runtime. Run against the D1 executor
  // directly in production; transaction-only test doubles still exercise the
  // old rollback behavior in unit tests.
  if (canRunMutationDirectly(db)) {
    return callback(db);
  }

  return transactionalDb.transaction((tx) => callback(tx));
}
