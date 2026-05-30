import "../shared/load-env";

import { cleanRobloxUniverseDisplayName, isDirtyRobloxUniverseDisplayName } from "@/lib/roblox/display-name";
import { supabaseAdmin } from "@/lib/supabase-admin";

type UniverseDisplayNameRow = {
  universe_id: number;
  slug: string | null;
  name: string | null;
  display_name: string | null;
};

type DisplayNameUpdate = {
  universeId: number;
  slug: string | null;
  name: string | null;
  before: string | null;
  after: string;
  reason: "missing" | "dirty";
};

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const apply = args.has("--apply");
const allowProd = args.has("--allow-prod");
const pageSize = readPositiveIntArg(rawArgs, "--page-size") ?? 1000;
const concurrency = readPositiveIntArg(rawArgs, "--concurrency") ?? 10;
const limit = readPositiveIntArg(rawArgs, "--limit");
const universeIds = collectNumberArgValues(rawArgs, ["--universe-id", "--id"]);

function readPositiveIntArg(argv: string[], name: string): number | null {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const inlinePrefix = `${name}=`;
    const value = arg.startsWith(inlinePrefix) ? arg.slice(inlinePrefix.length) : arg === name ? argv[i + 1] : null;
    if (value === null || value === undefined) continue;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Expected positive integer for ${name}`);
    return parsed;
  }
  return null;
}

function collectNumberArgValues(argv: string[], names: string[]): number[] {
  const values: number[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const inlineName = names.find((name) => arg.startsWith(`${name}=`));
    const rawValue = inlineName ? arg.slice(inlineName.length + 1) : names.includes(arg) ? argv[++i] : null;
    if (!rawValue) continue;
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Expected positive universe ID for ${arg}`);
    values.push(parsed);
  }
  return Array.from(new Set(values));
}

function normalize(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function isLocalSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function buildUpdate(row: UniverseDisplayNameRow): DisplayNameUpdate | null {
  const current = normalize(row.display_name);
  const source = normalize(row.name) ?? current;
  const clean = cleanRobloxUniverseDisplayName(source);
  if (!clean) return null;

  if (!current) {
    return {
      universeId: row.universe_id,
      slug: row.slug,
      name: row.name,
      before: row.display_name,
      after: clean,
      reason: "missing"
    };
  }

  if (!isDirtyRobloxUniverseDisplayName(current)) return null;
  if (current === clean) return null;

  return {
    universeId: row.universe_id,
    slug: row.slug,
    name: row.name,
    before: row.display_name,
    after: clean,
    reason: "dirty"
  };
}

function printSample(updates: DisplayNameUpdate[]) {
  const sample = updates.slice(0, 20).map((update) => ({
    universe_id: update.universeId,
    slug: update.slug,
    reason: update.reason,
    before: update.before,
    after: update.after
  }));
  console.log(JSON.stringify(sample, null, 2));
}

async function applyUpdates(updates: DisplayNameUpdate[]) {
  const sb = supabaseAdmin();
  let applied = 0;
  for (let index = 0; index < updates.length; index += concurrency) {
    const batch = updates.slice(index, index + concurrency);
    await Promise.all(
      batch.map(async (update) => {
        const { error } = await sb
          .from("roblox_universes")
          .update({ display_name: update.after })
          .eq("universe_id", update.universeId);
        if (error) {
          throw new Error(`Failed to update display name for universe ${update.universeId}: ${error.message}`);
        }
      })
    );
    applied += batch.length;
    if (applied % 500 === 0 || applied === updates.length) {
      console.log(`Applied ${applied} display name updates...`);
    }
  }
  return applied;
}

async function loadTargetRows(): Promise<UniverseDisplayNameRow[]> {
  const sb = supabaseAdmin();
  const rows: UniverseDisplayNameRow[] = [];

  if (universeIds.length) {
    const { data, error } = await sb
      .from("roblox_universes")
      .select("universe_id, slug, name, display_name")
      .in("universe_id", universeIds)
      .order("universe_id", { ascending: true });
    if (error) throw error;
    return (data ?? []) as UniverseDisplayNameRow[];
  }

  for (let from = 0; ; from += pageSize) {
    const remaining = limit ? limit - rows.length : null;
    if (remaining !== null && remaining <= 0) break;
    const currentPageSize = remaining === null ? pageSize : Math.min(pageSize, remaining);
    const to = from + currentPageSize - 1;
    const { data, error } = await sb
      .from("roblox_universes")
      .select("universe_id, slug, name, display_name")
      .order("universe_id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const page = (data ?? []) as UniverseDisplayNameRow[];
    rows.push(...page);
    if (page.length < currentPageSize) break;
  }

  return rows;
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE.");
  }
  if (apply && !allowProd && !isLocalSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to write to a non-local Supabase URL. Add --allow-prod after a clean production dry-run.");
  }

  const rows = await loadTargetRows();
  const updates = rows.map(buildUpdate).filter((update): update is DisplayNameUpdate => update !== null);
  const dirty = updates.filter((update) => update.reason === "dirty").length;
  const missing = updates.filter((update) => update.reason === "missing").length;

  console.log(
    `${apply ? "Applying" : "Dry run"} clean display name backfill: scanned=${rows.length}, updates=${updates.length}, dirty=${dirty}, missing=${missing}`
  );
  if (updates.length) printSample(updates);

  if (!apply) return;

  const applied = await applyUpdates(updates);
  console.log(`Applied ${applied} clean display name updates.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
