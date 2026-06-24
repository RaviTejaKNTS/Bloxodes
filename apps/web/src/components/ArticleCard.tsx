import Link from "next/link";
import { FiClock } from "react-icons/fi";
import type { ArticleWithRelations } from "@/lib/db";
import { authorAvatarUrl } from "@/lib/avatar";
import { ContentCard } from "@/components/ContentCard";

type ArticleCardProps = {
  article: ArticleWithRelations & { slug: string };
};

export function ArticleCard({ article }: ArticleCardProps) {
  const universeLabel = article.universe?.display_name ?? article.universe?.name ?? "Roblox";
  const updatedLabel = new Date(article.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const author = article.author;
  const authorName = author?.name?.trim() || author?.name || "Bloxodes";
  const authorAvatar = author ? authorAvatarUrl(author, 48) : "https://www.gravatar.com/avatar/?d=mp";

  return (
    <ContentCard
      type="article"
      href={`/articles/${article.slug}`}
      prefetch={false}
      eyebrow={universeLabel}
      title={article.title}
      image={{ src: article.cover_image, alt: article.title, ratio: "16:9" }}
      imageFallback={
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[rgba(var(--color-accent),0.92)] via-[rgba(var(--color-accent-dark),0.88)] to-[rgba(var(--color-foreground),0.78)] px-4 text-center text-white">
          <span className="line-clamp-2 text-lg font-semibold drop-shadow-sm">
            {article.universe?.display_name ?? article.universe?.name ?? article.title}
          </span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs text-foreground/70">
          <span className="inline-flex items-center gap-2">
            <img
              src={authorAvatar}
              alt={authorName}
              className="h-7 w-7 rounded-full border border-border/60 object-cover"
              loading="lazy"
            />
            {author?.slug ? (
              <Link href={`/authors/${author.slug}`} className="font-semibold text-foreground transition hover:text-accent">
                {authorName}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{authorName}</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <FiClock aria-hidden className="h-3 w-3" />
            <span>{updatedLabel}</span>
          </span>
        </div>
      }
    />
  );
}
