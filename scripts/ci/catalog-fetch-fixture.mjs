import fs from "node:fs";
import { defaultCatalogTables, queryCatalog } from "./catalog-query-fixture.mjs";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.CATALOG_ROUTE_FIXTURES !== "1") {
  throw new Error("Catalog fetch fixtures run only in explicit GitHub CI.");
}
const tables = defaultCatalogTables();
const originalFetch = globalThis.fetch;
globalThis.fetch = async function catalogFixtureFetch(input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const table = url.pathname.match(/^\/rest\/v1\/(roblox_[a-z_]+)$/)?.[1];
  if (!table || !Object.hasOwn(tables, table)) return originalFetch(input, init);
  const state = process.env.CATALOG_FIXTURE_STATE && fs.existsSync(process.env.CATALOG_FIXTURE_STATE)
    ? JSON.parse(fs.readFileSync(process.env.CATALOG_FIXTURE_STATE, "utf8")) : {};
  if (state.failure === "transport") throw new TypeError("CI fixture transport failure");
  const result = state.failure
    ? { data: null, error: { code: state.failure, message: "CI fixture database failure", details: null, hint: null }, count: null }
    : queryCatalog(tables[table], url.searchParams);
  const headers = new Headers({ "Content-Type": "application/json" });
  const total = result.count ?? 0;
  const offset = Number(url.searchParams.get("offset") ?? 0);
  headers.set("Content-Range", result.error || !result.data?.length ? `*/${total}` : `${offset}-${offset + result.data.length - 1}/${total}`);
  return new Response(JSON.stringify(result.error ?? result.data), { status: result.error ? (result.error.code === "PGRST103" ? 416 : 503) : 200, headers });
};
