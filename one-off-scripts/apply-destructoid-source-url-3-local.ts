import { readFile } from "node:fs/promises";

import { createTargetClient, chunk } from "./supabase-env";

const DOC_PATH = "docs/Destructoid Source URL 3 Candidates.md";
const READY_SECTION = "Ready to Update Source URL 3";

type ReadyRow = {
  index: number;
  gameName: string;
  slug: string;
  destructoidTitle: string;
  destructoidSlug: string;
  sourceUrl3: string;
  section: string;
};

function parseLink(cell: string): string | null {
  return cell.match(/\[Link\]\((.*?)\)/)?.[1] ?? null;
}

function extractSection(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) throw new Error(`Missing section: ${heading}`);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end);
}

function parseReadyRows(markdown: string): ReadyRow[] {
  const rows: ReadyRow[] = [];
  for (const line of extractSection(markdown, READY_SECTION)) {
    const match = line.match(
      /^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/
    );
    if (!match) continue;
    const [, index, gameName, slug, destructoidTitle, destructoidSlug, sourceUrl3Cell] = match;
    const sourceUrl3 = parseLink(sourceUrl3Cell);
    if (!sourceUrl3) continue;
    rows.push({
      index: Number(index),
      gameName: gameName.trim(),
      slug: slug.trim(),
      destructoidTitle: destructoidTitle.trim(),
      destructoidSlug: destructoidSlug.trim(),
      sourceUrl3,
      section: READY_SECTION
    });
  }
  return rows;
}

function parseFuzzyRows(markdown: string): ReadyRow[] {
  const rows: ReadyRow[] = [];
  for (const line of extractSection(markdown, "Possible Fuzzy Matches")) {
    const match = line.match(
      /^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/
    );
    if (!match) continue;
    const [, index, _destructoidGameName, destructoidTitle, destructoidSlug, sourceUrlCell, gameName, slug] = match;
    const sourceUrl3 = parseLink(sourceUrlCell);
    if (!sourceUrl3) continue;
    rows.push({
      index: Number(index),
      gameName: gameName.trim(),
      slug: slug.trim(),
      destructoidTitle: destructoidTitle.trim(),
      destructoidSlug: destructoidSlug.trim(),
      sourceUrl3,
      section: "Possible Fuzzy Matches"
    });
  }
  return rows;
}

async function main() {
  const markdown = await readFile(DOC_PATH, "utf8");
  const readyRows = [...parseReadyRows(markdown), ...parseFuzzyRows(markdown)];
  if (!readyRows.length) throw new Error("No ready rows found.");

  const duplicateSlugs = readyRows.filter(
    (row, index, all) => all.findIndex((candidate) => candidate.slug === row.slug) !== index
  );
  if (duplicateSlugs.length) {
    throw new Error(`Ready section has duplicate local slugs: ${duplicateSlugs.map((row) => row.slug).join(", ")}`);
  }

  const local = createTargetClient("local");
  let updated = 0;
  const missing: string[] = [];

  for (const group of chunk(readyRows, 50)) {
    await Promise.all(
      group.map(async (row) => {
        const { data, error } = await local
          .from("games")
          .update({ source_url_3: row.sourceUrl3 })
          .eq("slug", row.slug)
          .select("id,slug,source_url_3")
          .maybeSingle();

        if (error) throw new Error(`Failed to update ${row.slug}: ${error.message}`);
        if (!data) {
          missing.push(row.slug);
          return;
        }
        updated += 1;
      })
    );
  }

  console.log(JSON.stringify({
    source: DOC_PATH,
    requested: readyRows.length,
    updated,
    missing
  }, null, 2));

  if (missing.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
