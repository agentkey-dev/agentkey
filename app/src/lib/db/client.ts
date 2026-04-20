import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseUrl } from "@/lib/env";
import * as schema from "@/lib/db/schema";

declare global {
  var __toolProvisioningSql: postgres.Sql | undefined;
  var __toolProvisioningDb:
    | ReturnType<typeof drizzle<typeof schema>>
    | undefined;
}

export function getDb() {
  if (!globalThis.__toolProvisioningSql) {
    globalThis.__toolProvisioningSql = postgres(getDatabaseUrl(), {
      max: 1,
      prepare: false,
    });
  }

  if (!globalThis.__toolProvisioningDb) {
    globalThis.__toolProvisioningDb = drizzle(globalThis.__toolProvisioningSql, {
      schema,
    });
  }

  return globalThis.__toolProvisioningDb;
}

