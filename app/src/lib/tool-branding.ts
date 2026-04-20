const HTTP_PROTOCOL_RE = /^https?:\/\//i;

function tryParseToolUrl(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = HTTP_PROTOCOL_RE.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function normalizeToolUrl(value: string | null | undefined) {
  const parsed = tryParseToolUrl(value);

  return parsed?.toString();
}

export function getToolDomain(value: string | null | undefined) {
  const parsed = tryParseToolUrl(value);

  if (!parsed) {
    return null;
  }

  return parsed.hostname.replace(/^www\./i, "");
}

export function getBrandfetchLogoUrl(
  value: string | null | undefined,
  clientId: string | undefined,
) {
  const domain = getToolDomain(value);

  if (!domain || !clientId) {
    return null;
  }

  const params = new URLSearchParams({ c: clientId });

  return `https://cdn.brandfetch.io/${encodeURIComponent(domain)}?${params.toString()}`;
}
