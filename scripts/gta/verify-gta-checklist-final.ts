import "../shared/load-env";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { assertManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type ChecklistItem = {
  key: string;
  section_code: string;
  title: string;
  description?: string | null;
  is_required: boolean;
};

type ChecklistFinal = {
  game_slug: string;
  slug: string;
  title: string;
  description_md: string;
  items: ChecklistItem[];
};

type DbChecklistItem = Omit<ChecklistItem, "key"> & { item_key: string };

type Options = { baseUrl: string; files: string[] };

function parseArgs(argv: string[]): Options {
  let baseUrl = "";
  const files: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") baseUrl = argv[++index] ?? "";
    else if (arg === "--file") files.push(argv[++index] ?? "");
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run verify:gta-checklist-final -- --base-url http://localhost:3000 --file tmp/content-workspace/gta-checklists/gta-san-andreas/final.json [...]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!baseUrl || !files.length || files.some((file) => !file)) {
    throw new Error("--base-url and at least one --file are required.");
  }
  return { baseUrl: new URL(baseUrl).toString().replace(/\/$/, ""), files };
}

async function readFinal(file: string): Promise<ChecklistFinal> {
  const value = JSON.parse(await readFile(path.resolve(file), "utf8")) as Partial<ChecklistFinal>;
  if (!value.game_slug || value.game_slug !== value.slug || !value.title || !value.description_md || !Array.isArray(value.items)) {
    throw new Error(`${file} is missing GTA checklist identity, description, or items.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) throw new Error(`${file} has an invalid slug.`);
  const keys = new Set<string>();
  const codes = new Set<string>();
  for (const item of value.items) {
    if (!item.key || keys.has(item.key)) throw new Error(`${file} has a duplicate or empty item key.`);
    if (!item.section_code || codes.has(item.section_code)) throw new Error(`${file} has a duplicate or empty section code.`);
    if (!/^\d+(?:\.\d+){0,2}$/.test(item.section_code)) throw new Error(`${file} has an invalid section code: ${item.section_code}`);
    const isLeaf = item.section_code.split(".").length === 3;
    if (item.is_required !== isLeaf) throw new Error(`${file} has an inconsistent required flag for ${item.key}.`);
    if (!item.title?.trim()) throw new Error(`${file} has an empty item title.`);
    if (/—/.test(JSON.stringify(item))) throw new Error(`${file} contains an em dash.`);
    keys.add(item.key);
    codes.add(item.section_code);
  }
  return value as ChecklistFinal;
}

async function verifyPage(baseUrl: string, final: ChecklistFinal, file: string) {
  const sb = supabaseAdmin();
  const pageResult = await sb
    .from("gta_checklist_pages_view")
    .select("id, slug, title, game_slug, is_public, leaf_item_count")
    .eq("slug", final.slug)
    .maybeSingle();
  if (pageResult.error) throw pageResult.error;
  const page = pageResult.data as { id: string; slug: string; title: string; game_slug: string; is_public: boolean; leaf_item_count: number } | null;
  if (!page || !page.is_public || page.slug !== final.slug || page.game_slug !== final.game_slug || page.title !== final.title) {
    throw new Error(`Managed-development page readback failed for ${final.slug} (${file}).`);
  }
  const itemsResult = await sb
    .from("gta_checklist_items")
    .select("item_key, section_code, title, description, is_required")
    .eq("page_id", page.id);
  if (itemsResult.error) throw itemsResult.error;
  const items = (itemsResult.data ?? []) as DbChecklistItem[];
  if (items.length !== final.items.length) throw new Error(`Item count mismatch for ${final.slug}.`);
  const expected = new Map(final.items.map((item) => [item.key, item]));
  for (const item of items) {
    const source = expected.get(item.item_key);
    if (!source || source.section_code !== item.section_code || source.title !== item.title || source.description !== item.description || source.is_required !== item.is_required) {
      throw new Error(`Item readback mismatch for ${final.slug}/${item.item_key}.`);
    }
  }
  const leafCount = final.items.filter((item) => item.is_required).length;
  if (page.leaf_item_count !== leafCount) throw new Error(`Leaf count mismatch for ${final.slug}.`);

  const url = `${baseUrl}/gta/checklists/${final.slug}`;
  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();
  if (response.status !== 200 || !html.includes(final.title) || !html.includes(`\"numberOfItems\":${leafCount}`)) {
    throw new Error(`${url} failed rendered route verification (HTTP ${response.status}).`);
  }
  console.log(`Verified GTA checklist: ${url} (${leafCount} leaves)`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL, "GTA checklist verification");
  const finals = await Promise.all(options.files.map(readFinal));
  const slugs = new Set<string>();
  for (const final of finals) {
    if (slugs.has(final.slug)) throw new Error(`Duplicate GTA checklist slug: ${final.slug}`);
    slugs.add(final.slug);
  }
  for (let index = 0; index < finals.length; index += 1) {
    await verifyPage(options.baseUrl, finals[index], options.files[index]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
