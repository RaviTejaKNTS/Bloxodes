import Image from "next/image";
import Link from "next/link";
import type { CodePageWithCounts } from "@/lib/db";
import { FiClock } from "react-icons/fi";
import { formatUpdatedLabel } from "@/lib/updated-label";

const baseCardClass =
  "group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-none transition-colors";
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTAwMCcgaGVpZ2h0PSc1NjInIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHJlY3Qgd2lkdGg9JzEwMDAnIGhlaWdodD0nNTYyJyBmaWxsPSdyZ2JhKDQ4LDUwLDU4LDAuMyknIC8+PC9zdmc+";

type GameCardProps = {
  game: CodePageWithCounts;
  className?: string;
  titleAs?: "h2" | "p";
  priority?: boolean;
  articleUpdatedAt?: string | null;
};

export function GameCard({
  game,
  className,
  titleAs: Title = "h2",
  priority,
  articleUpdatedAt,
}: GameCardProps) {
  const classes = className ? `${baseCardClass} ${className}` : baseCardClass;
  const updatedLabel = formatUpdatedLabel(articleUpdatedAt);
  const hasCover = Boolean(game.cover_image);
  const coverSrc =
    hasCover && game.cover_image
      ? game.cover_image.startsWith("http")
        ? game.cover_image
        : `/` + game.cover_image.replace(/^\//, "")
      : null;

  return (
    <Link
      href={`/codes/${game.slug}`}
      prefetch={false}
      className={`${classes} hover:border-border`}
    >
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-surface-muted">
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={game.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            loading={priority ? undefined : "lazy"}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(var(--color-accent),0.85)] via-[rgba(var(--color-accent-dark),0.7)] to-[rgba(var(--color-foreground),0.55)]" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card via-card/70 to-transparent" />
      </div>
      <div className="relative -mt-1 space-y-2 bg-card px-4 pb-4 pt-3">
        <Title className="mb-0 line-clamp-2 text-lg font-semibold leading-snug text-foreground">
          {game.name} Codes
        </Title>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/70">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-400" aria-hidden />
            <span>
              {game.active_count} {game.active_count === 1 ? "active code" : "active codes"}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <FiClock aria-hidden className="h-3 w-3" />
            <span>{updatedLabel ?? "recently"}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
