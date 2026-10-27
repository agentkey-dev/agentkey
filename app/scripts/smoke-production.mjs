import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { request as requestHttp } from "node:http";
import { request as requestHttps } from "node:https";
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

const machineClients = [
  ["Python urllib", "Python-urllib/3.13"],
  ["Python requests", "python-requests/2.32.5"],
  ["curl", "curl/8.16.0"],
  ["Node undici", "undici"],
  ["no User-Agent", undefined],
];

function requestMachineCatalog(userAgent, apiKey) {
  const url = new URL("/api/tools", baseUrl);
  const request = url.protocol === "https:" ? requestHttps : requestHttp;
  const headers = { Accept: "application/json" };
  if (userAgent !== undefined) headers["User-Agent"] = userAgent;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // Native HTTP does not insert fetch's default User-Agent, so the omitted-UA
  // case exercises requests from clients that genuinely send no such header.
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15_000),
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 4 * 1024 * 1024) {
          response.destroy(new Error("Machine-client smoke response exceeded 4 MiB."));
          return;
        }
        chunks.push(chunk);
      });
      response.once("error", reject);
      response.once("end", () => resolve({
        status: response.statusCode,
        contentType: response.headers["content-type"] || "",
        cacheControl: response.headers["cache-control"] || "",
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    req.once("error", reject);
    req.end();
  });
}

export async function assertMachineClientRequests(apiKey) {
  for (const [name, userAgent] of machineClients) {
    for (const key of apiKey ? [undefined, apiKey] : [undefined]) {
      const expectedStatus = key ? 200 : 401;
      const label = `${name} (${key ? "authenticated" : "unauthenticated"})`;
      const response = await requestMachineCatalog(userAgent, key);
      if (response.status !== expectedStatus
        || response.contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
        throw new Error(
          `${label}: /api/tools returned ${response.status}; expected application JSON ${expectedStatus}. Check edge filtering of machine clients.`,
        );
      }

      let payload;
      try {
        payload = JSON.parse(response.body);
      } catch {
        throw new Error(`${label}: /api/tools did not return valid JSON.`);
      }
      if (key ? !Array.isArray(payload?.tools) : typeof payload?.error !== "string") {
        throw new Error(`${label}: /api/tools returned an unexpected application response.`);
      }
      if (!response.cacheControl.includes("no-store")) {
        throw new Error(`${label}: /api/tools must prevent response caching.`);
      }
    }
  }
}

async function main() {
  const apiKey = process.env.AGENTKEY_API_KEY || readLocalEnv("AGENTKEY_API_KEY");

  await assertMachineClientRequests(apiKey);

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

  // These rejection checks never need a real session or issue a login email.
  for (const path of ["/api/admin/agents", "/api/admin/config/export", "/api/me"]) {
    const response = await assertStatus(path, [401]);
    if (!response.headers.get("cache-control")?.includes("no-store")) {
      throw new Error(`${path} must prevent caching of authentication responses.`);
    }
  }

  for (const path of ["/api/auth/organizations", "/api/auth/select-organization", "/api/auth/magic-link"]) {
    await assertStatus(path, [403], {
      method: "POST",
      headers: {
        Origin: "https://untrusted.invalid",
        "X-Forwarded-Host": "untrusted.invalid",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "",
    });
  }

  const callbackResponse = await assertStatus("/api/auth/callback", [303], {
    method: "POST",
    headers: {
      Origin: new URL(baseUrl).origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "token=security-smoke-invalid-token",
  });
  const callbackLocation = callbackResponse.headers.get("location");
  if (!callbackLocation || new URL(callbackLocation).origin !== new URL(baseUrl).origin
    || !callbackResponse.headers.get("cache-control")?.includes("no-store")) {
    throw new Error("Invalid login tokens must redirect safely without caching.");
  }

  if (new URL(baseUrl).hostname === "agentkey.dev") {
    const wwwResponse = await assertStatus("https://www.agentkey.dev/sign-in?smoke=1", [308]);
    if (wwwResponse.headers.get("location") !== "https://agentkey.dev/sign-in?smoke=1") {
      throw new Error("The www hostname must redirect to the canonical application.");
    }
    await assertStatus("https://www.agentkey.dev/api/auth/callback", [405], {
      method: "POST",
      body: "",
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
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
