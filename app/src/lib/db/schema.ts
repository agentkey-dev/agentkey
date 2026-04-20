import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const agentStatusEnum = pgEnum("agent_status", ["active", "suspended"]);
export const toolAuthTypeEnum = pgEnum("tool_auth_type", [
  "api_key",
  "oauth_token",
  "bot_token",
  "other",
]);
export const toolCredentialModeEnum = pgEnum("tool_credential_mode", [
  "shared",
  "per_agent",
]);
export const accessGrantStatusEnum = pgEnum("access_grant_status", [
  "pending",
  "approved",
  "denied",
  "revoked",
]);
export const toolSuggestionStatusEnum = pgEnum("tool_suggestion_status", [
  "pending",
  "dismissed",
  "accepted",
]);
export const toolInstructionVersionSourceEnum = pgEnum(
  "tool_instruction_version_source",
  ["manual", "suggestion_accept", "restore", "tool_create", "backfill"],
);
export const toolInstructionSuggestionStatusEnum = pgEnum(
  "tool_instruction_suggestion_status",
  ["pending", "dismissed", "accepted"],
);
export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "agent",
  "human",
  "system",
]);
export const notificationDeliveryStatusEnum = pgEnum(
  "notification_delivery_status",
  ["success", "failed"],
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkOrgId: text("clerk_org_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug"),
    onboardingDismissedAt: timestamp("onboarding_dismissed_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    clerkOrgIdIndex: uniqueIndex("organizations_clerk_org_id_idx").on(
      table.clerkOrgId,
    ),
  }),
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    apiKeyHash: text("api_key_hash").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    status: agentStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationIndex: index("agents_organization_id_idx").on(
      table.organizationId,
    ),
    apiKeyHashIndex: uniqueIndex("agents_api_key_hash_idx").on(table.apiKeyHash),
  }),
);

export const tools = pgTable(
  "tools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    configKey: text("config_key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    url: text("url"),
    authType: toolAuthTypeEnum("auth_type").notNull(),
    credentialMode: toolCredentialModeEnum("credential_mode").notNull(),
    credentialEncrypted: text("credential_encrypted"),
    credentialLastRotatedAt: timestamp("credential_last_rotated_at", {
      withTimezone: true,
    }),
    credentialExpiresAt: timestamp("credential_expires_at", {
      withTimezone: true,
    }),
    instructions: text("instructions"),
    currentInstructionVersionId: uuid("current_instruction_version_id"),
    addedByUserId: text("added_by_user_id").notNull(),
    addedByEmail: text("added_by_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationIndex: index("tools_organization_id_idx").on(table.organizationId),
    organizationConfigKeyIndex: uniqueIndex("tools_organization_config_key_idx").on(
      table.organizationId,
      table.configKey,
    ),
  }),
);

export const toolInstructionVersions = pgTable(
  "tool_instruction_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    instructions: text("instructions").notNull(),
    source: toolInstructionVersionSourceEnum("source").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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

export const accessGrants = pgTable(
  "access_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    status: accessGrantStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    denialReason: text("denial_reason"),
    credentialEncrypted: text("credential_encrypted"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    decidedByUserId: text("decided_by_user_id"),
    decidedByEmail: text("decided_by_email"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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

export const toolInstructionSuggestions = pgTable(
  "tool_instruction_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    baseVersionId: uuid("base_version_id")
      .notNull()
      .references(() => toolInstructionVersions.id, { onDelete: "cascade" }),
    learned: text("learned").notNull(),
    normalizedLearned: text("normalized_learned").notNull(),
    status: toolInstructionSuggestionStatusEnum("status")
      .notNull()
      .default("pending"),
    dismissalReason: text("dismissal_reason"),
    acceptedVersionId: uuid("accepted_version_id").references(
      () => toolInstructionVersions.id,
      { onDelete: "set null" },
    ),
    decidedByUserId: text("decided_by_user_id"),
    decidedByEmail: text("decided_by_email"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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
    dedupeIndex: uniqueIndex(
      "tool_instruction_suggestions_dedupe_idx",
    ).on(
      table.organizationId,
      table.toolId,
      table.baseVersionId,
      table.normalizedLearned,
    ),
  }),
);

export const toolInstructionSuggestionAgents = pgTable(
  "tool_instruction_suggestion_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    suggestionId: uuid("suggestion_id")
      .notNull()
      .references(() => toolInstructionSuggestions.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    latestWhy: text("latest_why").notNull(),
    firstRequestedAt: timestamp("first_requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastRequestedAt: timestamp("last_requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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

export const toolSuggestions = pgTable(
  "tool_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    url: text("url"),
    normalizedDomain: text("normalized_domain"),
    status: toolSuggestionStatusEnum("status").notNull().default("pending"),
    dismissedUntil: timestamp("dismissed_until", { withTimezone: true }),
    convertedToolId: uuid("converted_tool_id").references(() => tools.id, {
      onDelete: "set null",
    }),
    decidedByUserId: text("decided_by_user_id"),
    decidedByEmail: text("decided_by_email"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    organizationIndex: index("tool_suggestions_organization_id_idx").on(
      table.organizationId,
    ),
    organizationStatusIndex: index(
      "tool_suggestions_organization_status_idx",
    ).on(table.organizationId, table.status),
    organizationDomainIndex: index(
      "tool_suggestions_organization_domain_idx",
    ).on(table.organizationId, table.normalizedDomain),
    organizationNameIndex: index(
      "tool_suggestions_organization_name_idx",
    ).on(table.organizationId, table.normalizedName),
  }),
);

export const toolSuggestionAgents = pgTable(
  "tool_suggestion_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    suggestionId: uuid("suggestion_id")
      .notNull()
      .references(() => toolSuggestions.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    latestReason: text("latest_reason").notNull(),
    firstRequestedAt: timestamp("first_requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastRequestedAt: timestamp("last_requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorType: auditActorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
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

export const organizationNotificationSettings = pgTable(
  "organization_notification_settings",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slackWebhookEncrypted: text("slack_webhook_encrypted"),
    discordWebhookEncrypted: text("discord_webhook_encrypted"),
    lastSlackDeliveryStatus: notificationDeliveryStatusEnum(
      "last_slack_delivery_status",
    ),
    lastSlackDeliveryAt: timestamp("last_slack_delivery_at", {
      withTimezone: true,
    }),
    lastSlackError: text("last_slack_error"),
    lastDiscordDeliveryStatus: notificationDeliveryStatusEnum(
      "last_discord_delivery_status",
    ),
    lastDiscordDeliveryAt: timestamp("last_discord_delivery_at", {
      withTimezone: true,
    }),
    lastDiscordError: text("last_discord_error"),
    updatedByUserId: text("updated_by_user_id").notNull(),
    updatedByEmail: text("updated_by_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    updatedAtIndex: index("organization_notification_settings_updated_at_idx").on(
      table.updatedAt,
    ),
  }),
);

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
