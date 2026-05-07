import { createTargetClient, fetchAllRows } from "./supabase-env";

const ARTICLE_SOURCE_COLUMNS = [
  "source_url",
  "source_url_2",
  "source_url_3",
  "source_url_4",
  "source_url_5",
  "source_url_6",
  "source_url_7",
  "source_url_8",
  "source_url_9",
  "source_url_10"
];

type Row = Record<string, unknown> & { id: string; slug?: string | null };

function normalizeForCompare(value: unknown): string {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function countFilled(rows: Row[], column: string): number {
  return rows.filter((row) => typeof row[column] === "string" && row[column].trim().length > 0).length;
}

async function main() {
  const prod = createTargetClient("prod");
  const local = createTargetClient("local");
  const prodRows = await fetchAllRows<Row>(prod, "games", "*", "id");
  const localRows = await fetchAllRows<Row>(local, "games", "*", "id");

  const prodById = new Map(prodRows.map((row) => [row.id, row]));
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const missingLocal = prodRows.filter((row) => !localById.has(row.id));
  const extraLocal = localRows.filter((row) => !prodById.has(row.id));

  const prodColumns = new Set(prodRows.flatMap((row) => Object.keys(row)));
  const columnsToCompare = Array.from(prodColumns).sort();
  const mismatches: Array<{ id: string; slug?: string | null; column: string }> = [];

  for (const prodRow of prodRows) {
    const localRow = localById.get(prodRow.id);
    if (!localRow) continue;
    for (const column of columnsToCompare) {
      if (normalizeForCompare(prodRow[column]) !== normalizeForCompare(localRow[column])) {
        mismatches.push({ id: prodRow.id, slug: prodRow.slug, column });
        if (mismatches.length >= 25) break;
      }
    }
    if (mismatches.length >= 25) break;
  }

  console.log(`Production games: ${prodRows.length}`);
  console.log(`Local games: ${localRows.length}`);
  console.log(`Missing in local: ${missingLocal.length}`);
  console.log(`Extra in local: ${extraLocal.length}`);
  console.log(`Mismatched rows/columns shown: ${mismatches.length}`);

  for (const column of ARTICLE_SOURCE_COLUMNS) {
    console.log(`Local filled ${column}: ${countFilled(localRows, column)}`);
  }

  if (missingLocal.length || extraLocal.length || mismatches.length) {
    for (const row of missingLocal.slice(0, 10)) console.log(`missing_local ${row.slug ?? row.id}`);
    for (const row of extraLocal.slice(0, 10)) console.log(`extra_local ${row.slug ?? row.id}`);
    for (const mismatch of mismatches) console.log(`mismatch ${mismatch.slug ?? mismatch.id} ${mismatch.column}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
