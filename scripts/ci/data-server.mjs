import http from "node:http";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { seedTables, seedRpcs } from "./data-seed.mjs";
import { queryRows } from "./data-query.mjs";

export function assertFixtureEnvironment(env = process.env) {
  if (env.GITHUB_ACTIONS !== "true" || env.BLOXODES_CI_DATA !== "1" || env.BLOXODES_ENV_PROFILE !== "process-only") throw new Error("CI data fixtures run only in explicit GitHub CI with process-only env.");
  for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_MEDIA_PUBLIC_URL"]) if (env[key] !== "http://127.0.0.1:54321") throw new Error(`${key} must use the CI-only loopback data server.`);
}
export function createDataServer() {
  assertFixtureEnvironment();
  const tables = seedTables(), rpcs = seedRpcs();
  const audit = { requests: 0, tables: {}, rpcs: {}, unexpected: [] };
  const image = fs.readFileSync("apps/web/public/Bloxodes.png");
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1:54321");
    const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS", "Access-Control-Expose-Headers": "Content-Range", "Cache-Control": "no-store" };
    const send = (status, data, extra = {}) => { res.writeHead(status, { ...headers, ...extra }); res.end(req.method === "HEAD" ? undefined : JSON.stringify(data)); };
    if (req.method === "OPTIONS") { send(204); return; }
    if (req.method === "GET" && url.pathname === "/__health") { send(200, { fixture: "bloxodes-ci-read-data-v1" }); return; }
    if (req.method === "GET" && url.pathname === "/__audit") { send(200, audit); return; }
    audit.requests++;
    try {
      if (url.pathname.startsWith("/storage/v1/object/public/") && ["GET", "HEAD"].includes(req.method)) {
        res.writeHead(200, { ...headers, "Content-Type": "image/png" }); res.end(req.method === "HEAD" ? undefined : image); return;
      }
      const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_0-9]+)$/)?.[1];
      if (rpc && ["GET", "HEAD", "POST"].includes(req.method) && Object.hasOwn(rpcs, rpc)) {
        audit.rpcs[rpc] = (audit.rpcs[rpc] ?? 0) + 1;
        // These are read-only RPCs. Their committed samples represent empty
        // history or the summary row, independent of the requested time window.
        req.resume(); send(200, rpcs[rpc]); return;
      }
      const table = url.pathname.match(/^\/rest\/v1\/([a-z_0-9]+)$/)?.[1];
      if (!table || !Object.hasOwn(tables, table) || !["GET", "HEAD"].includes(req.method)) throw new Error(`Unsupported CI data request: ${req.method} ${url.pathname}`);
      audit.tables[table] = (audit.tables[table] ?? 0) + 1;
      const range = req.headers.range?.match(/^(\d+)-(\d+)$/)?.slice(1).map(Number);
      const counted = /count=(exact|planned|estimated)/.test(req.headers.prefer ?? "");
      const result = queryRows(tables[table], url.searchParams, { range, count: counted });
      if (result.error) { send(416, result.error, { "Content-Range": "*/0" }); return; }
      const offset = Number(url.searchParams.get("offset") ?? range?.[0] ?? 0);
      const total = counted ? result.count : "*";
      const contentRange = !result.data.length ? `*/${total}` : `${offset}-${offset + result.data.length - 1}/${total}`;
      if (req.headers.accept?.includes("application/vnd.pgrst.object+json")) {
        if (result.data.length !== 1) { send(406, {code:"PGRST116",message:"Cannot coerce the result to a single JSON object",details:`The result contains ${result.data.length} rows`,hint:null}); return; }
        send(200, result.data[0], { "Content-Range": contentRange });
      } else send(200, result.data, { "Content-Range": contentRange });
    } catch (error) {
      audit.unexpected.push(error.message);
      console.error(error.message);
      send(500, { code: "CI_FIXTURE_UNSUPPORTED", message: error.message, hint: "Add an explicit sample or query contract to scripts/ci/fixtures.", details: null });
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertFixtureEnvironment();
  const server = createDataServer();
  server.requestTimeout = 10_000;
  server.listen(54321, "127.0.0.1", () => console.log("CI read data ready on loopback port 54321."));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
}
