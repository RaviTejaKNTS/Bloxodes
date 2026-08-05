export const DEFAULT_MESH_SORT = "featured" as const;
export const MESH_SORT_OPTIONS = [
  { value: "featured", label: "Creator Store order" },
  { value: "name", label: "Name A to Z" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently updated" }
] as const;

export type MeshSortKey = (typeof MESH_SORT_OPTIONS)[number]["value"];

export function normalizeMeshSearch(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
}

export function normalizeMeshSort(value: string | null | undefined): MeshSortKey {
  return MESH_SORT_OPTIONS.some((option) => option.value === value)
    ? (value as MeshSortKey)
    : DEFAULT_MESH_SORT;
}

export function buildMeshQueryString({ query, sort }: { query: string; sort: MeshSortKey }): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (sort !== DEFAULT_MESH_SORT) params.set("sort", sort);
  return params.toString();
}
