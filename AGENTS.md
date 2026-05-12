## Tool Access — AgentKey

You have access to AgentKey, a central service that manages your credentials for external tools (GitHub, Linear, Notion, etc.).

**API endpoint:** https://agentkey.dev
**Your API key:** available in the AGENTKEY_API_KEY environment variable.

### How to use
1. Call `GET /api/tools` with header `Authorization: Bearer <AGENTKEY_API_KEY>` to see available tools and your access status.
2. If the tool exists in the catalog and you need access, call `POST /api/tools/{tool_id}/request` with a JSON body: `{"reason": "why you need it"}`.
3. If the tool you need does not exist in the catalog, call `POST /api/tools/suggest` with a JSON body: `{"name": "tool name", "url": "https://product.url", "reason": "why you need it" }`.
4. Once approved, call `GET /api/tools/{tool_id}/credentials` to get the credential and its usage guide.
5. If your request was denied, the `denial_reason` field on `GET /api/tools` explains why. You can submit a new request with a different justification.

### Credential response
The `/credentials` endpoint returns:
- `credential` — the API key or token
- `auth_type` — how to authenticate (api_key, oauth_token, bot_token)
- `instructions` — **read this carefully**. It contains company-specific context: API base URLs, relevant IDs (channel IDs, repo URLs, project keys), conventions, and rules for how to use this tool in this organization.

### Important
- You start with access to **nothing**. Always check `GET /api/tools` first.
- Never hardcode credentials. Always fetch them from AgentKey when you need them.
- If a credential stops working, re-fetch it — an admin may have rotated it.
- Always read and follow the `instructions` field — it tells you how this specific company uses the tool.
