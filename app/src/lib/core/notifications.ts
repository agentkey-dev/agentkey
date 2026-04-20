import { lookup } from "node:dns/promises";
import { AppError } from "@/lib/http";

export type NotificationProvider = "slack" | "discord";

export type NotificationSettingsInput = {
  slackWebhook?: string;
  discordWebhook?: string;
  clearSlack?: boolean;
  clearDiscord?: boolean;
};

export type NotificationMessageInput = {
  organizationName: string;
  agentName: string;
  toolName: string;
  reason: string;
  requestedAt: Date;
  requestsUrl: string;
};

export type ToolSuggestionNotificationMessageInput = NotificationMessageInput & {
  toolUrl?: string | null;
};

export type NotificationDispatchContext = NotificationMessageInput & {
  requestId: string;
  organizationId: string;
  agentId: string;
  toolId: string;
};

export type NotificationDispatchSettings = {
  slackWebhook?: string | null;
  discordWebhook?: string | null;
};

export type NotificationSendResult = {
  provider: NotificationProvider;
  status: "success" | "failed";
  error: string | null;
  attemptedAt: Date;
};

function isPrivateIpV4(ip: string): boolean {
  if (
    ip.startsWith("10.") ||
    ip.startsWith("127.") ||
    ip.startsWith("0.") ||
    ip === "0.0.0.0" ||
    ip === "255.255.255.255" ||
    ip.startsWith("169.254.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("192.0.0.") ||
    ip.startsWith("192.0.2.") ||
    ip.startsWith("198.51.100.") ||
    ip.startsWith("203.0.113.") ||
    ip.startsWith("224.") ||
    ip.startsWith("225.") ||
    ip.startsWith("226.") ||
    ip.startsWith("227.") ||
    ip.startsWith("228.") ||
    ip.startsWith("229.") ||
    ip.startsWith("230.") ||
    ip.startsWith("231.") ||
    ip.startsWith("232.") ||
    ip.startsWith("233.") ||
    ip.startsWith("234.") ||
    ip.startsWith("235.") ||
    ip.startsWith("236.") ||
    ip.startsWith("237.") ||
    ip.startsWith("238.") ||
    ip.startsWith("239.")
  ) {
    return true;
  }

  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  const [a, b] = parts.map((p) => parseInt(p, 10));
  if (Number.isNaN(a) || Number.isNaN(b)) return false;

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 100.64.0.0/10 CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 198.18.0.0/15 benchmark
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 240.0.0.0/4 reserved
  if (a >= 240) return true;

  return false;
}

function isPrivateIp(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Strip IPv6 zone id (fe80::1%eth0)
  const withoutZone = normalized.split("%")[0];

  // IPv4-mapped IPv6: ::ffff:10.0.0.1 or ::ffff:a00:1
  const mapped = withoutZone.match(/^::ffff:(.+)$/);
  if (mapped) {
    const payload = mapped[1];
    if (payload.includes(".")) {
      if (isPrivateIpV4(payload)) return true;
    }
  }

  if (withoutZone.includes(".") && !withoutZone.includes(":")) {
    return isPrivateIpV4(withoutZone);
  }

  // IPv6 special addresses
  if (
    withoutZone === "::1" ||
    withoutZone === "::" ||
    withoutZone === "0:0:0:0:0:0:0:1" ||
    withoutZone === "0:0:0:0:0:0:0:0"
  ) {
    return true;
  }

  // IPv6 link-local fe80::/10, unique-local fc00::/7, multicast ff00::/8
  if (
    withoutZone.startsWith("fe8") ||
    withoutZone.startsWith("fe9") ||
    withoutZone.startsWith("fea") ||
    withoutZone.startsWith("feb") ||
    withoutZone.startsWith("fc") ||
    withoutZone.startsWith("fd") ||
    withoutZone.startsWith("ff")
  ) {
    return true;
  }

  return false;
}

export async function assertNotPrivateIp(
  url: string,
  errorMessage = "Webhook URL must not resolve to a private or loopback address.",
) {
  const { hostname } = new URL(url);

  // Reject host literals that are private without needing DNS.
  if (isPrivateIp(hostname.replace(/^\[|\]$/g, ""))) {
    throw new AppError(errorMessage, 400);
  }

  // Resolve ALL A/AAAA records, not just the first. A DNS response that
  // mixes a public decoy with a private target must still be rejected.
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new AppError(errorMessage, 400, "Could not resolve hostname.");
  }

  if (addresses.length === 0) {
    throw new AppError(errorMessage, 400, "Hostname has no IP addresses.");
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr.address)) {
      throw new AppError(errorMessage, 400);
    }
  }
}

export function validateSlackWebhook(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new AppError("Slack webhook must be a valid HTTPS URL.", 400);
  }

  if (url.protocol !== "https:") {
    throw new AppError("Slack webhook must use HTTPS.", 400);
  }

  if (url.hostname !== "hooks.slack.com" && url.hostname !== "hooks.slack-gov.com") {
    throw new AppError("Slack webhook must use a Slack incoming webhook URL.", 400);
  }

  if (!url.pathname.startsWith("/services/")) {
    throw new AppError("Slack webhook must use a Slack incoming webhook URL.", 400);
  }
}

export function validateDiscordWebhook(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new AppError("Discord webhook must be a valid HTTPS URL.", 400);
  }

  if (url.protocol !== "https:") {
    throw new AppError("Discord webhook must use HTTPS.", 400);
  }

  if (
    url.hostname !== "discord.com" &&
    url.hostname !== "discordapp.com" &&
    url.hostname !== "ptb.discord.com" &&
    url.hostname !== "canary.discord.com"
  ) {
    throw new AppError("Discord webhook must use a Discord webhook URL.", 400);
  }

  if (!url.pathname.startsWith("/api/webhooks/")) {
    throw new AppError("Discord webhook must use a Discord webhook URL.", 400);
  }
}

export async function assertValidNotificationSettingsInput(
  input: NotificationSettingsInput,
) {
  if (input.slackWebhook?.trim()) {
    validateSlackWebhook(input.slackWebhook.trim());
    await assertNotPrivateIp(input.slackWebhook.trim());
  }

  if (input.discordWebhook?.trim()) {
    validateDiscordWebhook(input.discordWebhook.trim());
    await assertNotPrivateIp(input.discordWebhook.trim());
  }
}

export function applyNotificationSettingsInput(input: NotificationSettingsInput) {
  const slackWebhook = input.slackWebhook?.trim();
  const discordWebhook = input.discordWebhook?.trim();

  return {
    slackWebhook,
    discordWebhook,
    clearSlack: Boolean(input.clearSlack),
    clearDiscord: Boolean(input.clearDiscord),
  };
}

export function maskWebhook(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const prefix = value.slice(0, Math.min(18, value.length));
  return `${prefix}…`;
}

// Strip CR/LF and neutralize Slack/Discord mention syntax so agent-submitted
// strings cannot forge `@channel`, `@everyone`, `@here`, or `<@user>` pings in
// webhook messages — or inject additional header-like lines like
// `Requested by: admin@...`.
export function sanitizeWebhookField(value: string, maxLength = 500) {
  const flattened = value.replace(/[\r\n]+/g, " ");
  const neutralized = flattened
    // Slack mentions: <!channel>, <!here>, <!everyone>, <!subteam^…>, <@U…>, <#C…>
    .replace(/<!(channel|here|everyone)>/gi, "[$1]")
    .replace(/<!subteam\^[^>]*>/gi, "[subteam]")
    .replace(/<@[^>]+>/g, "[user]")
    .replace(/<#[^>]+>/g, "[channel]")
    // Discord mentions: @everyone, @here
    .replace(/@everyone\b/g, "@\u200beveryone")
    .replace(/@here\b/g, "@\u200bhere");
  return neutralized.trim().slice(0, maxLength);
}

export function formatAccessRequestNotification(
  input: NotificationMessageInput,
) {
  return [
    "New AgentKey access request",
    `Organization: ${sanitizeWebhookField(input.organizationName, 200)}`,
    `Agent: ${sanitizeWebhookField(input.agentName, 200)}`,
    `Tool: ${sanitizeWebhookField(input.toolName, 200)}`,
    `Reason: ${sanitizeWebhookField(input.reason, 1000)}`,
    `Requested at: ${input.requestedAt.toISOString()}`,
    `Review in dashboard: ${input.requestsUrl}`,
  ].join("\n");
}

export function formatToolSuggestionNotification(
  input: ToolSuggestionNotificationMessageInput,
) {
  return [
    "New AgentKey tool suggestion",
    `Organization: ${sanitizeWebhookField(input.organizationName, 200)}`,
    `Agent: ${sanitizeWebhookField(input.agentName, 200)}`,
    `Suggested tool: ${sanitizeWebhookField(input.toolName, 200)}`,
    input.toolUrl ? `Tool URL: ${sanitizeWebhookField(input.toolUrl, 500)}` : null,
    `Reason: ${sanitizeWebhookField(input.reason, 1000)}`,
    `Requested at: ${input.requestedAt.toISOString()}`,
    `Review in dashboard: ${input.requestsUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatInstructionSuggestionNotification(
  input: NotificationMessageInput,
) {
  return [
    "New AgentKey instruction suggestion",
    `Organization: ${sanitizeWebhookField(input.organizationName, 200)}`,
    `Agent: ${sanitizeWebhookField(input.agentName, 200)}`,
    `Tool: ${sanitizeWebhookField(input.toolName, 200)}`,
    `Learned: ${sanitizeWebhookField(input.reason, 1000)}`,
    `Requested at: ${input.requestedAt.toISOString()}`,
    `Review in dashboard: ${input.requestsUrl}`,
  ].join("\n");
}

export async function sendNotificationWebhook(
  provider: NotificationProvider,
  webhookUrl: string,
  message: string,
  fetchImpl: typeof fetch = fetch,
) {
  const attemptedAt = new Date();
  const payload =
    provider === "slack" ? { text: message } : { content: message };

  try {
    // Re-validate hostname and allowlist at send time as defense against
    // stored values or DNS changes since the settings were written.
    if (provider === "slack") {
      validateSlackWebhook(webhookUrl);
    } else {
      validateDiscordWebhook(webhookUrl);
    }
    await assertNotPrivateIp(webhookUrl);

    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
      // Reject rather than follow redirects: the allowlisted destination
      // should answer directly; a redirect to anywhere else is either a
      // misconfiguration or a hostile pivot.
      redirect: "error",
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        provider,
        status: "failed",
        error: `HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
        attemptedAt,
      } satisfies NotificationSendResult;
    }

    return {
      provider,
      status: "success",
      error: null,
      attemptedAt,
    } satisfies NotificationSendResult;
  } catch (error) {
    return {
      provider,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown delivery error.",
      attemptedAt,
    } satisfies NotificationSendResult;
  }
}

export async function dispatchAccessRequestNotifications(
  settings: NotificationDispatchSettings,
  input: NotificationDispatchContext,
  fetchImpl: typeof fetch = fetch,
) {
  const requestsUrl = input.requestsUrl;
  const message = formatAccessRequestNotification({
    organizationName: input.organizationName,
    agentName: input.agentName,
    toolName: input.toolName,
    reason: input.reason,
    requestedAt: input.requestedAt,
    requestsUrl,
  });

  const jobs: Array<{
    provider: NotificationProvider;
    promise: Promise<NotificationSendResult>;
  }> = [];

  if (settings.slackWebhook) {
    jobs.push({
      provider: "slack",
      promise: sendNotificationWebhook(
        "slack",
        settings.slackWebhook,
        message,
        fetchImpl,
      ),
    });
  }

  if (settings.discordWebhook) {
    jobs.push({
      provider: "discord",
      promise: sendNotificationWebhook(
        "discord",
        settings.discordWebhook,
        message,
        fetchImpl,
      ),
    });
  }

  const settled = await Promise.allSettled(jobs.map((job) => job.promise));

  return settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      provider: jobs[index].provider,
      status: "failed",
      error:
        result.reason instanceof Error
          ? result.reason.message
          : "Unknown delivery error.",
      attemptedAt: new Date(),
    } satisfies NotificationSendResult;
  });
}

export async function dispatchToolSuggestionNotifications(
  settings: NotificationDispatchSettings,
  input: NotificationDispatchContext & { toolUrl?: string | null },
  fetchImpl: typeof fetch = fetch,
) {
  const message = formatToolSuggestionNotification({
    organizationName: input.organizationName,
    agentName: input.agentName,
    toolName: input.toolName,
    toolUrl: input.toolUrl,
    reason: input.reason,
    requestedAt: input.requestedAt,
    requestsUrl: input.requestsUrl,
  });

  const jobs: Array<{
    provider: NotificationProvider;
    promise: Promise<NotificationSendResult>;
  }> = [];

  if (settings.slackWebhook) {
    jobs.push({
      provider: "slack",
      promise: sendNotificationWebhook(
        "slack",
        settings.slackWebhook,
        message,
        fetchImpl,
      ),
    });
  }

  if (settings.discordWebhook) {
    jobs.push({
      provider: "discord",
      promise: sendNotificationWebhook(
        "discord",
        settings.discordWebhook,
        message,
        fetchImpl,
      ),
    });
  }

  const settled = await Promise.allSettled(jobs.map((job) => job.promise));

  return settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      provider: jobs[index].provider,
      status: "failed",
      error:
        result.reason instanceof Error
          ? result.reason.message
          : "Unknown delivery error.",
      attemptedAt: new Date(),
    } satisfies NotificationSendResult;
  });
}

export async function dispatchInstructionSuggestionNotifications(
  settings: NotificationDispatchSettings,
  input: NotificationDispatchContext,
  fetchImpl: typeof fetch = fetch,
) {
  const message = formatInstructionSuggestionNotification({
    organizationName: input.organizationName,
    agentName: input.agentName,
    toolName: input.toolName,
    reason: input.reason,
    requestedAt: input.requestedAt,
    requestsUrl: input.requestsUrl,
  });

  const jobs: Array<{
    provider: NotificationProvider;
    promise: Promise<NotificationSendResult>;
  }> = [];

  if (settings.slackWebhook) {
    jobs.push({
      provider: "slack",
      promise: sendNotificationWebhook(
        "slack",
        settings.slackWebhook,
        message,
        fetchImpl,
      ),
    });
  }

  if (settings.discordWebhook) {
    jobs.push({
      provider: "discord",
      promise: sendNotificationWebhook(
        "discord",
        settings.discordWebhook,
        message,
        fetchImpl,
      ),
    });
  }

  const settled = await Promise.allSettled(jobs.map((job) => job.promise));

  return settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      provider: jobs[index].provider,
      status: "failed",
      error:
        result.reason instanceof Error
          ? result.reason.message
          : "Unknown delivery error.",
      attemptedAt: new Date(),
    } satisfies NotificationSendResult;
  });
}
