import "../shared/load-env";

import { cleanRobloxUniverseDisplayName } from "@/lib/roblox/display-name";
import { slugify } from "@/lib/slug";
import { supabaseAdmin } from "@/lib/supabase-admin";

type UniverseDisplayNameRow = {
  universe_id: number;
  slug: string | null;
  name: string | null;
  display_name: string | null;
};

type UniverseNameUpdate = {
  universeId: number;
  beforeSlug: string | null;
  afterSlug: string;
  name: string | null;
  beforeDisplayName: string | null;
  afterDisplayName: string;
  reasons: Array<"display_missing" | "display_dirty" | "slug_missing" | "slug_dirty">;
};

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const apply = args.has("--apply");
const allowProd = args.has("--allow-prod");
const pageSize = readPositiveIntArg(rawArgs, "--page-size") ?? 1000;
const concurrency = readPositiveIntArg(rawArgs, "--concurrency") ?? 10;
const updateRetryLimit = readPositiveIntArg(rawArgs, "--update-retries") ?? 5;
const requestTimeoutMs = readPositiveIntArg(rawArgs, "--request-timeout-ms") ?? 20000;
const limit = readPositiveIntArg(rawArgs, "--limit");
const minUniverseId = readPositiveIntArg(rawArgs, "--min-universe-id");
const universeIds = collectNumberArgValues(rawArgs, ["--universe-id", "--id"]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

function buildUpdate(row: UniverseDisplayNameRow): UniverseNameUpdate | null {
  const current = normalize(row.display_name);
  const source = normalize(row.name) ?? current;
  const clean = cleanRobloxUniverseDisplayName(source);
  if (!clean) return null;
  const nextSlug = slugify(clean) || `universe-${row.universe_id}`;
  const currentSlug = normalize(row.slug);
  const reasons: UniverseNameUpdate["reasons"] = [];

  if (!current) {
    reasons.push("display_missing");
  } else if (current !== clean) {
    reasons.push("display_dirty");
  }

  if (!currentSlug) {
    reasons.push("slug_missing");
  } else if (currentSlug !== nextSlug) {
    reasons.push("slug_dirty");
  }

  if (!reasons.length) return null;

  return {
    universeId: row.universe_id,
    beforeSlug: row.slug,
    afterSlug: nextSlug,
    name: row.name,
    beforeDisplayName: row.display_name,
    afterDisplayName: clean,
    reasons
  };
}

function printSample(updates: UniverseNameUpdate[]) {
  const sample = updates.slice(0, 20).map((update) => ({
    universe_id: update.universeId,
    reasons: update.reasons,
    raw_name: update.name,
    before_display_name: update.beforeDisplayName,
    after_display_name: update.afterDisplayName,
    before_slug: update.beforeSlug,
    after_slug: update.afterSlug
  }));
  console.log(JSON.stringify(sample, null, 2));
}

function countReasons(updates: UniverseNameUpdate[]) {
  return {
    displayDirty: updates.filter((update) => update.reasons.includes("display_dirty")).length,
    displayMissing: updates.filter((update) => update.reasons.includes("display_missing")).length,
    slugDirty: updates.filter((update) => update.reasons.includes("slug_dirty")).length,
    slugMissing: updates.filter((update) => update.reasons.includes("slug_missing")).length
  };
}

async function applyUpdates(updates: UniverseNameUpdate[]) {
  const sb = supabaseAdmin();
  let applied = 0;
  for (let index = 0; index < updates.length; index += concurrency) {
    const batch = updates.slice(index, index + concurrency);
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= updateRetryLimit; attempt += 1) {
      try {
        await Promise.all(
          batch.map(async (update) => {
            const { error } = await sb
              .from("roblox_universes")
              .update({
                display_name: update.afterDisplayName,
                slug: update.afterSlug
              })
              .eq("universe_id", update.universeId)
              .abortSignal(AbortSignal.timeout(requestTimeoutMs));
            if (error) throw error;
          })
        );
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
      if (attempt < updateRetryLimit) {
        await sleep(Math.min(1000 * 2 ** (attempt - 1), 10000));
      }
    }
    if (lastError) {
      throw new Error(
        `Failed to update universe batch ${batch[0]?.universeId ?? "unknown"}-${batch.at(-1)?.universeId ?? "unknown"}: ${
          lastError.message
        }`
      );
    }
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

  let lastUniverseId = minUniverseId ? minUniverseId - 1 : 0;
  for (;;) {
    const remaining = limit ? limit - rows.length : null;
    if (remaining !== null && remaining <= 0) break;
    const currentPageSize = remaining === null ? pageSize : Math.min(pageSize, remaining);
    const { data, error } = await sb
      .from("roblox_universes")
      .select("universe_id, slug, name, display_name")
      .gt("universe_id", lastUniverseId)
      .order("universe_id", { ascending: true })
      .limit(currentPageSize)
      .abortSignal(AbortSignal.timeout(requestTimeoutMs));
    if (error) throw error;
    const page = (data ?? []) as UniverseDisplayNameRow[];
    rows.push(...page);
    const lastRow = page.at(-1);
    if (lastRow) lastUniverseId = lastRow.universe_id;
    if (page.length < currentPageSize) break;
  }

  return rows;
}

async function applyStreaming() {
  const sb = supabaseAdmin();
  let lastUniverseId = minUniverseId ? minUniverseId - 1 : 0;
  let scanned = 0;
  let totalUpdates = 0;
  let displayDirty = 0;
  let displayMissing = 0;
  let slugDirty = 0;
  let slugMissing = 0;
  let printedSample = false;

  if (universeIds.length) {
    const rows = await loadTargetRows();
    const updates = rows.map(buildUpdate).filter((update): update is UniverseNameUpdate => update !== null);
    const counts = countReasons(updates);
    scanned = rows.length;
    totalUpdates = updates.length;
    displayDirty = counts.displayDirty;
    displayMissing = counts.displayMissing;
    slugDirty = counts.slugDirty;
    slugMissing = counts.slugMissing;
    console.log(
      `Applying clean universe name backfill: scanned=${scanned}, updates=${totalUpdates}, display_dirty=${displayDirty}, display_missing=${displayMissing}, slug_dirty=${slugDirty}, slug_missing=${slugMissing}`
    );
    if (updates.length) printSample(updates);
    const applied = await applyUpdates(updates);
    console.log(`Applied ${applied} clean universe name updates.`);
    return;
  }

  for (;;) {
    const remaining = limit ? limit - scanned : null;
    if (remaining !== null && remaining <= 0) break;
    const currentPageSize = remaining === null ? pageSize : Math.min(pageSize, remaining);

    let page: UniverseDisplayNameRow[];
    try {
      const { data, error } = await sb
        .from("roblox_universes")
        .select("universe_id, slug, name, display_name")
        .gt("universe_id", lastUniverseId)
        .order("universe_id", { ascending: true })
        .limit(currentPageSize)
        .abortSignal(AbortSignal.timeout(requestTimeoutMs));
      if (error) throw error;
      page = (data ?? []) as UniverseDisplayNameRow[];
    } catch (error) {
      throw new Error(
        `Failed to load universe rows after universe_id ${lastUniverseId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (!page.length) break;

    const updates = page.map(buildUpdate).filter((update): update is UniverseNameUpdate => update !== null);
    const counts = countReasons(updates);
    scanned += page.length;
    totalUpdates += updates.length;
    displayDirty += counts.displayDirty;
    displayMissing += counts.displayMissing;
    slugDirty += counts.slugDirty;
    slugMissing += counts.slugMissing;
    lastUniverseId = page[page.length - 1]?.universe_id ?? lastUniverseId;

    if (updates.length && !printedSample) {
      printSample(updates);
      printedSample = true;
    }

    if (updates.length) {
      await applyUpdates(updates);
    }

    console.log(
      `Processed through universe_id ${lastUniverseId}: scanned=${scanned}, updates=${totalUpdates}, display_dirty=${displayDirty}, display_missing=${displayMissing}, slug_dirty=${slugDirty}, slug_missing=${slugMissing}`
    );

    if (page.length < currentPageSize) break;
  }

  console.log(
    `Applied clean universe name backfill: scanned=${scanned}, updates=${totalUpdates}, display_dirty=${displayDirty}, display_missing=${displayMissing}, slug_dirty=${slugDirty}, slug_missing=${slugMissing}`
  );
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE.");
  }
  if (apply && !allowProd && !isLocalSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to write to a non-local Supabase URL. Add --allow-prod after a clean production dry-run.");
  }

  if (apply) {
    await applyStreaming();
    return;
  }

  const rows = await loadTargetRows();
  const updates = rows.map(buildUpdate).filter((update): update is UniverseNameUpdate => update !== null);
  const { displayDirty, displayMissing, slugDirty, slugMissing } = countReasons(updates);

  console.log(
    `${apply ? "Applying" : "Dry run"} clean universe name backfill: scanned=${rows.length}, updates=${updates.length}, display_dirty=${displayDirty}, display_missing=${displayMissing}, slug_dirty=${slugDirty}, slug_missing=${slugMissing}`
  );
  if (updates.length) printSample(updates);

  return;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
