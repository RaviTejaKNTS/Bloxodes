import "../shared/load-env";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Release = { edition: "java" | "bedrock"; version: string; release_order: number; released_at: string | null; source_url: string; is_stable: true; checked_at: string };
type Seed = { schemaVersion: number; namespace: string; checkedDate: string; releases: Release[]; sourceEvidence: Array<{ path: string; sha256: string }> };
const args = process.argv.slice(2);
const root = process.cwd();
const fields = "edition,version,release_order,released_at,source_url,is_stable,checked_at";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function value(flag: string) { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; }
function same(actual: Record<string, unknown>, expected: Release) {
  return Object.entries(expected).every(([key, wanted]) => key === "checked_at"
    ? Date.parse(String(actual[key])) === Date.parse(wanted as string)
    : actual[key] === wanted);
}
function ignoredFile(file: string) {
  const resolved = path.resolve(root, file);
  const relative = path.relative(path.join(root, "tmp"), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Authoring inputs and receipts must remain inside this checkout's ignored tmp directory.");
  return resolved;
}
async function main() {
  if (args.includes("--help")) { console.log("Usage: seed:minecraft-releases -- --seed <reviewed.json> [--receipt <ignored.json>] [--apply]. Managed development only; default plans without database reads or writes."); return; }
  for (let index = 0; index < args.length; index++) {
    if (["--seed", "--receipt"].includes(args[index])) { if (!args[++index] || args[index].startsWith("--")) throw new Error("A file argument is required."); }
    else if (args[index] !== "--apply") throw new Error(`Unsupported argument: ${args[index]}`);
  }
  const target = new URL(process.env.SUPABASE_URL ?? "https://invalid.example");
  if (target.protocol !== "https:" || target.hostname !== "bbtcaurrtyoukvjbxbbj.supabase.co") throw new Error("Release seeding is restricted to the reviewed managed-development project.");
  const file = value("--seed");
  if (!file) throw new Error("An exact --seed file is required.");
  const bytes = await readFile(ignoredFile(file));
  const seed = JSON.parse(bytes.toString("utf8")) as Seed;
  if (seed.schemaVersion !== 1 || seed.namespace !== "minecraft" || !/^\d{4}-\d{2}-\d{2}$/.test(seed.checkedDate) || !Array.isArray(seed.releases) || seed.releases.length !== 2 || new Set(seed.releases.map(row => row.edition)).size !== 2) throw new Error("Expected two reviewed Minecraft edition anchors.");
  if (!Array.isArray(seed.sourceEvidence) || !seed.sourceEvidence.length) throw new Error("Frozen source evidence is required.");
  const proof: string[] = [];
  for (const source of seed.sourceEvidence) {
    const sourceBytes = await readFile(ignoredFile(source.path));
    if (hash(sourceBytes) !== source.sha256) throw new Error(`Source proof changed: ${source.path}`);
    proof.push(sourceBytes.toString("utf8"));
  }
  const releases: Release[] = [];
  for (const row of seed.releases) {
    const source = new URL(row.source_url);
    if (!["java", "bedrock"].includes(row.edition) || !/^\d+(?:\.\d+){1,2}$/.test(row.version) || !Number.isInteger(row.release_order) || row.release_order < 1 || row.is_stable !== true || !Number.isFinite(Date.parse(row.checked_at)) || row.checked_at.slice(0, 10) !== seed.checkedDate || (row.released_at !== null && !/^\d{4}-\d{2}-\d{2}$/.test(row.released_at))) throw new Error("Invalid stable release anchor.");
    if (source.protocol !== "https:" || !["www.minecraft.net", "feedback.minecraft.net"].includes(source.hostname) || !proof.some(text => text.includes(row.source_url) && text.includes(row.version)) || !proof.some(text => text.includes(seed.checkedDate))) throw new Error("Release metadata must match frozen official source proof.");
    releases.push(Object.fromEntries(fields.split(",").map(key => [key, row[key as keyof Release]])) as Release);
  }
  const report = { target: "managed-development", projectId: "bbtcaurrtyoukvjbxbbj", seedFile: file, seedSha256: hash(bytes), apply: args.includes("--apply"), releases, sourceEvidence: seed.sourceEvidence, changedRows: 0 };
  if (report.apply) {
    const sb = supabaseAdmin();
    const existing = await sb.from("minecraft_releases").select(fields);
    if (existing.error) throw existing.error;
    const rows = existing.data ?? [];
    for (const row of releases) {
      if (rows.some(actual => actual.edition === row.edition && ((actual.release_order === row.release_order && actual.version !== row.version) || (actual.version === row.version && actual.release_order !== row.release_order)))) throw new Error("Refusing to reorder an existing edition release history.");
    }
    const changed = releases.filter(row => !rows.some(actual => actual.edition === row.edition && actual.version === row.version && same(actual, row)));
    if (changed.length) {
      const written = await sb.from("minecraft_releases").upsert(changed, { onConflict: "edition,version" });
      if (written.error) throw written.error;
    }
    const readback = await sb.from("minecraft_releases").select(fields).in("version", releases.map(row => row.version));
    if (readback.error) throw readback.error;
    if (!releases.every(row => (readback.data ?? []).some(actual => same(actual, row)))) throw new Error("Release anchor readback failed.");
    report.changedRows = changed.length;
  }
  const receipt = value("--receipt");
  if (receipt) { const output = ignoredFile(receipt); await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + "\n"); }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
