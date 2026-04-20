import {
  createOgImage,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
} from "@/lib/og-card";

export const runtime = "edge";
export const alt = "Security — AgentKey";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function SecurityOgImage() {
  return createOgImage({
    eyebrow: "Security",
    title: "How AgentKey protects credentials",
    description:
      "AES-256-GCM encryption, audit logging, rate limiting, and responsible disclosure for agent access governance.",
    badges: ["AES-256-GCM", "Audit Logging", "Responsible Disclosure"],
  });
}
