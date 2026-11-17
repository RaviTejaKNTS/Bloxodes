import "../shared/load-env";
import fs from "node:fs";
import path from "node:path";
import { buildSchemaManifest, compareSchemaManifests, schemaCatalogQuery, serializeSchemaManifest } from "./schema-manifest-lib.mjs";

// Read-only managed-development metadata. --write replaces the committed fixture;
// --check validates its claims after PR migrations. Production releases never invoke this.
const PROJECT = "bbtcaurrtyoukvjbxbbj";
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) throw new Error("Use schema-manifest.ts --write or --check.");
  if (process.env.SUPABASE_URL !== `https://${PROJECT}.supabase.co`) throw new Error("Unexpected managed-development schema target.");
  const token = process.env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("MANAGED_DEV_SUPABASE_ACCESS_TOKEN is required for the read-only schema manifest query.");
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: schemaCatalogQuery, read_only: true }), signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Managed-development schema metadata failed with HTTP ${response.status}.`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Unexpected schema metadata response.");
  const manifest = buildSchemaManifest(rows[0], { allowMissing: args[0] === "--check" });
  const expected = serializeSchemaManifest(manifest);
  const file = new URL("./fixtures/schema.json", import.meta.url);
  if (args[0] === "--write") {
    fs.writeFileSync(new URL("./fixtures/schema.json.tmp", import.meta.url), expected);
    fs.renameSync(new URL("./fixtures/schema.json.tmp", import.meta.url), file);
  } else {
    const { errors, extras } = fs.existsSync(file)
      ? compareSchemaManifests(JSON.parse(fs.readFileSync(file, "utf8")), manifest)
      : { errors: ["fixtures/schema.json"], extras: [] };
    if (errors.length || extras.length) {
      const artifact = path.join(process.env.RUNNER_TEMP ?? "tmp", "ci-schema-manifest.json");
      fs.mkdirSync(path.dirname(artifact), { recursive: true });
      fs.writeFileSync(`${artifact}.tmp`, expected);
      fs.renameSync(`${artifact}.tmp`, artifact);
      for (const [label, names] of [["Unsupported fixture claims", errors], ["Managed-development additions (warning only)", extras]] as const) {
        if (names.length) console.log(`${label} (${names.length}): ${names.slice(0, 40).join(", ")}${names.length > 40 ? ", ..." : ""}`);
      }
      console.log(`Fresh manifest: ${artifact}. Download ci-schema-manifest-<sha> and copy ci-schema-manifest.json to scripts/ci/fixtures/schema.json.`);
    }
    if (errors.length) throw new Error("CI schema manifest claims objects missing or different in managed development. Commit the generated manifest with the migration.");
  }
  console.log(`CI schema manifest ${args[0] === "--check" ? "is compatible with" : "generated from"} managed development (${PROJECT}): ${Object.keys(manifest.tables).length} tables/views, ${Object.keys(manifest.rpcs).length} RPCs.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
