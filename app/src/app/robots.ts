import type { MetadataRoute } from "next";

import { getAppOrigin } from "@/lib/origin";

export default function robots(): MetadataRoute.Robots {
  const origin = getAppOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/sign-in", "/sign-up", "/onboarding"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
