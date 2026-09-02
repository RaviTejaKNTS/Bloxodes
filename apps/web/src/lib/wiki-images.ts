type WikiImageFields = {
  cover_image?: string | null;
  icon_url?: string | null;
  thumbnail_urls?: unknown;
};

type WikiMediaImage = {
  media_type?: string | null;
  image_url?: string | null;
};

function normalizeImage(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function pickWikiThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return normalizeImage(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picked = pickWikiThumbnail(entry);
      if (picked) return picked;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "imageUrl", "image_url", "thumbnailUrl", "thumbnail_url"]) {
      const candidate = record[key];
      if (typeof candidate === "string") {
        const normalized = normalizeImage(candidate);
        if (normalized) return normalized;
      }
    }
  }
  return null;
}

export function resolveWikiCardImage(page: WikiImageFields): string | null {
  return pickWikiThumbnail(page.thumbnail_urls) ?? normalizeImage(page.cover_image) ?? normalizeImage(page.icon_url);
}

export function resolveWikiHeaderImage(page: WikiImageFields, media: WikiMediaImage[]): string | null {
  const mediaIcon = media.find((item) => item.media_type === "icon" && normalizeImage(item.image_url))?.image_url;
  const mediaFallback = media.find((item) => normalizeImage(item.image_url))?.image_url;

  return (
    normalizeImage(mediaIcon) ??
    normalizeImage(page.icon_url) ??
    normalizeImage(page.cover_image) ??
    normalizeImage(mediaFallback) ??
    pickWikiThumbnail(page.thumbnail_urls)
  );
}

export function resolveWikiMetadataImage(page: WikiImageFields): string | null {
  return pickWikiThumbnail(page.thumbnail_urls) ?? normalizeImage(page.cover_image) ?? normalizeImage(page.icon_url);
}

export function normalizeWikiCoverOverride(value: unknown, allowOverride: boolean): string | null {
  const normalized = typeof value === "string" ? value.trim() || null : null;
  if (normalized && !allowOverride) {
    throw new Error(
      "wiki final cover_image must be null; official universe media owns wiki cards, social previews, and title artwork"
    );
  }
  return normalized;
}
