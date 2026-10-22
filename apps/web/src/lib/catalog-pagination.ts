export function isCatalogPageOutOfRange(error: { code: string } | null, offset: number): boolean {
  // Exact-count queries report an offset past the result set as HTTP 416.
  return offset > 0 && error?.code === "PGRST103";
}
