import { createTargetClient, fetchAllRows, fetchRowsByValues, chunk } from "./supabase-env";

const SOURCE_COLUMNS = [
  "source_url_3",
  "source_url_4",
  "source_url_5",
  "source_url_6",
  "source_url_7",
  "source_url_8",
  "source_url_9",
  "source_url_10"
];

type GameRow = Record<string, unknown> & {
  id: string;
  slug: string;
};

function hasAnySourceUpdate(row: GameRow): boolean {
  return SOURCE_COLUMNS.some((column) => typeof row[column] === "string" && row[column].trim().length > 0);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const local = createTargetClient("local");
  const prod = createTargetClient("prod");

  const localRows = await fetchAllRows<GameRow>(local, "games", ["id", "slug", ...SOURCE_COLUMNS].join(","), "id");
  const rowsToUpdate = localRows.filter(hasAnySourceUpdate);
  const prodRows = await fetchRowsByValues<GameRow>(prod, "games", "id", rowsToUpdate.map((row) => row.id), "id,slug");
  const prodIds = new Set(prodRows.map((row) => row.id));
  const missingInProd = rowsToUpdate.filter((row) => !prodIds.has(row.id));

  if (missingInProd.length) {
    console.error(`Refusing to continue: ${missingInProd.length} local source rows are missing in production.`);
    for (const row of missingInProd.slice(0, 25)) {
      console.error(`missing_in_prod ${row.slug} ${row.id}`);
    }
    if (missingInProd.length > 25) console.error(`...and ${missingInProd.length - 25} more`);
    process.exit(1);
  }

  console.log(`${apply ? "Applying" : "Dry run"} source-column updates for ${rowsToUpdate.length} existing production games.`);
  if (!apply) {
    for (const row of rowsToUpdate.slice(0, 15)) {
      const filled = SOURCE_COLUMNS.filter((column) => typeof row[column] === "string" && row[column].trim().length > 0);
      console.log(`would_update ${row.slug} ${filled.join(",")}`);
    }
    console.log("Run with --apply after production has the matching source_url_4..source_url_10 columns.");
    return;
  }

  let updated = 0;
  for (const batch of chunk(rowsToUpdate, 50)) {
    await Promise.all(
      batch.map(async (row) => {
        const payload: Record<string, unknown> = {};
        for (const column of SOURCE_COLUMNS) payload[column] = row[column] ?? null;

        const { data, error } = await prod
          .from("games")
          .update(payload)
          .eq("id", row.id)
          .select("id")
          .maybeSingle();

        if (error) throw new Error(`Failed to update ${row.slug}: ${error.message}`);
        if (!data) throw new Error(`Production row disappeared during update: ${row.slug} ${row.id}`);
        updated += 1;
      })
    );
  }

  console.log(`Updated ${updated} production games with local article source columns.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
