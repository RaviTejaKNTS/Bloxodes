import type { CodePageWithCounts } from "@/lib/db";
import { FiClock } from "react-icons/fi";
import { ContentCard } from "@/components/ContentCard";
import { formatUpdatedLabel } from "@/lib/updated-label";

type GameCardProps = {
  game: CodePageWithCounts;
  className?: string;
  titleAs?: "h2" | "p";
  priority?: boolean;
  articleUpdatedAt?: string | null;
};

export function GameCard({ game, className, titleAs = "h2", priority, articleUpdatedAt }: GameCardProps) {
  const updatedLabel = formatUpdatedLabel(articleUpdatedAt);

  return (
    <ContentCard
      type="codes"
      href={`/codes/${game.slug}`}
      prefetch={false}
      className={className}
      titleAs={titleAs}
      title={`${game.name} Codes`}
      image={{ src: game.cover_image, alt: game.name, ratio: "16:9", priority }}
      imageFallback={
        <div className="absolute inset-0 bg-gradient-to-br from-[rgba(var(--color-accent),0.85)] via-[rgba(var(--color-accent-dark),0.7)] to-[rgba(var(--color-foreground),0.55)]" />
      }
      meta={
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
      }
    />
  );
}
