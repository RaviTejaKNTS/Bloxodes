export function CollectionImagePlaceholder({ title, compact = false }: { title: string; compact?: boolean }) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => (word.match(/[A-Za-z0-9]/)?.[0] ?? "").toUpperCase())
    .filter(Boolean)
    .join("");

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-muted/70 px-4 text-center">
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-md border border-border/70 bg-background/80 font-semibold text-muted ${
          compact ? "h-14 w-14 text-base" : "h-20 w-20 text-2xl"
        }`}
      >
        {initials || "?"}
      </span>
      <span className={`${compact ? "sr-only" : "line-clamp-2 text-xs font-semibold leading-snug text-muted"}`}>
        {title}
      </span>
    </div>
  );
}
