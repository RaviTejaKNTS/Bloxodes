import { formatDistanceToNow } from "date-fns";
import type { WikiListEntry } from "@/lib/wiki";
import { resolveWikiCardImage } from "@/lib/wiki-images";
import { ContentCard } from "@/components/ContentCard";

type WikiCardProps = {
  page: WikiListEntry;
};

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
  const image = resolveWikiCardImage(page);
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
