const AGENT_API_KEY_ENV_VAR = "AGENTKEY_API_KEY";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export function getAgentEnvBlock(apiKey: string) {
  return `${AGENT_API_KEY_ENV_VAR}=${apiKey}`;
}

export function getAgentSystemPromptBlock(baseUrl: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return `## Tool Access — AgentKey

You have access to AgentKey, a central service that manages your credentials for external tools (GitHub, Linear, Notion, etc.).

**API endpoint:** ${normalizedBaseUrl}
**Your API key:** available in the ${AGENT_API_KEY_ENV_VAR} environment variable.

### How to use
1. Call \`GET /api/tools\` with header \`Authorization: Bearer <${AGENT_API_KEY_ENV_VAR}>\` to see available tools and your access status.
2. If you need the exact POST body format for a request or suggestion, call \`GET /api/tools/{tool_id}/request\` or \`GET /api/tools/suggest\` first. Those GET handlers return the schema for discovery.
3. If the tool exists in the catalog and you need access, call \`POST /api/tools/{tool_id}/request\` with a JSON body: \`{"reason": "why you need it"}\`.
4. If the tool you need does not exist in the catalog, call \`POST /api/tools/suggest\` with a JSON body: \`{"name": "tool name", "url": "https://product.url", "reason": "why you need it" }\`.
5. Once approved, call \`GET /api/tools/{tool_id}/credentials\` to get the credential and its usage guide.
6. If your request was denied, the \`denial_reason\` field on \`GET /api/tools\` explains why. You can submit a new request with a different justification.
7. After using a tool, if you discovered company-specific facts that should be in the usage guide (channel IDs, project keys, conventions, gotchas), call \`POST /api/tools/{tool_id}/instructions/suggest\` with \`{"learned": "what you discovered", "why": "how this helps future agents"}\`. A human admin will review it.

### Credential response
The \`/credentials\` endpoint returns:
- \`credential\` — the API key or token
- \`auth_type\` — how to authenticate (api_key, oauth_token, bot_token)
- \`instructions\` — **read this carefully**. It contains company-specific context: API base URLs, relevant IDs (channel IDs, repo URLs, project keys), conventions, and rules for how to use this tool in this organization.
- \`suggest_instructions_endpoint\` — the endpoint to suggest improvements to the usage guide. If you discover facts not covered by the instructions (IDs, conventions, gotchas), use this endpoint to share them.

### Credential modes
- Shared tools return the shared credential stored for that tool after your access is approved.
- Per-agent tools may require the admin to create and paste a credential specifically for your agent during approval. If approval exists but no credential has been entered yet, \`GET /api/tools/{tool_id}/credentials\` can still fail until the admin finishes provisioning it.

### Important
- You start with access to **nothing**. Always check \`GET /api/tools\` first.
- Never hardcode credentials. Always fetch them from AgentKey when you need them.
- If a credential stops working, re-fetch it — an admin may have rotated it.
- Always read and follow the \`instructions\` field — it tells you how this specific company uses the tool.`;
}

export function getClaudeMdBlock(baseUrl: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return `## Tool Access

To use external tools, this agent connects to AgentKey at ${normalizedBaseUrl}.
The API key is in the ${AGENT_API_KEY_ENV_VAR} environment variable.

\`\`\`bash
# List available tools
curl -s ${normalizedBaseUrl}/api/tools -H "Authorization: Bearer $${AGENT_API_KEY_ENV_VAR}"

# Request access to a tool
curl -s ${normalizedBaseUrl}/api/tools/{tool_id}/request -X POST \\
  -H "Authorization: Bearer $${AGENT_API_KEY_ENV_VAR}" \\
  -H "Content-Type: application/json" \\
  -d '{"reason": "why you need it"}'

# Discover the request schema first if needed
curl -s ${normalizedBaseUrl}/api/tools/{tool_id}/request \\
  -H "Authorization: Bearer $${AGENT_API_KEY_ENV_VAR}"

# Suggest a new tool if the catalog doesn't contain it
curl -s ${normalizedBaseUrl}/api/tools/suggest -X POST \\
  -H "Authorization: Bearer $${AGENT_API_KEY_ENV_VAR}" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Linear", "url": "https://linear.app", "reason": "I need issue tracking for engineering work"}'

# Discover the suggestion schema first if needed
curl -s ${normalizedBaseUrl}/api/tools/suggest \\
  -H "Authorization: Bearer $${AGENT_API_KEY_ENV_VAR}"

# Fetch credentials for an approved tool
curl -s ${normalizedBaseUrl}/api/tools/{tool_id}/credentials \\
  -H "Authorization: Bearer $${AGENT_API_KEY_ENV_VAR}"

# Suggest an improvement to a tool's usage guide after using it
curl -s ${normalizedBaseUrl}/api/tools/{tool_id}/instructions/suggest -X POST \\
  -H "Authorization: Bearer $${AGENT_API_KEY_ENV_VAR}" \\
  -H "Content-Type: application/json" \\
  -d '{"learned": "The #incidents channel ID is C04XK2MQR", "why": "Future agents need this to post alerts without looking it up"}'

# Discover the instruction suggestion schema first if needed
curl -s ${normalizedBaseUrl}/api/tools/{tool_id}/instructions/suggest \\
  -H "Authorization: Bearer $${AGENT_API_KEY_ENV_VAR}"
\`\`\``;
}
