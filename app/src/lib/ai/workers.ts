import { createWorkersAI } from "workers-ai-provider";

import { getCloudflareEnv } from "@/lib/db/client";
import { getOptionalAiDraftModel } from "@/lib/env";

type WorkersAiChatSettings = NonNullable<
  Parameters<ReturnType<typeof createWorkersAI>>[1]
>;
type KimiChatTemplateKwargs =
  NonNullable<WorkersAiChatSettings["chat_template_kwargs"]> & {
    thinking?: boolean;
  };
type AiDraftModelSettings = Omit<
  WorkersAiChatSettings,
  "chat_template_kwargs"
> & {
  chat_template_kwargs?: KimiChatTemplateKwargs;
};

export const DEFAULT_AI_DRAFT_MODEL = "@cf/moonshotai/kimi-k2.6";

export function getAiDraftModel() {
  return getOptionalAiDraftModel() ?? DEFAULT_AI_DRAFT_MODEL;
}

export function getAiDraftModelSettings(
  model = getAiDraftModel(),
): AiDraftModelSettings {
  if (model === "@cf/moonshotai/kimi-k2.6") {
    return { chat_template_kwargs: { thinking: true } };
  }

  if (model.includes("gpt-oss")) {
    return { reasoning_effort: "medium" };
  }

  return {};
}

export function getWorkersAiModel() {
  const env = getCloudflareEnv();

  if (!("AI" in env) || !env.AI) {
    throw new Error("Cloudflare Workers AI binding AI is not available.");
  }

  const workersAi = createWorkersAI({ binding: env.AI });
  const model = getAiDraftModel();
  return workersAi(model, getAiDraftModelSettings(model));
}
