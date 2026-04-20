export function normalizeToolInstructionLearned(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildInstructionSuggestionDraft(
  currentInstructions: string | null | undefined,
  learned: string,
) {
  const nextLearned = learned.trim();
  const current = (currentInstructions ?? "").trim();

  if (!current) {
    return nextLearned;
  }

  if (!nextLearned) {
    return current;
  }

  return `${current}\n\n${nextLearned}`;
}
