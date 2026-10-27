/** Keep the legacy www hostname from accepting credentials or mutations. */
export function getCanonicalHostResponse(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname !== "www.agentkey.dev") {
    return null;
  }

  const headers = new Headers({
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  });

  if (request.method !== "GET" && request.method !== "HEAD") {
    headers.set("Allow", "GET, HEAD");
    headers.set("Content-Type", "text/plain; charset=utf-8");
    return new Response("Use https://agentkey.dev for this request.", {
      status: 405,
      headers,
    });
  }

  url.protocol = "https:";
  url.hostname = "agentkey.dev";
  url.port = "";
  url.hash = "";
  headers.set("Location", url.toString());
  return new Response(null, { status: 308, headers });
}
