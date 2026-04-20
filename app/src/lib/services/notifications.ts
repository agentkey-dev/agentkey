import { eq } from "drizzle-orm";

import { appendAuditLog } from "@/lib/audit";
import {
  applyNotificationSettingsInput,
  assertValidNotificationSettingsInput,
  dispatchAccessRequestNotifications,
  dispatchInstructionSuggestionNotifications,
  dispatchToolSuggestionNotifications,
  maskWebhook,
  type NotificationSettingsInput,
} from "@/lib/core/notifications";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import {
  organizationNotificationSettings,
  organizations,
} from "@/lib/db/schema";

type Actor = {
  actorId: string;
  actorEmail: string;
};

export async function getNotificationSettings(organizationId: string) {
  const db = getDb();
  const settings = await db.query.organizationNotificationSettings.findFirst({
    where: eq(organizationNotificationSettings.organizationId, organizationId),
  });

  return {
    slackConfigured: Boolean(settings?.slackWebhookEncrypted),
    slackWebhookPreview: maskWebhook(
      settings?.slackWebhookEncrypted
        ? decryptSecret(settings.slackWebhookEncrypted)
        : null,
    ),
    discordConfigured: Boolean(settings?.discordWebhookEncrypted),
    discordWebhookPreview: maskWebhook(
      settings?.discordWebhookEncrypted
        ? decryptSecret(settings.discordWebhookEncrypted)
        : null,
    ),
    lastSlackDeliveryStatus: settings?.lastSlackDeliveryStatus ?? null,
    lastSlackDeliveryAt: settings?.lastSlackDeliveryAt ?? null,
    lastSlackError: settings?.lastSlackError ?? null,
    lastDiscordDeliveryStatus: settings?.lastDiscordDeliveryStatus ?? null,
    lastDiscordDeliveryAt: settings?.lastDiscordDeliveryAt ?? null,
    lastDiscordError: settings?.lastDiscordError ?? null,
  };
}

export async function upsertNotificationSettings(
  organizationId: string,
  input: NotificationSettingsInput,
  actor: Actor,
) {
  const db = getDb();
  await assertValidNotificationSettingsInput(input);

  const existing = await db.query.organizationNotificationSettings.findFirst({
    where: eq(organizationNotificationSettings.organizationId, organizationId),
  });
  const normalized = applyNotificationSettingsInput(input);

  const values = {
    organizationId,
    slackWebhookEncrypted: normalized.clearSlack
      ? null
      : normalized.slackWebhook
        ? encryptSecret(normalized.slackWebhook)
        : existing?.slackWebhookEncrypted ?? null,
    discordWebhookEncrypted: normalized.clearDiscord
      ? null
      : normalized.discordWebhook
        ? encryptSecret(normalized.discordWebhook)
        : existing?.discordWebhookEncrypted ?? null,
    updatedByUserId: actor.actorId,
    updatedByEmail: actor.actorEmail,
    updatedAt: new Date(),
  };

  if (
    !existing &&
    !values.slackWebhookEncrypted &&
    !values.discordWebhookEncrypted
  ) {
    return getNotificationSettings(organizationId);
  }

  if (existing) {
    await db
      .update(organizationNotificationSettings)
      .set(values)
      .where(eq(organizationNotificationSettings.organizationId, organizationId));
  } else {
    await db.insert(organizationNotificationSettings).values({
      ...values,
      createdAt: new Date(),
    });
  }

  await appendAuditLog({
    organizationId,
    actorType: "human",
    actorId: actor.actorId,
    actorLabel: actor.actorEmail,
    action: "notification.settings.updated",
    targetType: "organization_notification_settings",
    targetId: organizationId,
    metadata: {
      slackConfigured:
        !normalized.clearSlack &&
        Boolean(normalized.slackWebhook || existing?.slackWebhookEncrypted),
      discordConfigured:
        !normalized.clearDiscord &&
        Boolean(normalized.discordWebhook || existing?.discordWebhookEncrypted),
    },
  });

  return getNotificationSettings(organizationId);
}

export async function notifyAccessRequestCreated(input: {
  organizationId: string;
  agentId: string;
  agentName: string;
  toolId: string;
  toolName: string;
  reason: string;
  requestId: string;
  requestedAt: Date;
  appOrigin: string;
}) {
  const db = getDb();
  const [organization, settings] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, input.organizationId),
    }),
    db.query.organizationNotificationSettings.findFirst({
      where: eq(organizationNotificationSettings.organizationId, input.organizationId),
    }),
  ]);

  if (!organization || !settings) {
    return;
  }

  const slackWebhook = settings.slackWebhookEncrypted
    ? decryptSecret(settings.slackWebhookEncrypted)
    : null;
  const discordWebhook = settings.discordWebhookEncrypted
    ? decryptSecret(settings.discordWebhookEncrypted)
    : null;

  if (!slackWebhook && !discordWebhook) {
    return;
  }

  const results = await dispatchAccessRequestNotifications(
    {
      slackWebhook,
      discordWebhook,
    },
    {
      organizationId: input.organizationId,
      organizationName: organization.name,
      agentId: input.agentId,
      agentName: input.agentName,
      toolId: input.toolId,
      toolName: input.toolName,
      reason: input.reason,
      requestId: input.requestId,
      requestedAt: input.requestedAt,
      requestsUrl: `${input.appOrigin}/dashboard/requests`,
    },
  );

  for (const result of results) {
    const fieldSet =
      result.provider === "slack"
        ? {
            lastSlackDeliveryStatus: result.status,
            lastSlackDeliveryAt: result.attemptedAt,
            lastSlackError: result.error,
          }
        : {
            lastDiscordDeliveryStatus: result.status,
            lastDiscordDeliveryAt: result.attemptedAt,
            lastDiscordError: result.error,
          };

    await db
      .update(organizationNotificationSettings)
      .set({
        ...fieldSet,
        updatedAt: new Date(),
      })
      .where(eq(organizationNotificationSettings.organizationId, input.organizationId));

    await appendAuditLog({
      organizationId: input.organizationId,
      actorType: "system",
      actorId: "system",
      actorLabel: "System",
      action:
        result.status === "success" ? "notification.sent" : "notification.failed",
      targetType: "access_grant",
      targetId: input.requestId,
      metadata: {
        provider: result.provider,
        requestId: input.requestId,
        agentId: input.agentId,
        toolId: input.toolId,
        error: result.error,
      },
    });
  }
}

export async function notifyToolSuggestionCreated(input: {
  organizationId: string;
  agentId: string;
  agentName: string;
  suggestionId: string;
  toolName: string;
  toolUrl?: string | null;
  reason: string;
  requestedAt: Date;
  appOrigin: string;
}) {
  const db = getDb();
  const [organization, settings] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, input.organizationId),
    }),
    db.query.organizationNotificationSettings.findFirst({
      where: eq(organizationNotificationSettings.organizationId, input.organizationId),
    }),
  ]);

  if (!organization || !settings) {
    return;
  }

  const slackWebhook = settings.slackWebhookEncrypted
    ? decryptSecret(settings.slackWebhookEncrypted)
    : null;
  const discordWebhook = settings.discordWebhookEncrypted
    ? decryptSecret(settings.discordWebhookEncrypted)
    : null;

  if (!slackWebhook && !discordWebhook) {
    return;
  }

  const results = await dispatchToolSuggestionNotifications(
    {
      slackWebhook,
      discordWebhook,
    },
    {
      organizationId: input.organizationId,
      organizationName: organization.name,
      agentId: input.agentId,
      agentName: input.agentName,
      toolId: input.suggestionId,
      toolName: input.toolName,
      toolUrl: input.toolUrl,
      reason: input.reason,
      requestId: input.suggestionId,
      requestedAt: input.requestedAt,
      requestsUrl: `${input.appOrigin}/dashboard/requests`,
    },
  );

  for (const result of results) {
    const fieldSet =
      result.provider === "slack"
        ? {
            lastSlackDeliveryStatus: result.status,
            lastSlackDeliveryAt: result.attemptedAt,
            lastSlackError: result.error,
          }
        : {
            lastDiscordDeliveryStatus: result.status,
            lastDiscordDeliveryAt: result.attemptedAt,
            lastDiscordError: result.error,
          };

    await db
      .update(organizationNotificationSettings)
      .set({
        ...fieldSet,
        updatedAt: new Date(),
      })
      .where(eq(organizationNotificationSettings.organizationId, input.organizationId));

    await appendAuditLog({
      organizationId: input.organizationId,
      actorType: "system",
      actorId: "system",
      actorLabel: "System",
      action:
        result.status === "success" ? "notification.sent" : "notification.failed",
      targetType: "tool_suggestion",
      targetId: input.suggestionId,
      metadata: {
        provider: result.provider,
        suggestionId: input.suggestionId,
        agentId: input.agentId,
        toolName: input.toolName,
        error: result.error,
      },
    });
  }
}

export async function notifyInstructionSuggestionCreated(input: {
  organizationId: string;
  agentId: string;
  agentName: string;
  suggestionId: string;
  toolId: string;
  toolName: string;
  learned: string;
  requestedAt: Date;
  appOrigin: string;
}) {
  const db = getDb();
  const [organization, settings] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, input.organizationId),
    }),
    db.query.organizationNotificationSettings.findFirst({
      where: eq(organizationNotificationSettings.organizationId, input.organizationId),
    }),
  ]);

  if (!organization || !settings) {
    return;
  }

  const slackWebhook = settings.slackWebhookEncrypted
    ? decryptSecret(settings.slackWebhookEncrypted)
    : null;
  const discordWebhook = settings.discordWebhookEncrypted
    ? decryptSecret(settings.discordWebhookEncrypted)
    : null;

  if (!slackWebhook && !discordWebhook) {
    return;
  }

  const results = await dispatchInstructionSuggestionNotifications(
    {
      slackWebhook,
      discordWebhook,
    },
    {
      organizationId: input.organizationId,
      organizationName: organization.name,
      agentId: input.agentId,
      agentName: input.agentName,
      toolId: input.toolId,
      toolName: input.toolName,
      reason: input.learned,
      requestId: input.suggestionId,
      requestedAt: input.requestedAt,
      requestsUrl: `${input.appOrigin}/dashboard/requests`,
    },
  );

  for (const result of results) {
    const fieldSet =
      result.provider === "slack"
        ? {
            lastSlackDeliveryStatus: result.status,
            lastSlackDeliveryAt: result.attemptedAt,
            lastSlackError: result.error,
          }
        : {
            lastDiscordDeliveryStatus: result.status,
            lastDiscordDeliveryAt: result.attemptedAt,
            lastDiscordError: result.error,
          };

    await db
      .update(organizationNotificationSettings)
      .set({
        ...fieldSet,
        updatedAt: new Date(),
      })
      .where(eq(organizationNotificationSettings.organizationId, input.organizationId));

    await appendAuditLog({
      organizationId: input.organizationId,
      actorType: "system",
      actorId: "system",
      actorLabel: "System",
      action:
        result.status === "success" ? "notification.sent" : "notification.failed",
      targetType: "tool_instruction_suggestion",
      targetId: input.suggestionId,
      metadata: {
        provider: result.provider,
        suggestionId: input.suggestionId,
        agentId: input.agentId,
        toolId: input.toolId,
        error: result.error,
      },
    });
  }
}
