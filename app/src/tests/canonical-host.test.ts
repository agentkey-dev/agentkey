import assert from "node:assert/strict";
import test from "node:test";

import { getCanonicalHostResponse } from "@/lib/canonical-host";

test("www navigation preserves paths and query parameters on the HTTPS canonical host", () => {
  for (const method of ["GET", "HEAD"]) {
    const response = getCanonicalHostResponse(
      new Request("http://www.agentkey.dev:8080/api/auth/callback?token=synthetic&returnTo=%2Fdashboard", {
        method,
        headers: { "X-Forwarded-Host": "attacker.example" },
      }),
    );

    assert.equal(response?.status, 308);
    assert.equal(
      response.headers.get("Location"),
      "https://agentkey.dev/api/auth/callback?token=synthetic&returnTo=%2Fdashboard",
    );
    assert.equal(response.headers.get("Cache-Control"), "no-store, private");
  }
});

test("www rejects unsafe methods before the application receives credentials", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const response = getCanonicalHostResponse(
      new Request("https://www.agentkey.dev/api/admin/tools", {
        method,
        headers: { Authorization: "Bearer synthetic" },
      }),
    );

    assert.equal(response?.status, 405);
    assert.equal(response.headers.get("Location"), null);
    assert.equal(response.headers.get("Allow"), "GET, HEAD");
  }
});

test("canonical and local hosts pass through without trusting forwarded headers", () => {
  for (const origin of ["https://agentkey.dev", "http://localhost:3000"]) {
    assert.equal(
      getCanonicalHostResponse(new Request(`${origin}/dashboard`, {
        headers: { "X-Forwarded-Host": "www.agentkey.dev" },
      })),
      null,
    );
  }
});
