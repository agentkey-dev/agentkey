export function normalizeOrganizationIdentity(input: {
  clerkOrgId: string;
  name: string;
  slug?: string | null;
}) {
  const name = input.name.trim();
  const slug =
    input.slug?.trim().toLowerCase() ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);

  return {
    clerkOrgId: input.clerkOrgId,
    name,
    slug: slug || null,
  };
}

