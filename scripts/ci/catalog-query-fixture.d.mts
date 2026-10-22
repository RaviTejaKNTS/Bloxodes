export type FixtureRow = Record<string, any>;
export type FixtureResult = {
  data: FixtureRow[] | null;
  count: number | null;
  error: { code: string; message: string; details: string; hint: null } | null;
};
export function catalogRows(kind: string, count: number, start?: number): FixtureRow[];
export function defaultCatalogTables(): Record<string, FixtureRow[]>;
export function queryCatalog(rows: FixtureRow[], params: URLSearchParams): FixtureResult;
