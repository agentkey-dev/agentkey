const ACTION_LABELS: Record<string, string> = {
  "agent.created": "Agent registered",
  "agent.updated": "Agent updated",
  "agent.key_rotated": "API key rotated",
  "agent.suspended": "Agent suspended",
  "tool.created": "Tool added to catalog",
  "tool.deleted": "Tool removed from catalog",
  "tool.updated": "Tool updated",
  "tool.instructions.version_created": "Instruction version created",
  "tool.instructions.restored": "Instruction version restored",
  "tool_suggestion.created": "Tool suggested by agent",
  "tool_suggestion.supported": "Suggestion backed by another agent",
  "tool_suggestion.dismissed": "Suggestion dismissed",
  "tool_suggestion.accepted": "Suggestion accepted",
  "tool_suggestion.auto_resolved": "Suggestion auto-resolved",
  "tool_suggestion.cooldown_rejected": "Suggestion blocked (cooldown)",
  "tool_suggestion.redirected_to_existing_tool": "Suggestion redirected to existing tool",
  "tool_instruction_suggestion.created": "Instruction suggestion created",
  "tool_instruction_suggestion.supported":
    "Instruction suggestion backed by another agent",
  "tool_instruction_suggestion.dismissed": "Instruction suggestion dismissed",
  "tool_instruction_suggestion.accepted": "Instruction suggestion accepted",
  "grant.requested": "Access requested",
  "grant.requested_from_suggestion": "Access request created from suggestion",
  "grant.assigned": "Access assigned",
  "grant.approved": "Access approved",
  "grant.denied": "Access denied",
  "grant.revoked": "Access revoked",
  "credential.vended": "Credential fetched",
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function getActionOptions(): Array<{ value: string; label: string }> {
  return Object.entries(ACTION_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
}
