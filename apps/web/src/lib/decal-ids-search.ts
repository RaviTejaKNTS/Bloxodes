export type DecalSortKey =
  | "recommended"
  | "popular"
  | "newest"
  | "oldest"
  | "name_asc"
  | "creator_asc"
  | "sources_desc";

export type DecalSortOption = {
  value: DecalSortKey;
  label: string;
};

export type DecalSearchState = {
  query: string;
  sort: DecalSortKey;
};

export const DEFAULT_SORT: DecalSortKey = "recommended";

export const SORT_OPTIONS: DecalSortOption[] = [
  { value: "recommended", label: "Recommended" },
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "creator_asc", label: "Creator A-Z" },
  { value: "sources_desc", label: "Most sourced" }
];

export function normalizeSearchQuery(value?: string | null): string {
  if (!value) return "";
  return value.trim().slice(0, 80);
}

export function normalizeSortKey(value?: string | null): DecalSortKey {
  if (!value) return DEFAULT_SORT;
  const match = SORT_OPTIONS.find((option) => option.value === value);
  return match ? match.value : DEFAULT_SORT;
}

export function buildSearchQueryString(state: DecalSearchState): string {
  const params = new URLSearchParams();
  if (state.query) {
    params.set("q", state.query);
  }
  if (state.sort !== DEFAULT_SORT) {
    params.set("sort", state.sort);
  }
  return params.toString();
}
