import type { NextConfig } from "next";

// Content-Security-Policy is set per-request by the middleware in src/proxy.ts
// so that each HTML response carries a fresh script nonce + 'strict-dynamic'.
// The remaining security headers are static and apply to every response.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    // Keep dev-mode file watching scoped to the Next app instead of the repo root.
    root: __dirname,
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
