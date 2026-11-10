// Weekly managed-development cleanup. Every collection publish adds a new
// dataset revision and leaves the old one behind, so the database outgrows the
// Supabase plan. This deletes revisions that a newer published revision has
// replaced, vacuums the tables, and fails when the database nears its limit.
// Dry run by default; --apply deletes. Managed development only.
const PROJECT = "bbtcaurrtyoukvjbxbbj";
const MIN_AGE_DAYS = 2;
const BATCH = 100;
const MAX_BATCHES = 200;
const WARN_MB = 450;

const apply = process.argv.includes("--apply");
const token = process.env.MANAGED_DEV_SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("MANAGED_DEV_SUPABASE_ACCESS_TOKEN is required.");
if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== `https://${PROJECT}.supabase.co`) {
  throw new Error("Unexpected target: this cleanup runs only against managed development.");
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function query(sql) {
  for (let attempt = 1; ; attempt++) {
    let response;
    try {
      response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
        signal: AbortSignal.timeout(180_000)
      });
    } catch (error) {
      if (attempt < 3) { await sleep(attempt * 30_000); continue; }
      throw new Error(`Managed-development API unreachable after ${attempt} tries: ${error.message}`);
    }
    if (response.status >= 500 && attempt < 3) { await sleep(attempt * 30_000); continue; }
    const result = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(result)) {
      // Report the Postgres error code only; never print SQL or the API body.
      const code = JSON.stringify(result ?? "").match(/ERROR:\s+([0-9A-Z]{5})/)?.[1];
      throw new Error(`Managed-development SQL failed with HTTP ${response.status}${code ? `, SQLSTATE ${code}` : ""}.`);
    }
    return result;
  }
}

// A revision is superseded when its page publishes a different revision and it
// is older than MIN_AGE_DAYS, so a publish still staging its revision is safe.
// Pages with no published revision keep everything. The pages' foreign keys and
// the immutability triggers also refuse to delete a published revision.
const superseded = (datasets, pages) => `
  select d.id from public.${datasets} d
  join public.${pages} p on p.id = d.collection_page_id
  where p.published_dataset_id is not null
    and p.published_dataset_id <> d.id
    and d.created_at < now() - interval '${MIN_AGE_DAYS} days'`;

async function prune(label, datasets, pages) {
  if (!apply) {
    const [row] = await query(`with s as (${superseded(datasets, pages)})
      select count(*)::int datasets, coalesce(sum(d.item_count), 0)::int items
      from public.${datasets} d join s on s.id = d.id;`);
    console.log(`Would remove ${row.datasets} superseded ${label} datasets (${row.items} items).`);
    return { datasets: row.datasets, items: row.items };
  }
  const total = { datasets: 0, items: 0 };
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    // Each batch is one statement, so a run killed midway loses nothing.
    const [row] = await query(`set local lock_timeout = '15s'; set local statement_timeout = '150s';
      with doomed as (${superseded(datasets, pages)} order by d.created_at limit ${BATCH}),
      gone as (delete from public.${datasets} d using doomed where d.id = doomed.id returning d.item_count)
      select count(*)::int datasets, coalesce(sum(item_count), 0)::int items from gone;`);
    total.datasets += row.datasets;
    total.items += row.items;
    if (row.datasets < BATCH) return total;
  }
  throw new Error(`${label} cleanup stopped after ${MAX_BATCHES} batches; more superseded datasets remain. Run it again.`);
}

async function main() {
  const game = await prune("game", "game_collection_datasets", "game_collection_pages");
  const wiki = await prune("wiki", "wiki_collection_datasets", "wiki_collection_pages");
  if (apply) {
    // Plain vacuum makes the freed space reusable without blocking readers.
    await query("vacuum (analyze, skip_locked) public.game_collection_items, public.wiki_collection_items, public.game_collection_datasets, public.wiki_collection_datasets, public.search_index;");
  }
  const [size] = await query("select (pg_database_size(current_database()) / 1048576)::int mb;");
  const verb = apply ? "Removed" : "Would remove";
  console.log(`${verb} ${game.datasets} game and ${wiki.datasets} wiki datasets (${game.items + wiki.items} items). Database is ${size.mb} MB.`);
  if (size.mb > WARN_MB) {
    throw new Error(`Managed-development database is ${size.mb} MB, over the ${WARN_MB} MB warning line (free plan limit 500 MB). Find the largest tables with pg_stat_user_tables.`);
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
