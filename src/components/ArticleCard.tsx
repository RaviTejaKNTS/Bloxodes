import Image from "next/image";
import Link from "next/link";
import { FiClock } from "react-icons/fi";
import type { ArticleWithRelations } from "@/lib/db";
import { authorAvatarUrl } from "@/lib/avatar";

const BASE_CLASS =
  "group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-none transition-colors";

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTIwMCcgaGVpZ2h0PSc2NzUnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHJlY3Qgd2lkdGg9JzEyMDAnIGhlaWdodD0nNjc1JyBmaWxsPSdyZ2JhKDQ4LDUwLDU4LDAuMyknIC8+PC9zdmc+";

type ArticleCardProps = {
  article: ArticleWithRelations & { slug: string };
};

export function ArticleCard({ article }: ArticleCardProps) {
  const hasCover = Boolean(article.cover_image);
  const coverImage = hasCover
    ? article.cover_image!
    : null;
  const normalizedCover =
    coverImage && coverImage.startsWith("http")
      ? coverImage
      : coverImage?.startsWith("/")
        ? coverImage
        : coverImage
          ? `/${coverImage}`
          : null;
  const updatedLabel = new Date(article.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const author = article.author;
  const authorAvatar = author ? authorAvatarUrl(author, 48) : "https://www.gravatar.com/avatar/?d=mp";

  return (
    <div className={`${BASE_CLASS} hover:border-border`}>
      <Link href={`/articles/${article.slug}`} prefetch={false} className="flex flex-1 flex-col">
        <div className="relative aspect-[16/9] shrink-0 overflow-hidden bg-surface-muted">
          {normalizedCover ? (
            <Image
              src={normalizedCover}
              alt={article.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[rgba(var(--color-accent),0.92)] via-[rgba(var(--color-accent-dark),0.88)] to-[rgba(var(--color-foreground),0.78)] px-4 text-center text-white">
              <span className="line-clamp-2 text-lg font-semibold drop-shadow-sm">
                {article.universe?.display_name ?? article.universe?.name ?? article.title}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card via-card/70 to-transparent" aria-hidden />
        </div>
        <div className="relative -mt-1 flex flex-1 flex-col gap-3 bg-card px-4 pb-4 pt-3">
          <div className="space-y-2">
            <p className="mb-0 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">
              {article.universe?.display_name ?? article.universe?.name ?? "Roblox"}
            </p>
            <h3 className="mb-0 line-clamp-2 text-lg font-semibold leading-snug text-foreground">{article.title}</h3>
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs text-foreground/70">
        <span className="inline-flex items-center gap-2">
          <img
            src={authorAvatar}
            alt={author?.name ?? "Bloxodes"}
            className="h-7 w-7 rounded-full border border-border/60 object-cover"
            loading="lazy"
          />
          {author?.slug ? (
            <Link href={`/authors/${author.slug}`} className="font-semibold text-foreground transition hover:text-accent">
              {author.name}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{author?.name ?? "Bloxodes"}</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <FiClock aria-hidden className="h-3 w-3" />
          <span>{updatedLabel}</span>
        </span>
      </div>
    </div>
  );
}
