import fs from "node:fs";

const base = process.env.VPS_SUPABASE_STUDIO_URL || "https://studio.bloxodes.com";
if (new URL(base).origin !== "https://studio.bloxodes.com") throw new Error("Unexpected production Studio host.");
const username = process.env.VPS_SUPABASE_STUDIO_USERNAME;
const password = process.env.VPS_SUPABASE_STUDIO_PASSWORD;
if (!username || !password) throw new Error("Production Studio credentials are required.");
const roleIndex = process.argv.indexOf("--database-role");
if (roleIndex < 0 || process.argv[roleIndex + 1] !== "supabase_admin") throw new Error("Studio transport requires --database-role supabase_admin.");
const tuplesOnly = process.argv.includes("--tuples-only");
const input = fs.readFileSync(0, "utf8");
// The object proof uses this psql directive; HTTP queries fail on any SQL error.
const query = input.replace(/^\\set ON_ERROR_STOP on\s*$/gm, "");
if (!query.trim()) throw new Error("SQL input is required.");
const headers = { Authorization: "Basic " + Buffer.from(username + ":" + password).toString("base64"), "Content-Type": "application/json" };
async function execute(query) {
  const response = await fetch(new URL("/api/platform/pg-meta/default/query", base), { method: "POST", headers, body: JSON.stringify({ query }), signal: AbortSignal.timeout(240000) });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result)) throw new Error(`Studio SQL failed (${response.status}): ${result.message || result.error || "Unexpected response"}`);
  return result;
}
try {
  const role = await execute("select current_user as role;");
  if (role[0]?.role !== "supabase_admin") throw new Error("Studio database role does not match the approved role.");
  const rows = await execute(query);
  for (const row of rows) console.log(tuplesOnly ? Object.values(row).map(value => value == null ? "" : String(value)).join("|") : JSON.stringify(row));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
