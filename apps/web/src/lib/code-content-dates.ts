import { toIsoContentDate, type ContentDateSource } from "@/lib/content-dates";

export type CodeDateSource = {
  status: "active" | "expired" | "check";
  first_seen_at?: string | null;
  last_seen_at?: string | null;
};

export type CodePageDateSource = ContentDateSource & {
  re_rewritten_at?: string | null;
};

function latestDate(values: Array<string | null | undefined>): string | null {
  const dates = values.map(toIsoContentDate).filter((value): value is string => value !== null);
  return dates.reduce<string | null>((latest, value) => !latest || value > latest ? value : latest, null);
}

export function resolveCodePageModifiedAt(
  page: CodePageDateSource,
  codes: readonly Partial<CodeDateSource>[]
): string | null {
  // updated_at and the views' content_updated_at include routine touches, so neither is evidence of an edit.
  // re_rewritten_at records copy rewrites. Arbitrary copy edits and deletions have no durable edit history.
  return latestDate([
    page.published_at,
    page.created_at,
    page.re_rewritten_at,
    // first_seen_at also advances on reactivation. last_seen_at is mutable on every RPC observation,
    // including observations that preserve an expired status, so it cannot prove an expiration date.
    ...codes.map((code) => code.first_seen_at)
  ]);
}

export function resolveCodesLastCheckedAt(codes: readonly CodeDateSource[]): string | null {
  // A page edit is not a code check. No rows means there is no stored per-page check timestamp.
  return latestDate(codes.map((code) => code.last_seen_at));
}
