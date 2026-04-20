import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

type Journal = {
  entries: Array<{
    idx: number;
    tag: string;
    when: number;
  }>;
};

type MigrationEntry = {
  tag: string;
  filename: string;
  createdAt: number;
  hash: string;
};

function resolveDrizzleBin(projectDir: string) {
  const candidates = [
    path.join(projectDir, "node_modules", "drizzle-kit", "bin.cjs"),
    path.join(projectDir, "..", "node_modules", "drizzle-kit", "bin.cjs"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find drizzle-kit/bin.cjs. Checked: ${candidates.join(", ")}`,
  );
}

function getMigrationEntries(projectDir: string) {
  const journalPath = path.join(projectDir, "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;

  return journal.entries.map((entry) => {
    const filename = `${entry.tag}.sql`;
    const sqlPath = path.join(projectDir, "drizzle", filename);
    const hash = createHash("sha256")
      .update(readFileSync(sqlPath))
      .digest("hex");

    return {
      tag: entry.tag,
      filename,
      createdAt: entry.when,
      hash,
    } satisfies MigrationEntry;
  });
}

async function hasTable(sql: postgres.Sql, tableName: string) {
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = ${tableName}
    ) as "exists"
  `;

  return rows[0]?.exists ?? false;
}

async function hasColumn(
  sql: postgres.Sql,
  tableName: string,
  columnName: string,
) {
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
    ) as "exists"
  `;

  return rows[0]?.exists ?? false;
}

async function enumValues(sql: postgres.Sql, enumName: string) {
  const rows = await sql<{ enumlabel: string }[]>`
    select e.enumlabel
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = ${enumName}
    order by e.enumsortorder
  `;

  return rows.map((row) => row.enumlabel);
}

async function migrationAlreadyApplied(
  sql: postgres.Sql,
  migration: MigrationEntry,
) {
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from drizzle.__drizzle_migrations
      where hash = ${migration.hash}
    ) as "exists"
  `;

  return rows[0]?.exists ?? false;
}

async function schemaMatchesMigration(
  sql: postgres.Sql,
  migration: MigrationEntry,
) {
  if (migration.tag === "0000_gifted_karen_page") {
    const requiredTables = [
      "access_grants",
      "agents",
      "audit_log",
      "organizations",
      "tools",
    ];

    for (const table of requiredTables) {
      if (!(await hasTable(sql, table))) {
        return false;
      }
    }

    const [accessGrantStatus, agentStatus, auditActorType, toolAuthType, toolCredentialMode] =
      await Promise.all([
        enumValues(sql, "access_grant_status"),
        enumValues(sql, "agent_status"),
        enumValues(sql, "audit_actor_type"),
        enumValues(sql, "tool_auth_type"),
        enumValues(sql, "tool_credential_mode"),
      ]);

    return (
      accessGrantStatus.join(",") === "pending,approved,denied,revoked" &&
      agentStatus.join(",") === "active,suspended" &&
      auditActorType.includes("agent") &&
      auditActorType.includes("human") &&
      toolAuthType.join(",") === "api_key,oauth_token,bot_token,other" &&
      toolCredentialMode.join(",") === "shared,per_agent"
    );
  }

  if (migration.tag === "0001_yielding_firelord") {
    const [notificationDeliveryStatus, notificationTableExists] =
      await Promise.all([
        enumValues(sql, "notification_delivery_status"),
        hasTable(sql, "organization_notification_settings"),
      ]);

    return (
      notificationTableExists &&
      notificationDeliveryStatus.join(",") === "success,failed"
    );
  }

  if (migration.tag === "0002_empty_zeigeist") {
    const auditActorType = await enumValues(sql, "audit_actor_type");

    return auditActorType.includes("system");
  }

  if (migration.tag === "0003_lyrical_wild_pack") {
    return hasColumn(sql, "tools", "url");
  }

  return false;
}

async function repairMigrationHistory(projectDir: string) {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for db:migrate.");
  }

  const migrations = getMigrationEntries(projectDir);
  const sql = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    await sql.unsafe(`create schema if not exists drizzle`);
    await sql.unsafe(`
      create table if not exists drizzle.__drizzle_migrations (
        id integer primary key generated always as identity,
        hash text not null,
        created_at bigint
      )
    `);

    for (const migration of migrations) {
      if (await migrationAlreadyApplied(sql, migration)) {
        continue;
      }

      if (!(await schemaMatchesMigration(sql, migration))) {
        continue;
      }

      await sql`
        insert into drizzle.__drizzle_migrations (hash, created_at)
        values (${migration.hash}, ${migration.createdAt})
      `;

      console.log(`Marked ${migration.tag} as applied in drizzle.__drizzle_migrations`);
    }
  } finally {
    await sql.end();
  }
}

async function main() {
  const projectDir = process.cwd();
  const drizzleBin = resolveDrizzleBin(projectDir);
  const [, , command, ...args] = process.argv;

  if (!command) {
    throw new Error("Usage: drizzle.ts <generate|migrate|push> [...args]");
  }

  loadEnvConfig(projectDir);

  if (command === "migrate") {
    await repairMigrationHistory(projectDir);
  }

  const result = spawnSync(process.execPath, [drizzleBin, command, ...args], {
    cwd: projectDir,
    env: process.env,
    stdio: "inherit",
  });

  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
