import {
  createOgImage,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/og-card";

export const runtime = "edge";
export const alt = "AgentKey — Access governance for AI agents";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function OGImage() {
  return createOgImage({
    eyebrow: "AgentKey · Access governance for AI agents",
    title: "Stop hardcoding API keys into your AI agents.",
    description:
      "Human-approved, encrypted credentials for every agent, issued on demand. Free, self-hostable, framework-agnostic.",
    badges: ["Open source (MIT)", "Self-hostable on Vercel", "OpenClaw · Claude Code · Cursor"],
    footer: "agentkey.dev",
  });
}
