import { formatDistanceToNow } from "date-fns";

export type ContentDateSource = {
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  content_updated_at?: string | null;
};

export function resolvePublishedAt(source: ContentDateSource): string | null {
  return source.published_at ?? source.created_at ?? null;
}

export function resolveModifiedAt(source: ContentDateSource): string | null {
  return source.content_updated_at ?? source.updated_at ?? source.published_at ?? source.created_at ?? null;
}

export function formatExactDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatRelativeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function buildUpdatedDisplay(value: string | Date | null | undefined) {
  return {
    exact: formatExactDate(value),
    relative: formatRelativeDate(value)
  };
}
