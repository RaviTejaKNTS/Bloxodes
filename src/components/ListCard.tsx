import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type ListCardProps = {
  displayName: string;
  title: string;
  slug: string;
  coverImage?: string | null;
  updatedAt?: string | null;
  itemsCount?: number | null;
  variant?: "default" | "sidebar";
};

export function ListCard({
  displayName,
  title,
  slug,
  coverImage,
  updatedAt,
  itemsCount: _itemsCount,
  variant = "default"
}: ListCardProps) {
  const updatedLabel = updatedAt ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true }) : null;
  const heroImage = coverImage && coverImage.trim() ? coverImage : "/og-image.png";

  if (variant === "sidebar") {
    return (
      <Link href={`/lists/${slug}`} className="group block">
        <div className="flex items-center gap-3 rounded-lg">
          <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-surface-muted/70 shrink-0">
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroImage}
                alt={displayName || title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-surface to-surface-muted" />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-accent" title={displayName}>
              {displayName || title}
            </h3>
            {updatedLabel ? <p className="text-xs text-muted">Updated {updatedLabel}</p> : null}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/lists/${slug}`}
      className="group block overflow-hidden rounded-lg border border-border/70 bg-card transition-colors hover:border-border"
    >
      <div className="relative aspect-[1200/675] w-full overflow-hidden bg-surface-muted/60">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt={displayName || title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-surface to-surface-muted" />
        )}
        <div className="absolute inset-0 bg-black/20" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/55 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-4">
          {updatedLabel ? (
            <p className="mb-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Updated {updatedLabel}
            </p>
          ) : null}
          <h3 className="mb-0 line-clamp-2 text-lg font-semibold leading-tight text-white drop-shadow-sm" title={displayName}>
            {displayName}
          </h3>
        </div>
      </div>
    </Link>
  );
}
