import { ImageResponse } from "next/og";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = "image/png";

type CreateOgImageInput = {
  eyebrow: string;
  title: string;
  description: string;
  badges?: string[];
  footer?: string;
};

export function createOgImage({
  eyebrow,
  title,
  description,
  badges = [],
  footer = "agentkey.dev",
}: CreateOgImageInput) {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0e0e10",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "32px",
          }}
        >
          <span
            style={{
              color: "#3B82F6",
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </span>
        </div>

        <div
          style={{
            fontSize: title.length > 40 ? "58px" : "72px",
            fontWeight: 800,
            color: "#e6e4ec",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            marginBottom: "24px",
            display: "flex",
            maxWidth: "980px",
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: "28px",
            color: "#abaab1",
            lineHeight: 1.4,
            maxWidth: "860px",
            marginBottom: "48px",
            display: "flex",
          }}
        >
          {description}
        </div>

        {badges.length > 0 ? (
          <div
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            {badges.map((badge) => (
              <span
                key={badge}
                style={{
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "9999px",
                  padding: "8px 20px",
                  fontSize: "14px",
                  color: "#abaab1",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            bottom: "40px",
            right: "80px",
            fontSize: "16px",
            color: "#47474d",
            display: "flex",
          }}
        >
          {footer}
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
