import type { MetadataRoute } from "next";

import { blogPosts } from "@/lib/blog";
import { getAppOrigin } from "@/lib/origin";

const staticRoutes = ["/", "/blog", "/security", "/legal/privacy", "/legal/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getAppOrigin();

  const staticEntries = staticRoutes.map((route) => ({
    url: `${origin}${route}`,
  }));

  const blogEntries = blogPosts.map((post) => ({
    url: `${origin}${post.path}`,
    lastModified: post.publishedAt,
  }));

  return [...staticEntries, ...blogEntries];
}
