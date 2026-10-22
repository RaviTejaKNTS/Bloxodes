type RangeError = { code: string; details?: string | null };

export function isCatalogPageRangeValid(page: number, pageSize: number): boolean {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1) return false;
  const offset = (page - 1) * pageSize;
  // The inclusive end must also be exact. Compare before adding so a safe
  // offset cannot conceal an overflowing end. No catalog row-count cap applies.
  return Number.isSafeInteger(offset) && offset <= Number.MAX_SAFE_INTEGER - (pageSize - 1);
}

export function catalogRangeTotal(error: RangeError | null, offset: number, count: number | null): number | null {
  if (!Number.isSafeInteger(offset) || offset <= 0 || error?.code !== "PGRST103") return null;
  // PGRST103 also covers invalid constructed ranges. Only an exhausted result
  // set is empty data, and PostgREST supplies its exact total in the details.
  const match = error.details?.match(/there are only (\d+) rows/);
  const total = count ?? (match ? Number(match[1]) : null);
  return total !== null && Number.isSafeInteger(total) && total >= 0 && offset >= total ? total : null;
}
