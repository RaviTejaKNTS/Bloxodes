import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { WikiListEntry } from "@/lib/wiki";

type WikiCardProps = {
  page: WikiListEntry;
};

function normalizeText(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function normalizeImageSrc(value?: string | null): string | null {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return normalizeImageSrc(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picked = pickThumbnail(entry);
      if (picked) return picked;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "imageUrl", "image_url", "thumbnailUrl", "thumbnail_url"]) {
      const candidate = record[key];
      if (typeof candidate === "string") return normalizeImageSrc(candidate);
    }
  }
  return null;
}

function formatUpdated(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
}

function getWikiCardImage(page: WikiListEntry): string | null {
  return normalizeImageSrc(page.cover_image) ?? pickThumbnail(page.thumbnail_urls);
}

export function WikiCard({ page }: WikiCardProps) {
  const image = getWikiCardImage(page);
  const updatedLabel = formatUpdated(page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at);

  return (
    <Link
      href={`/wiki/${page.slug}`}
      className="group block overflow-hidden rounded-lg border border-border/50 bg-surface-muted/40 transition hover:border-accent/60"
    >
      <div
        className={`relative aspect-[1200/675] w-full overflow-hidden bg-surface-muted/60 bg-cover bg-center transition duration-700 group-hover:scale-[1.01] ${
          image ? "" : "bg-gradient-to-br from-[rgba(var(--color-accent),0.85)] via-[rgba(var(--color-accent-dark),0.7)] to-[rgba(var(--color-foreground),0.55)]"
        }`}
        style={image ? { backgroundImage: `url(${image})` } : undefined}
      >
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/35 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-3">
          {updatedLabel ? (
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Updated {updatedLabel}
            </p>
          ) : null}
          <h2 className="mb-0 line-clamp-2 text-base font-semibold leading-tight text-white drop-shadow-md" title={page.title}>
            {page.title}
          </h2>
        </div>
      </div>
    </Link>
  );
}
