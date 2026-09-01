import "../shared/load-env";

import fs from "node:fs/promises";
import path from "node:path";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateWikiControlsJson } from "../shared/wiki-controls";
import { isManagedDevelopmentSupabaseUrl, isProductionSupabaseUrl } from "../shared/supabase-target";

type WikiFinal = {
  universe_id: number;
  slug: string;
  title: string;
  seo_title: string;
  meta_description: string;
  description_md: string;
  tips_md: string;
  controls_json: Array<Record<string, string>>;
  cover_image?: string | null;
  is_published?: boolean;
};

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const allowProd = argv.includes("--allow-prod");

function value(name: string): string | null {
  const inline = argv.find((entry) => entry.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1).trim() || null;
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1]?.trim() || null : null;
}

function requiredString(input: unknown, field: string, minimum = 1): string {
  if (typeof input !== "string" || input.trim().length < minimum) {
    throw new Error(`wiki final ${field} must contain at least ${minimum} characters.`);
  }
  return input.trim();
}

async function readFinal(file: string): Promise<WikiFinal> {
  const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Partial<WikiFinal>;
  if (!Number.isSafeInteger(parsed.universe_id) || Number(parsed.universe_id) <= 0) {
    throw new Error("wiki final universe_id must be a positive safe integer.");
  }
  const slug = requiredString(parsed.slug, "slug").toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid wiki slug: ${slug}`);
  const controls = parsed.controls_json ?? [];
  validateWikiControlsJson(controls, `${slug} controls_json`);
  return {
    universe_id: Number(parsed.universe_id),
    slug,
    title: requiredString(parsed.title, "title", 4),
    seo_title: requiredString(parsed.seo_title, "seo_title", 4),
    meta_description: requiredString(parsed.meta_description, "meta_description", 60),
    description_md: requiredString(parsed.description_md, "description_md", 200),
    tips_md: requiredString(parsed.tips_md, "tips_md", 80),
    controls_json: controls,
    cover_image: typeof parsed.cover_image === "string" ? parsed.cover_image.trim() || null : null,
    is_published: parsed.is_published !== false
  };
}

async function main() {
  const finalArg = value("--final-json");
  if (!finalArg) throw new Error("--final-json is required.");
  if (allowProd && !apply) throw new Error("--allow-prod is only valid with --apply.");
  const target = process.env.SUPABASE_URL;
  const managedDev = isManagedDevelopmentSupabaseUrl(target);
  const production = isProductionSupabaseUrl(target);
  if (apply && !managedDev && !allowProd) {
    throw new Error("Refusing wiki runtime write outside managed development without --allow-prod.");
  }
  if (allowProd && !production) {
    throw new Error("--allow-prod requires the recognized production Supabase target.");
  }

  const finalPath = path.resolve(finalArg);
  const final = await readFinal(finalPath);
  const expectedSlug = value("--game")?.toLowerCase();
  const expectedUniverse = value("--universe-id");
  if (expectedSlug && final.slug !== expectedSlug) throw new Error(`Expected slug ${expectedSlug}; received ${final.slug}.`);
  if (expectedUniverse && final.universe_id !== Number(expectedUniverse)) {
    throw new Error(`Expected universe ${expectedUniverse}; received ${final.universe_id}.`);
  }

  const sb = supabaseAdmin();
  const { data: universe, error: universeError } = await sb
    .from("roblox_universes")
    .select("universe_id")
    .eq("universe_id", final.universe_id)
    .maybeSingle();
  if (universeError) throw new Error(`Universe identity read failed: ${universeError.message}`);
  if (!universe) throw new Error(`Universe ${final.universe_id} is missing from the target database.`);

  const { data: conflicts, error: conflictError } = await sb
    .from("wiki_pages")
    .select("id,slug,universe_id")
    .or(`slug.eq.${final.slug},universe_id.eq.${final.universe_id}`);
  if (conflictError) throw new Error(`Wiki identity read failed: ${conflictError.message}`);
  for (const row of conflicts ?? []) {
    if (row.slug !== final.slug || Number(row.universe_id) !== final.universe_id) {
      throw new Error(`Wiki identity collision: ${JSON.stringify(row)}`);
    }
  }

  console.log(`${apply ? "Apply" : "Dry run"}: ${final.slug} -> ${new URL(target!).hostname} (${final.universe_id})`);
  if (!apply) return;

  const payload = {
    slug: final.slug,
    title: final.title,
    seo_title: final.seo_title,
    meta_description: final.meta_description,
    description_md: final.description_md,
    universe_id: final.universe_id,
    controls_json: final.controls_json,
    tips_md: final.tips_md,
    cover_image: final.cover_image ?? null,
    is_published: final.is_published !== false
  };
  const existing = (conflicts ?? [])[0] as { id?: string } | undefined;
  const mutation = existing?.id
    ? sb.from("wiki_pages").update(payload).eq("id", existing.id)
    : sb.from("wiki_pages").insert(payload);
  const { error: upsertError } = await mutation;
  if (upsertError) throw new Error(`Wiki write failed: ${upsertError.message}`);
  const { data: readback, error: readbackError } = await sb
    .from("wiki_pages")
    .select("slug,title,universe_id,is_published,description_md,tips_md")
    .eq("slug", final.slug)
    .single();
  if (readbackError) throw new Error(`Wiki readback failed: ${readbackError.message}`);
  if (
    Number(readback.universe_id) !== final.universe_id ||
    readback.title !== final.title ||
    readback.description_md !== final.description_md ||
    readback.tips_md !== final.tips_md ||
    readback.is_published !== payload.is_published
  ) {
    throw new Error(`Wiki readback mismatch for ${final.slug}.`);
  }
  console.log(`Verified wiki_pages readback for ${final.slug}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
