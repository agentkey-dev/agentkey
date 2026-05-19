import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.APP_URL || "https://agentkey.dev";
const expectedSecrets = [
  "ENCRYPTION_KEY",
  "NEXT_PUBLIC_BRANDFETCH_CLIENT_ID",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
];

function readLocalEnv(name) {
  const envPath = resolve(appDir, ".env.local");

  if (!existsSync(envPath)) {
    return undefined;
  }

  const prefix = `${name}=`;
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(prefix));

  if (!line) {
    return undefined;
  }

  return line.slice(prefix.length).replace(/^['"]|['"]$/g, "");
}

function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: appDir,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function assertStatus(path, allowedStatuses, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    redirect: "manual",
    ...options,
  });

  if (!allowedStatuses.includes(response.status)) {
    throw new Error(
      `${path} returned ${response.status}; expected ${allowedStatuses.join(", ")}`,
    );
  }

  return response;
}

const endpointChecks = [
  ["/", [200]],
  ["/sign-in", [200]],
  ["/dashboard", [302, 303, 307, 308]],
  ["/api/tools", [401]],
  ["/robots.txt", [200]],
  ["/sitemap.xml", [200]],
  ["/opengraph-image", [200]],
  ["/blog/tools-are-access/opengraph-image", [200]],
  ["/security/opengraph-image", [200]],
  ["/api/migration/encryption-key-export", [404]],
  ["/api/migration/recovery-emails", [404]],
];

for (const [path, statuses] of endpointChecks) {
  await assertStatus(path, statuses);
}

const apiKey = process.env.AGENTKEY_API_KEY || readLocalEnv("AGENTKEY_API_KEY");

if (apiKey) {
  await assertStatus("/api/tools", [200], {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

const secretsOutput = wrangler(["secret", "list"]);
const workerSecretNames = JSON.parse(secretsOutput).map((entry) => entry.name).sort();
const expectedSecretNames = [...expectedSecrets].sort();

for (const secretName of expectedSecretNames) {
  if (!workerSecretNames.includes(secretName)) {
    throw new Error(`Missing Worker secret ${secretName}.`);
  }
}

const unexpectedSecrets = workerSecretNames.filter(
  (secretName) => !expectedSecretNames.includes(secretName),
);

if (unexpectedSecrets.length > 0) {
  throw new Error(`Found unexpected Worker secrets: ${unexpectedSecrets.join(", ")}.`);
}

if (workerSecretNames.some((secretName) => secretName.startsWith("MIGRATION_"))) {
  throw new Error("Found a migration-only Worker secret.");
}

const d1Output = wrangler([
  "d1",
  "execute",
  "agentkey-prod",
  "--remote",
  "--json",
  "--command",
  [
    "pragma foreign_key_check;",
    "select 'users' as table_name, count(*) as row_count from users",
    "union all select 'organizations', count(*) from organizations",
    "union all select 'agents', count(*) from agents",
    "union all select 'tools', count(*) from tools;",
  ].join(" "),
]);
const d1Results = JSON.parse(d1Output);

if (!Array.isArray(d1Results) || !d1Results.every((result) => result.success)) {
  throw new Error("D1 smoke query failed.");
}

const foreignKeyRows = d1Results[0]?.results ?? [];

if (foreignKeyRows.length > 0) {
  throw new Error(`D1 foreign_key_check returned ${foreignKeyRows.length} rows.`);
}

console.log("Production smoke checks passed.");
