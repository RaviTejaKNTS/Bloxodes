import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../../../supabase/migrations/20261015094044_fix_roblox_collection_page_instructions.sql", import.meta.url), "utf8");
const repairs = JSON.parse(migration.split("$repair$")[1]);
const quote = value => `'${value.replaceAll("'", "''")}'`;

test("collection copy repair preserves newer fields, runtime pointers and unrelated pages", { skip: !process.env.CI_TRANSACTION_DATABASE_URL }, () => {
  const code = "creatures-of-sonaria-material-palettes";
  const before = "Material palettes retexture your creature: foil crinkles, magma rock, forcefield shells, gold trophy shine, and full themed looks. They work alongside [color palettes](/wiki/creatures-of-sonaria/color-palettes), which only change hue slots. Use the cards here to compare how each material looks, where it comes from, and whether dying with it costs an Appearance Change Token.";
  const brookhaven = repairs.find(repair => repair.code === "brookhaven-rp-inventory-items");
  const oldWiki = "Inventory Items are part of Brookhaven RP's in-game reference data. Use this catalog to compare tools, roleplay items, categories, descriptions, and images before you choose what to collect, unlock, buy, fight, or track next.";
  const statement = `begin;
    create table public.wiki_collection_pages (
      code text primary key, intro_md text, wiki_md text, description_md text, faq_json jsonb,
      published_dataset_id text default 'keep-revision', page_type text default 'database',
      how_it_works_md text default 'Retain legacy game details'
    );
    insert into public.wiki_collection_pages(code,intro_md) values (${quote(code)},${quote(before)}),('unrelated-items','Keep this copy');
    insert into public.wiki_collection_pages(code,intro_md,wiki_md,faq_json) values
      ('brookhaven-rp-inventory-items','A newer owner edit',${quote(oldWiki)},${quote(JSON.stringify(brookhaven.changes.faq_json.expected))}::jsonb);
    ${migration}
    select jsonb_agg(to_jsonb(p) order by code) from public.wiki_collection_pages p;
    ${migration}
    select jsonb_agg(to_jsonb(p) order by code) from public.wiki_collection_pages p;
    rollback;`;
  const output = execFileSync("psql", [process.env.CI_TRANSACTION_DATABASE_URL, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { input: statement, encoding: "utf8" }).trim().split("\n").map(line => JSON.parse(line));
  const [first, repeated] = output;
  assert.deepEqual(first, repeated, "reapplying the repair makes no further changes");
  assert.equal(first.find(row => row.code === code).intro_md, repairs.find(repair => repair.code === code).changes.intro_md.value);
  const changed = first.find(row => row.code === brookhaven.code);
  assert.equal(changed.intro_md, "A newer owner edit");
  assert.equal(changed.wiki_md, brookhaven.changes.wiki_md.value);
  assert.deepEqual(changed.faq_json, brookhaven.changes.faq_json.value);
  assert.equal(first.find(row => row.code === "unrelated-items").intro_md, "Keep this copy");
  assert.ok(first.every(row => row.published_dataset_id === "keep-revision" && row.page_type === "database" && row.how_it_works_md === "Retain legacy game details"));
});
