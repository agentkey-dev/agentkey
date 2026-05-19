import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = (name = "id") =>
  text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const date = (name: string) => integer(name, { mode: "timestamp_ms" });

const requiredDate = (name: string) =>
  date(name)
    .notNull()
    .$defaultFn(() => new Date());

const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

const enumValues = <const T extends readonly string[]>(values: T) => ({
  enumValues: values,
});

export const agentStatusEnum = enumValues(["active", "suspended"] as const);
export const toolAuthTypeEnum = enumValues([
  "api_key",
  "oauth_token",
  "bot_token",
  "other",
] as const);
export const toolCredentialModeEnum = enumValues(["shared", "per_agent"] as const);
export const accessGrantStatusEnum = enumValues([
  "pending",
  "approved",
  "denied",
  "revoked",
] as const);
export const toolSuggestionStatusEnum = enumValues([
  "pending",
  "dismissed",
  "accepted",
] as const);
export const toolInstructionVersionSourceEnum = enumValues([
  "manual",
  "suggestion_accept",
  "restore",
  "tool_create",
  "backfill",
] as const);
export const toolInstructionSuggestionStatusEnum = enumValues([
  "pending",
  "dismissed",
  "accepted",
] as const);
export const auditActorTypeEnum = enumValues([
  "agent",
  "human",
  "system",
] as const);
export const notificationDeliveryStatusEnum = enumValues([
  "success",
  "failed",
] as const);

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name"),
    legacyClerkUserId: text("legacy_clerk_user_id"),
    lastSignedInAt: date("last_signed_in_at"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    emailIndex: uniqueIndex("users_email_idx").on(table.email),
    legacyClerkUserIdIndex: uniqueIndex("users_legacy_clerk_user_id_idx").on(
      table.legacyClerkUserId,
    ),
  }),
);

export const organizations = sqliteTable(
  "organizations",
  {
    id: id(),
    legacyClerkOrgId: text("legacy_clerk_org_id"),
    name: text("name").notNull(),
    slug: text("slug"),
    onboardingDismissedAt: date("onboarding_dismissed_at"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    legacyClerkOrgIdIndex: uniqueIndex("organizations_legacy_clerk_org_id_idx").on(
      table.legacyClerkOrgId,
    ),
  }),
);

export const organizationMemberships = sqliteTable(
  "organization_memberships",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin"] }).notNull().default("admin"),
    legacyClerkMembershipId: text("legacy_clerk_membership_id"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    organizationIndex: index("organization_memberships_organization_id_idx").on(
      table.organizationId,
    ),
    userIndex: index("organization_memberships_user_id_idx").on(table.userId),
    organizationUserIndex: uniqueIndex(
      "organization_memberships_organization_user_idx",
    ).on(table.organizationId, table.userId),
  }),
);

export const organizationInvites = sqliteTable(
  "organization_invites",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acceptedAt: date("accepted_at"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    organizationEmailIndex: uniqueIndex("organization_invites_org_email_idx").on(
      table.organizationId,
      table.email,
    ),
  }),
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    selectedOrganizationId: text("selected_organization_id").references(
      () => organizations.id,
      { onDelete: "set null" },
    ),
    expiresAt: date("expires_at").notNull(),
    revokedAt: date("revoked_at"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    tokenHashIndex: uniqueIndex("auth_sessions_token_hash_idx").on(
      table.tokenHash,
    ),
    userIndex: index("auth_sessions_user_id_idx").on(table.userId),
  }),
);

export const authLoginTokens = sqliteTable(
  "auth_login_tokens",
  {
    id: id(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    turnstilePassed: integer("turnstile_passed", { mode: "boolean" })
      .notNull()
      .default(false),
    expiresAt: date("expires_at").notNull(),
    consumedAt: date("consumed_at"),
    createdAt: requiredDate("created_at"),
  },
  (table) => ({
    tokenHashIndex: uniqueIndex("auth_login_tokens_token_hash_idx").on(
      table.tokenHash,
    ),
    emailCreatedIndex: index("auth_login_tokens_email_created_idx").on(
      table.email,
      table.createdAt,
    ),
  }),
);

export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    windowStart: integer("window_start").notNull(),
    windowMs: integer("window_ms").notNull(),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    updatedAtIndex: index("rate_limit_buckets_updated_at_idx").on(table.updatedAt),
  }),
);

export const agents = sqliteTable(
  "agents",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    apiKeyHash: text("api_key_hash").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    status: text("status", { enum: agentStatusEnum.enumValues })
      .notNull()
      .default("active"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    organizationIndex: index("agents_organization_id_idx").on(
      table.organizationId,
    ),
    apiKeyHashIndex: uniqueIndex("agents_api_key_hash_idx").on(table.apiKeyHash),
  }),
);

export const tools = sqliteTable(
  "tools",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    configKey: text("config_key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    url: text("url"),
    authType: text("auth_type", { enum: toolAuthTypeEnum.enumValues }).notNull(),
    credentialMode: text("credential_mode", {
      enum: toolCredentialModeEnum.enumValues,
    }).notNull(),
    credentialEncrypted: text("credential_encrypted"),
    credentialLastRotatedAt: date("credential_last_rotated_at"),
    credentialExpiresAt: date("credential_expires_at"),
    instructions: text("instructions"),
    currentInstructionVersionId: text("current_instruction_version_id"),
    addedByUserId: text("added_by_user_id").notNull(),
    addedByEmail: text("added_by_email").notNull(),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    organizationIndex: index("tools_organization_id_idx").on(table.organizationId),
    organizationConfigKeyIndex: uniqueIndex("tools_organization_config_key_idx").on(
      table.organizationId,
      table.configKey,
    ),
  }),
);

export const toolInstructionVersions = sqliteTable(
  "tool_instruction_versions",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    toolId: text("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    instructions: text("instructions").notNull(),
    source: text("source", {
      enum: toolInstructionVersionSourceEnum.enumValues,
    }).notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: requiredDate("created_at"),
  },
  (table) => ({
    organizationIndex: index("tool_instruction_versions_organization_id_idx").on(
      table.organizationId,
    ),
    toolIndex: index("tool_instruction_versions_tool_id_idx").on(table.toolId),
    toolCreatedIndex: index("tool_instruction_versions_tool_created_idx").on(
      table.toolId,
      table.createdAt,
    ),
  }),
);

export const accessGrants = sqliteTable(
  "access_grants",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    toolId: text("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    status: text("status", { enum: accessGrantStatusEnum.enumValues })
      .notNull()
      .default("pending"),
    reason: text("reason"),
    denialReason: text("denial_reason"),
    credentialEncrypted: text("credential_encrypted"),
    requestedAt: requiredDate("requested_at"),
    decidedByUserId: text("decided_by_user_id"),
    decidedByEmail: text("decided_by_email"),
    decidedAt: date("decided_at"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    organizationIndex: index("access_grants_organization_id_idx").on(
      table.organizationId,
    ),
    agentIndex: index("access_grants_agent_id_idx").on(table.agentId),
    toolIndex: index("access_grants_tool_id_idx").on(table.toolId),
    agentToolIndex: uniqueIndex("access_grants_agent_tool_idx").on(
      table.agentId,
      table.toolId,
    ),
  }),
);

export const toolInstructionSuggestions = sqliteTable(
  "tool_instruction_suggestions",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    toolId: text("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    baseVersionId: text("base_version_id")
      .notNull()
      .references(() => toolInstructionVersions.id, { onDelete: "cascade" }),
    learned: text("learned").notNull(),
    normalizedLearned: text("normalized_learned").notNull(),
    status: text("status", {
      enum: toolInstructionSuggestionStatusEnum.enumValues,
    })
      .notNull()
      .default("pending"),
    dismissalReason: text("dismissal_reason"),
    acceptedVersionId: text("accepted_version_id").references(
      () => toolInstructionVersions.id,
      { onDelete: "set null" },
    ),
    decidedByUserId: text("decided_by_user_id"),
    decidedByEmail: text("decided_by_email"),
    decidedAt: date("decided_at"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    organizationIndex: index(
      "tool_instruction_suggestions_organization_id_idx",
    ).on(table.organizationId),
    organizationStatusIndex: index(
      "tool_instruction_suggestions_organization_status_idx",
    ).on(table.organizationId, table.status),
    toolBaseVersionIndex: index(
      "tool_instruction_suggestions_tool_base_version_idx",
    ).on(table.toolId, table.baseVersionId),
    dedupeIndex: uniqueIndex("tool_instruction_suggestions_dedupe_idx").on(
      table.organizationId,
      table.toolId,
      table.baseVersionId,
      table.normalizedLearned,
    ),
  }),
);

export const toolInstructionSuggestionAgents = sqliteTable(
  "tool_instruction_suggestion_agents",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    suggestionId: text("suggestion_id")
      .notNull()
      .references(() => toolInstructionSuggestions.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    latestWhy: text("latest_why").notNull(),
    firstRequestedAt: requiredDate("first_requested_at"),
    lastRequestedAt: requiredDate("last_requested_at"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    organizationIndex: index(
      "tool_instruction_suggestion_agents_organization_id_idx",
    ).on(table.organizationId),
    suggestionIndex: index(
      "tool_instruction_suggestion_agents_suggestion_id_idx",
    ).on(table.suggestionId),
    agentIndex: index("tool_instruction_suggestion_agents_agent_id_idx").on(
      table.agentId,
    ),
    suggestionAgentIndex: uniqueIndex(
      "tool_instruction_suggestion_agents_suggestion_agent_idx",
    ).on(table.suggestionId, table.agentId),
  }),
);

export const toolSuggestions = sqliteTable(
  "tool_suggestions",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    url: text("url"),
    normalizedDomain: text("normalized_domain"),
    status: text("status", { enum: toolSuggestionStatusEnum.enumValues })
      .notNull()
      .default("pending"),
    dismissedUntil: date("dismissed_until"),
    convertedToolId: text("converted_tool_id").references(() => tools.id, {
      onDelete: "set null",
    }),
    decidedByUserId: text("decided_by_user_id"),
    decidedByEmail: text("decided_by_email"),
    decidedAt: date("decided_at"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    organizationIndex: index("tool_suggestions_organization_id_idx").on(
      table.organizationId,
    ),
    organizationStatusIndex: index("tool_suggestions_organization_status_idx").on(
      table.organizationId,
      table.status,
    ),
    organizationDomainIndex: index("tool_suggestions_organization_domain_idx").on(
      table.organizationId,
      table.normalizedDomain,
    ),
    organizationNameIndex: index("tool_suggestions_organization_name_idx").on(
      table.organizationId,
      table.normalizedName,
    ),
  }),
);

export const toolSuggestionAgents = sqliteTable(
  "tool_suggestion_agents",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    suggestionId: text("suggestion_id")
      .notNull()
      .references(() => toolSuggestions.id, { onDelete: "cascade" }),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    latestReason: text("latest_reason").notNull(),
    firstRequestedAt: requiredDate("first_requested_at"),
    lastRequestedAt: requiredDate("last_requested_at"),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    organizationIndex: index("tool_suggestion_agents_organization_id_idx").on(
      table.organizationId,
    ),
    suggestionIndex: index("tool_suggestion_agents_suggestion_id_idx").on(
      table.suggestionId,
    ),
    agentIndex: index("tool_suggestion_agents_agent_id_idx").on(table.agentId),
    suggestionAgentIndex: uniqueIndex(
      "tool_suggestion_agents_suggestion_agent_idx",
    ).on(table.suggestionId, table.agentId),
  }),
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorType: text("actor_type", { enum: auditActorTypeEnum.enumValues }).notNull(),
    actorId: text("actor_id").notNull(),
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: json<Record<string, unknown> | null>("metadata"),
    createdAt: requiredDate("created_at"),
  },
  (table) => ({
    organizationCreatedIndex: index("audit_log_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    actionIndex: index("audit_log_action_idx").on(table.action),
    targetIndex: index("audit_log_target_idx").on(table.targetId),
  }),
);

export const organizationNotificationSettings = sqliteTable(
  "organization_notification_settings",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slackWebhookEncrypted: text("slack_webhook_encrypted"),
    discordWebhookEncrypted: text("discord_webhook_encrypted"),
    lastSlackDeliveryStatus: text("last_slack_delivery_status", {
      enum: notificationDeliveryStatusEnum.enumValues,
    }),
    lastSlackDeliveryAt: date("last_slack_delivery_at"),
    lastSlackError: text("last_slack_error"),
    lastDiscordDeliveryStatus: text("last_discord_delivery_status", {
      enum: notificationDeliveryStatusEnum.enumValues,
    }),
    lastDiscordDeliveryAt: date("last_discord_delivery_at"),
    lastDiscordError: text("last_discord_error"),
    updatedByUserId: text("updated_by_user_id").notNull(),
    updatedByEmail: text("updated_by_email").notNull(),
    createdAt: requiredDate("created_at"),
    updatedAt: requiredDate("updated_at"),
  },
  (table) => ({
    updatedAtIndex: index("organization_notification_settings_updated_at_idx").on(
      table.updatedAt,
    ),
  }),
);

export const nowSql = sql`(unixepoch() * 1000)`;

export type AgentStatus = (typeof agentStatusEnum.enumValues)[number];
export type ToolAuthType = (typeof toolAuthTypeEnum.enumValues)[number];
export type ToolCredentialMode =
  (typeof toolCredentialModeEnum.enumValues)[number];
export type AccessGrantStatus =
  (typeof accessGrantStatusEnum.enumValues)[number];
export type ToolSuggestionStatus =
  (typeof toolSuggestionStatusEnum.enumValues)[number];
export type ToolInstructionVersionSource =
  (typeof toolInstructionVersionSourceEnum.enumValues)[number];
export type ToolInstructionSuggestionStatus =
  (typeof toolInstructionSuggestionStatusEnum.enumValues)[number];
export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];
export type NotificationDeliveryStatus =
  (typeof notificationDeliveryStatusEnum.enumValues)[number];
