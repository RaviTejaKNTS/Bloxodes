import "../shared/load-env";

import { readFile } from "node:fs/promises";

import { supabaseAdmin } from "@/lib/supabase-admin";

type DocRow = {
  index: number;
  gameName: string;
  slug: string;
  sourceUrl: string | null;
  sourceUrl2: string | null;
};

type ExistingActionRow = DocRow & {
  note: string;
};

type CanonicalSources = {
  source_url: string | null;
  source_url_2: string | null;
};

type ExistingGame = {
  id: string;
  name: string;
  slug: string;
  source_url: string | null;
  source_url_2: string | null;
  is_published: boolean;
};

type UpdatePayload = {
  existing: ExistingGame;
  update: {
    source_url: string | null;
    source_url_2: string | null;
  };
  changed: boolean;
};

const DOC_PATH = "docs/New Games To Import.md";
const READY_SECTION = "Ready to Import";
const UPDATE_SECTION = "Add to Existing Rows";

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const help = argv.includes("--help") || argv.includes("-h");
  return { apply, help };
}

function printUsage() {
  console.log(`Usage: npx tsx scripts/games/upsert-new-games-from-doc.ts [--apply]

Reads ${DOC_PATH} and:
- inserts rows from "${READY_SECTION}" as draft games
- updates rows from "${UPDATE_SECTION}" in-place

Options:
  --apply   Write changes to Supabase. Without this flag the script only performs a dry run.
  -h, --help  Show this help message.
`);
}

function parseLink(cell: string): string | null {
  const match = cell.match(/\[Link\]\((.*?)\)/);
  return match?.[1] ?? null;
}

function extractSection(lines: string[], heading: string): string[] {
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) {
    throw new Error(`Section not found: ${heading}`);
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      end = index;
      break;
    }
  }

  return lines.slice(start + 1, end);
}

function parseReadyRows(lines: string[]): DocRow[] {
  const rows: DocRow[] = [];
  for (const line of lines) {
    const match = line.match(
      /^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/
    );
    if (!match) continue;
    const [, index, gameName, slug, sourceUrlCell, sourceUrl2Cell] = match;
    rows.push({
      index: Number(index),
      gameName: gameName.trim(),
      slug: slug.trim(),
      sourceUrl: parseLink(sourceUrlCell),
      sourceUrl2: parseLink(sourceUrl2Cell),
    });
  }
  return rows;
}

function parseUpdateRows(lines: string[]): ExistingActionRow[] {
  const rows: ExistingActionRow[] = [];
  for (const line of lines) {
    const match = line.match(
      /^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/
    );
    if (!match) continue;
    const [, index, gameName, slug, sourceUrlCell, sourceUrl2Cell, note] = match;
    rows.push({
      index: Number(index),
      gameName: gameName.trim(),
      slug: slug.trim(),
      sourceUrl: parseLink(sourceUrlCell),
      sourceUrl2: parseLink(sourceUrl2Cell),
      note: note.trim(),
    });
  }
  return rows;
}

function normalizeHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
}

function canonicalizeSources(
  sourceUrl: string | null | undefined,
  sourceUrl2: string | null | undefined
): CanonicalSources {
  let robloxDenUrl: string | null = null;
  let beebomUrl: string | null = null;

  for (const candidate of [sourceUrl, sourceUrl2]) {
    if (!candidate) continue;
    const host = normalizeHost(candidate);
    if (host.endsWith("robloxden.com")) {
      if (robloxDenUrl && robloxDenUrl !== candidate) {
        throw new Error(`Multiple RobloxDen URLs encountered: ${robloxDenUrl} and ${candidate}`);
      }
      robloxDenUrl = candidate;
      continue;
    }
    if (host.endsWith("beebom.com")) {
      if (beebomUrl && beebomUrl !== candidate) {
        throw new Error(`Multiple Beebom URLs encountered: ${beebomUrl} and ${candidate}`);
      }
      beebomUrl = candidate;
      continue;
    }
    throw new Error(`Unsupported source host: ${candidate}`);
  }

  return {
    source_url: robloxDenUrl,
    source_url_2: beebomUrl,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function readDoc() {
  const text = await readFile(DOC_PATH, "utf8");
  const lines = text.split(/\r?\n/);
  return {
    ready: parseReadyRows(extractSection(lines, READY_SECTION)),
    updates: parseUpdateRows(extractSection(lines, UPDATE_SECTION)),
  };
}

async function loadExistingGames(): Promise<ExistingGame[]> {
  const sb = supabaseAdmin();
  const pageSize = 1000;
  const games: ExistingGame[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await sb
      .from("games")
      .select("id, name, slug, source_url, source_url_2, is_published")
      .order("name", { ascending: true })
      .range(from, to);

    if (error) throw error;
    const chunkRows = (data ?? []) as ExistingGame[];
    games.push(...chunkRows);
    if (chunkRows.length < pageSize) break;
  }

  return games;
}

async function main() {
  const { apply, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    return;
  }

  const { ready, updates } = await readDoc();
  const existingGames = await loadExistingGames();

  const existingBySlug = new Map(existingGames.map((row) => [row.slug, row]));
  const existingByUrl = new Map<string, ExistingGame>();
  for (const row of existingGames) {
    for (const url of [row.source_url, row.source_url_2]) {
      if (url) existingByUrl.set(url, row);
    }
  }

  const readyPayloads = ready.map((row) => ({
    name: row.gameName,
    slug: row.slug,
    is_published: false,
    ...canonicalizeSources(row.sourceUrl, row.sourceUrl2),
  }));

  const duplicateReadySlugs = readyPayloads.filter(
    (row, index, all) => all.findIndex((candidate) => candidate.slug === row.slug) !== index
  );
  if (duplicateReadySlugs.length > 0) {
    throw new Error(`Ready payload contains duplicate slugs: ${duplicateReadySlugs.map((row) => row.slug).join(", ")}`);
  }

  const readySlugConflicts = readyPayloads.filter((row) => existingBySlug.has(row.slug));
  const readyUrlConflicts = readyPayloads.flatMap((row) => {
    const conflicts: string[] = [];
    for (const url of [row.source_url, row.source_url_2]) {
      if (url && existingByUrl.has(url)) conflicts.push(url);
    }
    return conflicts.map((url) => ({ slug: row.slug, url }));
  });

  if (readySlugConflicts.length > 0 || readyUrlConflicts.length > 0) {
    throw new Error(
      `Ready payload conflicts with existing games. Slug conflicts: ${readySlugConflicts.length}, URL conflicts: ${readyUrlConflicts.length}`
    );
  }

  const updatePayloads: UpdatePayload[] = updates.map((row) => {
    const existing = existingBySlug.get(row.slug);
    if (!existing) {
      throw new Error(`Update target not found in DB for slug: ${row.slug}`);
    }

    const canonical = canonicalizeSources(row.sourceUrl, row.sourceUrl2);
    const nextSourceUrl = existing.source_url || canonical.source_url || null;
    const nextSourceUrl2 = existing.source_url_2 || canonical.source_url_2 || null;

    for (const [field, url] of [
      ["source_url", canonical.source_url],
      ["source_url_2", canonical.source_url_2],
    ] as const) {
      if (!url) continue;
      const owner = existingByUrl.get(url);
      if (owner && owner.slug !== row.slug) {
        throw new Error(`${field} URL already belongs to another game: ${url} -> ${owner.slug}`);
      }
    }

    return {
      existing,
      update: {
        source_url: nextSourceUrl,
        source_url_2: nextSourceUrl2,
      },
      changed:
        nextSourceUrl !== existing.source_url ||
        nextSourceUrl2 !== existing.source_url_2,
    };
  });

  const effectiveUpdates = updatePayloads.filter((row) => row.changed);
  const noopUpdates = updatePayloads.filter((row) => !row.changed);

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    readyToInsert: readyPayloads.length,
    existingRowsToUpdate: effectiveUpdates.length,
    noopExistingRows: noopUpdates.length,
    sampleInsert: readyPayloads.slice(0, 3),
    sampleUpdate: effectiveUpdates.slice(0, 3).map((row) => ({
      slug: row.existing.slug,
      before: {
        source_url: row.existing.source_url,
        source_url_2: row.existing.source_url_2,
      },
      after: row.update,
    })),
    sampleNoopUpdate: noopUpdates.slice(0, 3).map((row) => ({
      slug: row.existing.slug,
      current: {
        source_url: row.existing.source_url,
        source_url_2: row.existing.source_url_2,
      },
    })),
  }, null, 2));

  if (!apply) {
    return;
  }

  const sb = supabaseAdmin();

  for (const group of chunk(readyPayloads, 250)) {
    const { error } = await sb
      .from("games")
      .insert(group);
    if (error) throw error;
  }

  for (const row of effectiveUpdates) {
    const { error } = await sb
      .from("games")
      .update(row.update)
      .eq("slug", row.existing.slug);
    if (error) throw error;
  }

  console.log(JSON.stringify({
    inserted: readyPayloads.length,
    updated: effectiveUpdates.length,
    noopUpdates: noopUpdates.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
