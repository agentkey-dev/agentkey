const SECURITY_TXT = `# AgentKey Security
# https://securitytxt.org/

Contact: mailto:security@agentkey.dev
Preferred-Languages: en, fr
Canonical: https://agentkey.dev/.well-known/security.txt
Policy: https://agentkey.dev/security
Expires: 2027-04-01T00:00:00.000Z
`;

export async function GET() {
  return new Response(SECURITY_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
