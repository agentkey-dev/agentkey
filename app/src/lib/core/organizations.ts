export function normalizeOrganizationIdentity(input: {
  legacyProviderOrgId?: string | null;
  legacyClerkOrgId?: string | null;
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
    legacyClerkOrgId:
      input.legacyClerkOrgId ?? input.legacyProviderOrgId ?? null,
    name,
    slug: slug || null,
  };
}
