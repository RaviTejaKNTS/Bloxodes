import { formatDistanceToNow } from "date-fns";
import type { WikiListEntry } from "@/lib/wiki";
import { ContentCard } from "@/components/ContentCard";

type WikiCardProps = {
  page: WikiListEntry;
};

function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
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
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
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

export function WikiCard({ page }: WikiCardProps) {
  const image = (typeof page.cover_image === "string" ? page.cover_image.trim() || null : null) ?? pickThumbnail(page.thumbnail_urls);
  const updatedLabel = formatUpdated(page.content_updated_at ?? page.updated_at ?? page.published_at ?? page.created_at);

  return (
    <ContentCard
      type="wiki"
      variant="overlay"
      href={`/wiki/${page.slug}`}
      titleAs="h2"
      title={page.title}
      eyebrow={updatedLabel ? `Updated ${updatedLabel}` : null}
      image={{ src: image, alt: page.title, ratio: "1200/675" }}
    />
  );
}
