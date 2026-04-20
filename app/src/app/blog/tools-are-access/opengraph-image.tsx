import {
  createOgImage,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/og-card";

export const runtime = "edge";
export const alt = "Tools Aren't Just Code. They're Access. — AgentKey Blog";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function ToolsAreAccessOgImage() {
  return createOgImage({
    eyebrow: "AgentKey Blog",
    title: "Tools Aren't Just Code. They're Access.",
    description:
      "Why AI agents need an access governance layer, not just more function definitions.",
    badges: ["Agent Governance", "Credential Vending", "Human Approval"],
  });
}
