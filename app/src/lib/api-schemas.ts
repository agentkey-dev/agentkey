/**
 * Agent-facing API schema definitions.
 * Returned by GET handlers on POST endpoints so agents can discover the expected format.
 */

export const TOOLS_REQUEST_SCHEMA = {
  method: "POST",
  path: "/api/tools/{tool_id}/request",
  description:
    "Request access to a tool in the catalog. A human admin will review your request.",
  body: {
    reason: {
      type: "string",
      required: true,
      min_length: 5,
      max_length: 500,
      description:
        "Why you need this tool. Be specific — this is shown to the admin who approves or denies.",
      example:
        "I need Linear access to create and track bugs for the backend team.",
    },
  },
  responses: {
    "201": {
      description: "Request submitted",
      example: {
        request_id: "uuid",
        status: "pending",
        message: "Your request has been submitted. A human admin will review it.",
      },
    },
    "403": {
      description: "Agent doesn't have access or is suspended",
    },
    "409": {
      description: "Agent already has access or a pending request for this tool",
    },
  },
};

export const TOOLS_SUGGEST_SCHEMA = {
  method: "POST",
  path: "/api/tools/suggest",
  description:
    "Suggest a tool that should be added to the organization's catalog. Use this when GET /api/tools doesn't contain the tool you need.",
  body: {
    name: {
      type: "string",
      required: true,
      min_length: 2,
      max_length: 120,
      description: "The tool's name (e.g., Linear, Slack, Discord).",
      example: "Linear",
    },
    url: {
      type: "string",
      required: false,
      max_length: 500,
      description:
        "The tool's website URL. Helps the admin identify and provision it.",
      example: "https://linear.app",
    },
    reason: {
      type: "string",
      required: true,
      min_length: 5,
      max_length: 500,
      description:
        "Why the organization needs this tool. Be specific — this is shown to the admin.",
      example:
        "I need an issue tracker to create and manage engineering tasks.",
    },
  },
  responses: {
    "201": {
      description: "Suggestion submitted (or support added to existing)",
      example: {
        suggestion_id: "uuid",
        status: "pending",
        existing: false,
        message: "Your tool suggestion has been submitted. A human admin will review it.",
      },
    },
    "409 (existing tool)": {
      description:
        "The tool already exists in the catalog. Use POST /api/tools/{tool_id}/request instead.",
      example: {
        error: "This tool already exists in the catalog.",
        tool_id: "uuid",
        tool_name: "Linear",
        hint: "Call POST /api/tools/{tool_id}/request with this tool_id to request access immediately.",
      },
    },
    "409 (cooldown)": {
      description:
        "This suggestion was recently dismissed. Wait for the cooldown to expire (default: 24 hours).",
      example: {
        error: "This tool suggestion was recently dismissed.",
        retry_after: "2026-03-30T14:00:00.000Z",
        hint: "Wait for the cooldown to expire, then suggest it again if it is still needed.",
      },
    },
  },
};

export const TOOLS_CREDENTIALS_SCHEMA = {
  method: "GET",
  path: "/api/tools/{tool_id}/credentials",
  description:
    "Fetch credentials for an approved tool. Returns the credential and a usage guide with company-specific context.",
  authentication: "Authorization: Bearer <AGENTKEY_API_KEY>",
  responses: {
    "200": {
      description: "Credential vended successfully",
      example: {
        tool_id: "uuid",
        tool_name: "Linear",
        auth_type: "api_key",
        credential: "lin_api_xxx",
        instructions:
          "Use as Bearer token. Base URL: https://api.linear.app. Team: ACME (ID: abc123).",
        suggest_instructions_endpoint:
          "/api/tools/{tool_id}/instructions/suggest",
      },
    },
    "403": {
      description:
        "Not approved. Check GET /api/tools for your access status and denial_reason.",
    },
  },
};

export const TOOLS_INSTRUCTION_SUGGEST_SCHEMA = {
  method: "POST",
  path: "/api/tools/{tool_id}/instructions/suggest",
  description:
    "Suggest an improvement to the current usage guide for a tool you already use. Use this after discovering a company-specific fact that should be captured for future agents.",
  body: {
    learned: {
      type: "string",
      required: true,
      min_length: 5,
      description:
        "The concrete fact the agent learned and wants added to the guide.",
      example: "Project key is PLATFORM and incident triage happens in channel C123456.",
    },
    why: {
      type: "string",
      required: true,
      min_length: 5,
      description:
        "Why this fact matters for future agent runs. This is shown to the admin.",
      example:
        "Future agents need this to file issues against the right project without rediscovering the key.",
    },
  },
  responses: {
    "201": {
      description: "Suggestion submitted (or support added to existing)",
      example: {
        suggestion_id: "uuid",
        status: "pending",
        existing: false,
        message:
          "Your instruction suggestion has been submitted. A human admin will review it.",
      },
    },
    "403": {
      description: "Tool is not approved for this agent.",
    },
    "409": {
      description:
        "An equivalent suggestion for the current guide version was dismissed.",
      example: {
        error: "This instruction suggestion was dismissed for the current guide version.",
        suggestion_id: "uuid",
        dismissal_reason:
          "This belongs in the canonical onboarding notes, not the tool guide.",
        message:
          "The admin dismissed this suggestion for the current guide version. Submit it again only after the guide changes.",
      },
    },
  },
};

export const TOOLS_LIST_SCHEMA = {
  method: "GET",
  path: "/api/tools",
  description:
    "List all tools in the organization's catalog with your current access status for each.",
  authentication: "Authorization: Bearer <AGENTKEY_API_KEY>",
  responses: {
    "200": {
      description: "Tool catalog with access status",
      example: {
        tools: [
          {
            id: "uuid",
            name: "Linear",
            description: "Issue tracking for engineering teams",
            your_access: "approved",
          },
          {
            id: "uuid",
            name: "GitHub",
            description: "Source control and CI/CD",
            your_access: "denied",
            denial_reason: "Use the shared bot account instead.",
          },
          {
            id: "uuid",
            name: "Notion",
            description: "Team wiki",
            your_access: "pending",
          },
          {
            id: "uuid",
            name: "Discord",
            description: "Team communication",
            your_access: "none",
          },
        ],
      },
    },
  },
  access_states: {
    none: "Never requested. Call POST /api/tools/{id}/request to ask for access.",
    pending:
      "Request submitted, waiting for human review. Check back later.",
    approved:
      "Access granted. Call GET /api/tools/{id}/credentials to fetch the credential.",
    denied:
      "Request was denied. Read denial_reason. You can submit a new request with a different justification.",
  },
};
