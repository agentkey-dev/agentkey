export type OrganizationOnboardingInput = {
  totalAgentCount: number;
  toolCount: number;
  onboardingDismissedAt: Date | null;
};

export type OrganizationOnboardingState = {
  agentsDone: boolean;
  toolsDone: boolean;
  completedStepCount: number;
  isComplete: boolean;
  isDismissed: boolean;
  showChecklist: boolean;
  highlightDocsNav: boolean;
};

export function getOrganizationOnboardingState(
  input: OrganizationOnboardingInput,
): OrganizationOnboardingState {
  const agentsDone = input.totalAgentCount > 0;
  const toolsDone = input.toolCount > 0;
  const completedStepCount = [agentsDone, toolsDone].filter(Boolean).length;
  const isComplete = completedStepCount === 2;
  const isDismissed = input.onboardingDismissedAt !== null;
  const showChecklist = !isDismissed && !isComplete;

  return {
    agentsDone,
    toolsDone,
    completedStepCount,
    isComplete,
    isDismissed,
    showChecklist,
    highlightDocsNav: showChecklist,
  };
}
