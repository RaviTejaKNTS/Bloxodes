import "../shared/load-env";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { GAME_DATASET_CATALOG_GROUPS } from "@/lib/game-dataset-catalogs";

type WikiPageUpsert = {
  slug: string;
  title: string;
  seo_title: string;
  meta_description: string;
  universe_id: number | null;
  controls_json: Array<Record<string, string>>;
  tips_md: string;
  is_published: boolean;
  published_at: string | null;
};

type WikiCopy = {
  metaDescription: string;
  tipsMd: string;
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const draft = args.has("--draft");
const allowProd = args.has("--allow-prod");
const UNIVERSE_LOOKUP_PAGE_SIZE = 1000;

const WIKI_COPY: Record<string, WikiCopy> = {
  "steal-a-brainrot": {
    metaDescription: "Steal a Brainrot wiki hub with brainrots, rebirths, traits, mutations, gears, rituals, machines, and lucky blocks.",
    tipsMd: `- Start with the brainrots catalog when you need income, cost, rarity, status, and release details.
- Use rebirths to check required cash, required brainrots, multipliers, slot bonuses, and special unlocks.
- Traits and mutations change value through multipliers and visuals, so compare those before judging an item only by rarity.
- Lucky blocks, fuse machine results, rituals, gears, and machines each have separate rules, costs, or requirements.`
  },
  "sailor-piece": {
    metaDescription: "Sailor Piece wiki hub with fruits, swords, races, bosses, islands, dungeons, traits, runes, Haki, and titles.",
    tipsMd: `- Use islands first when you need level ranges, seas, bosses, and travel progression.
- Compare fruits, swords, races, melee specs, traits, bloodlines, and clans by rarity, stats, effects, and obtainment.
- Bosses, dungeons, runes, relics, and titles are better for reward planning and later progression.
- Haki has a smaller dataset, but it belongs on the wiki because unlock routes, levels, and combat effects matter.`
  },
  "brookhaven-rp": {
    metaDescription: "Brookhaven RP wiki hub with vehicles, houses, jobs, props, locations, gamepasses, outfits, secrets, and roleplay items.",
    tipsMd: `- Brookhaven RP is open-ended roleplay, so use catalogs to pick houses, vehicles, jobs, props, outfits, and locations for the scene you want to build.
- Gamepasses matter when they unlock vehicles, estates, tools, props, avatar effects, or other roleplay options.
- Secrets work better as a step-by-step reference, while vehicles, houses, jobs, and inventory items are best for quick catalog scanning.
- Some prop and emote entries are image-led, so the catalog is useful for identification even when written stats are limited.`
  },
  "adopt-me": {
    metaDescription: "Adopt Me wiki hub with pets, eggs, vehicles, toys, gifts, strollers, potions, furniture, and rewards.",
    tipsMd: `- Start with pets and eggs when you need rarity, availability, source tables, prices, and collection planning.
- Vehicles, toys, strollers, food, potions, gifts, and gift prizes are useful when comparing older items, event items, and current shop options.
- Pet ages are a small reference, but they matter because tricks unlock as pets grow.
- Furniture and house surfaces are large catalogs, so use categories and prices to narrow home customization choices.`
  },
  "blox-fruits": {
    metaDescription: "Blox Fruits wiki hub with fruits, swords, fighting styles, materials, bosses, quests, races, titles, NPCs, and locations.",
    tipsMd: `- Use fruits, swords, guns, fighting styles, races, and accessories when comparing combat builds.
- Materials, quests, bosses, enemies, NPCs, and locations help with progression because they connect sources, levels, rewards, and islands.
- Instinct, aura stages, aura visuals, titles, special titles, and title colors are progression references, so keep them close to the main wiki hub.
- The current game-info data lists level cap 2800, fruit map spawns every hour, fruit despawn after 20 minutes, and dealer restocks every 4 hours.`
  }
};

async function loadExistingPublishedAt() {
  if (dryRun) return new Map<string, string | null>();
  const sb = supabaseAdmin();
  const slugs = GAME_DATASET_CATALOG_GROUPS.map((group) => group.gameSlug);
  const { data, error } = await sb.from("wiki_pages").select("slug, published_at").in("slug", slugs);
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [
      (row as { slug: string }).slug,
      (row as { published_at?: string | null }).published_at ?? null
    ])
  );
}

async function loadUniverseIdsByGameSlug() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) return new Map<string, number | null>();
  const rows = await loadRobloxUniverseLookupRows();

  return new Map(
    GAME_DATASET_CATALOG_GROUPS.map((group) => {
      const candidates = new Set([group.gameSlug, group.gameName, ...group.universeNames].map(normalizeLookup));
      const match = rows.find((row) =>
        [row.slug, row.name, row.display_name].some((value) => candidates.has(normalizeLookup(value)))
      );
      return [group.gameSlug, match?.universe_id ?? null];
    })
  );
}

async function loadRobloxUniverseLookupRows() {
  const sb = supabaseAdmin();
  const rows: Array<{
    universe_id: number;
    slug?: string | null;
    name?: string | null;
    display_name?: string | null;
  }> = [];

  for (let from = 0; ; from += UNIVERSE_LOOKUP_PAGE_SIZE) {
    const to = from + UNIVERSE_LOOKUP_PAGE_SIZE - 1;
    const { data, error } = await sb
      .from("roblox_universes")
      .select("universe_id, slug, name, display_name")
      .order("universe_id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < UNIVERSE_LOOKUP_PAGE_SIZE) break;
  }

  return rows;
}

async function buildRows(existingPublishedAt: Map<string, string | null>, universeIdsByGameSlug: Map<string, number | null>) {
  const now = new Date().toISOString();
  const rows: WikiPageUpsert[] = [];

  for (const group of GAME_DATASET_CATALOG_GROUPS) {
    const copy = WIKI_COPY[group.gameSlug];
    if (!copy) continue;

    rows.push({
      slug: group.gameSlug,
      title: `${group.gameName} Wiki`,
      seo_title: `${group.gameName} Wiki`,
      meta_description: copy.metaDescription,
      universe_id: universeIdsByGameSlug.get(group.gameSlug) ?? null,
      controls_json: [],
      tips_md: copy.tipsMd,
      is_published: !draft,
      published_at: draft ? existingPublishedAt.get(group.gameSlug) ?? null : existingPublishedAt.get(group.gameSlug) ?? now
    });
  }

  return rows;
}

function normalizeLookup(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/!+$/g, "");
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

async function main() {
  if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE)) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. Use --dry-run to preview without writing.");
  }
  if (!dryRun && !allowProd && !isLocalSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to write to a non-local Supabase URL. Use --allow-prod only after local review is clean.");
  }

  const [existingPublishedAt, universeIdsByGameSlug] = await Promise.all([
    loadExistingPublishedAt(),
    loadUniverseIdsByGameSlug()
  ]);
  const rows = await buildRows(existingPublishedAt, universeIdsByGameSlug);

  if (dryRun) {
    console.log(`Prepared ${rows.length} wiki page rows.`);
    for (const row of rows) {
      console.log(`${row.slug} | ${row.title} | universe=${row.universe_id ?? "not linked"}`);
    }
    return;
  }

  const sb = supabaseAdmin();
  const slugs = rows.map((row) => row.slug);
  const { data: existingRows, error: existingError } = await sb
    .from("wiki_pages")
    .select("id, slug")
    .in("slug", slugs);

  if (existingError) throw existingError;

  const idBySlug = new Map(
    (existingRows ?? []).map((row) => [
      (row as { slug: string }).slug,
      (row as { id: string }).id
    ])
  );

  for (const row of rows) {
    const id = idBySlug.get(row.slug);
    if (id) {
      const { error } = await sb.from("wiki_pages").update(row).eq("id", id);
      if (error) throw error;
      continue;
    }

    const { error } = await sb.from("wiki_pages").insert(row);
    if (error) throw error;
  }

  console.log(`Upserted ${rows.length} ${draft ? "draft" : "published"} wiki pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
