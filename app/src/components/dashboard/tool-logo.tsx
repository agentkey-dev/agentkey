type ToolLogoProps = {
  logoUrl: string | null;
  name: string;
};

export function ToolLogo({ logoUrl, name }: ToolLogoProps) {
  if (!logoUrl) {
    return null;
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-surface text-sm font-semibold text-on-surface">
      {logoUrl ? (
        // Brandfetch requires direct client-side hotlinking rather than proxying
        // through Next's image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="h-8 w-8 object-contain"
          width="32"
          height="32"
          loading="lazy"
          decoding="async"
          referrerPolicy="origin"
        />
      ) : null}
    </div>
  );
}
