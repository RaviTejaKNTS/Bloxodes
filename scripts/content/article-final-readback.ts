export function assertArticleUniverseReadback(rowId: number | null | undefined, finalId: number | null | undefined, slug: string) {
  if ((rowId ?? null) !== (finalId ?? null)) throw new Error(`Readback universe_id mismatch for ${slug}`);
}
