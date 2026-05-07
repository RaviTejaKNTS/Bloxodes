import { readFile } from "node:fs/promises";

import { createTargetClient, chunk } from "./supabase-env";

const DOC_PATH = "docs/Pro Game Guides Source URL 4 Candidates.md";
const READY_SECTION = "Ready to Update Source URL 4";

type ReadyRow = {
  index: number;
  gameName: string;
  slug: string;
  pggLabel: string;
  pggSlug: string;
  sourceUrl4: string;
  section: string;
};

function parseLink(cell: string): string | null {
  return cell.match(/\[Link\]\((.*?)\)/)?.[1] ?? null;
}

function splitMarkdownRow(line: string): string[] | null {
  if (!line.startsWith("|")) return null;
  const cells: string[] = [];
  let current = "";

  for (let index = 1; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\\" && next === "|") {
      current += "|";
      index += 1;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  return cells;
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
    const cells = splitMarkdownRow(line);
    if (!cells || cells.length !== 9 || !/^\d+$/.test(cells[0])) continue;
    const [index, gameName, slugCell, pggLabel, pggSlugCell, sourceUrl4Cell] = cells;
    const slug = slugCell.match(/^`([^`]+)`$/)?.[1];
    const pggSlug = pggSlugCell.match(/^`([^`]+)`$/)?.[1];
    const sourceUrl4 = parseLink(sourceUrl4Cell);
    if (!sourceUrl4 || !slug || !pggSlug) continue;
    rows.push({
      index: Number(index),
      gameName,
      slug,
      pggLabel,
      pggSlug,
      sourceUrl4,
      section: READY_SECTION
    });
  }
  return rows;
}

async function main() {
  const markdown = await readFile(DOC_PATH, "utf8");
  const readyRows = parseReadyRows(markdown);
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
          .update({ source_url_4: row.sourceUrl4 })
          .eq("slug", row.slug)
          .select("id,slug,source_url_4")
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
