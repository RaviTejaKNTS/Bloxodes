import { formatDistanceToNow } from "date-fns";

export type ContentDateSource = {
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  content_updated_at?: string | null;
};

export type ContentDateField = keyof ContentDateSource;

export type ContentDateIssueCode =
  | "missing-published-date"
  | "invalid-published-date"
  | "invalid-modified-date"
  | "published-in-future"
  | "modified-in-future"
  | "modified-before-published";

export type ContentDateIssue = {
  code: ContentDateIssueCode;
  field: ContentDateField | null;
  value: string | null;
};

export type ResolvedContentDates = {
  publishedAt: string | null;
  modifiedAt: string | null;
  publishedField: ContentDateField | null;
  modifiedField: ContentDateField | null;
  issues: ContentDateIssue[];
};

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function firstDateCandidate(
  source: ContentDateSource,
  fields: ContentDateField[]
): { field: ContentDateField; value: string } | null {
  for (const field of fields) {
    const value = source[field];
    if (typeof value === "string" && value.trim()) {
      return { field, value: value.trim() };
    }
  }
  return null;
}

export function parseContentDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoContentDate(value: string | Date | null | undefined): string | null {
  return parseContentDate(value)?.toISOString() ?? null;
}

export function resolveContentDates(
  source: ContentDateSource,
  options: { requirePublished?: boolean; now?: Date; futureToleranceMs?: number } = {}
): ResolvedContentDates {
  const issues: ContentDateIssue[] = [];
  const publishedCandidate = firstDateCandidate(source, ["published_at", "created_at"]);
  const modifiedCandidate = firstDateCandidate(source, [
    "content_updated_at",
    "updated_at",
    "published_at",
    "created_at"
  ]);
  const publishedDate = parseContentDate(publishedCandidate?.value);
  const modifiedDate = parseContentDate(modifiedCandidate?.value);
  const nowMs = (options.now ?? new Date()).getTime();
  const futureToleranceMs = options.futureToleranceMs ?? FUTURE_TOLERANCE_MS;

  if (!publishedCandidate && options.requirePublished !== false) {
    issues.push({ code: "missing-published-date", field: null, value: null });
  } else if (publishedCandidate && !publishedDate) {
    issues.push({
      code: "invalid-published-date",
      field: publishedCandidate.field,
      value: publishedCandidate.value
    });
  }

  if (modifiedCandidate && !modifiedDate) {
    issues.push({
      code: "invalid-modified-date",
      field: modifiedCandidate.field,
      value: modifiedCandidate.value
    });
  }

  if (publishedDate && publishedDate.getTime() > nowMs + futureToleranceMs) {
    issues.push({
      code: "published-in-future",
      field: publishedCandidate?.field ?? null,
      value: publishedCandidate?.value ?? null
    });
  }

  if (modifiedDate && modifiedDate.getTime() > nowMs + futureToleranceMs) {
    issues.push({
      code: "modified-in-future",
      field: modifiedCandidate?.field ?? null,
      value: modifiedCandidate?.value ?? null
    });
  }

  if (publishedDate && modifiedDate && modifiedDate.getTime() < publishedDate.getTime()) {
    issues.push({
      code: "modified-before-published",
      field: modifiedCandidate?.field ?? null,
      value: modifiedCandidate?.value ?? null
    });
  }

  return {
    publishedAt: publishedDate?.toISOString() ?? null,
    modifiedAt: modifiedDate?.toISOString() ?? null,
    publishedField: publishedCandidate?.field ?? null,
    modifiedField: modifiedCandidate?.field ?? null,
    issues
  };
}

export function resolvePublishedAt(source: ContentDateSource): string | null {
  return source.published_at ?? source.created_at ?? null;
}

export function resolveModifiedAt(source: ContentDateSource): string | null {
  return source.content_updated_at ?? source.updated_at ?? source.published_at ?? source.created_at ?? null;
}

export function formatExactDate(value: string | Date | null | undefined): string | null {
  const date = parseContentDate(value);
  if (!date) return null;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatRelativeDate(value: string | Date | null | undefined): string | null {
  const date = parseContentDate(value);
  if (!date) return null;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function buildUpdatedDisplay(value: string | Date | null | undefined) {
  return {
    exact: formatExactDate(value),
    relative: formatRelativeDate(value)
  };
}
