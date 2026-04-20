export type BlogPostSlug = "tools-are-access";

export type BlogPostMetadata = {
  slug: BlogPostSlug;
  path: `/blog/${BlogPostSlug}`;
  title: string;
  metaTitle: string;
  description: string;
  excerpt: string;
  publishedAt: string;
  relatedSlugs: BlogPostSlug[];
};

export const blogPosts: readonly BlogPostMetadata[] = [
  {
    slug: "tools-are-access",
    path: "/blog/tools-are-access",
    title: "Tools Aren't Just Code. They're Access.",
    metaTitle: "Tools Aren't Just Code. They're Access. — AgentKey Blog",
    description:
      "Why AI agents need an access governance layer, not just more function definitions. The case for treating tools as credentials plus context, not code.",
    excerpt:
      "Every framework treats tools like functions. They aren't — they're access to things that can spend money and move data. Here's why that framing matters.",
    publishedAt: "2026-03-29",
    relatedSlugs: [],
  },
] as const;

const blogPostsBySlug = new Map(blogPosts.map((post) => [post.slug, post]));

export function getBlogPostMetadata(slug: BlogPostSlug) {
  const post = blogPostsBySlug.get(slug);

  if (!post) {
    throw new Error(`Unknown blog post slug: ${slug}`);
  }

  return post;
}

export function formatBlogPostDate(isoDate: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
