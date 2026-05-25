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
  controlsJson?: Array<Record<string, string>>;
};

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const dryRun = args.has("--dry-run");
const draft = args.has("--draft");
const allowProd = args.has("--allow-prod");
const targetGameSlugs = collectArgValues(rawArgs, ["--game", "--game-slug", "--wiki-slug"]);
const UNIVERSE_LOOKUP_PAGE_SIZE = 1000;

function collectArgValues(argv: string[], names: string[]): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const inlineName = names.find((name) => arg.startsWith(`${name}=`));
    if (inlineName) {
      const value = arg.slice(inlineName.length + 1).trim().toLowerCase();
      if (value) values.push(value);
      continue;
    }
    if (names.includes(arg)) {
      const value = argv[i + 1]?.trim().toLowerCase();
      if (!value) throw new Error(`Missing value for ${arg}`);
      values.push(value);
      i += 1;
    }
  }
  return Array.from(new Set(values));
}

function getTargetGroups() {
  return GAME_DATASET_CATALOG_GROUPS.filter(
    (group) => !targetGameSlugs.length || targetGameSlugs.includes(group.gameSlug)
  );
}

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
    metaDescription: "Blox Fruits wiki hub with active codes, fruit and weapon catalogs, quest routes, bosses, sea events, controls, and Roblox game details.",
    tipsMd: `- Follow the quest route before chasing random bosses. First Sea teaches the basic loop, Second Sea starts at Level 700, and Third Sea opens around Level 1500 with late-game islands leading toward the 2800 cap.
- Fruit timing matters because the Blox Fruit Dealer restocks random fruits every 4 hours, while physical fruits can spawn on the map every hour and disappear after 20 minutes.
- Keep core abilities close to your build plan. Aura, Instinct, Dash, Flash Step, and Air Jump affect combat, travel, Elemental enemies, and PvP more than their short names make it sound.
- Save materials instead of treating low-rarity drops as junk. Upgrades, fighting styles, race progress, event shops, and special unlocks can all ask for drops you ignored earlier.
- Use locations, quests, enemies, bosses, NPCs, and materials together when planning a grind route. Blox Fruits progress is usually tied to where you are, what level you are, and which unlock route you are working on.`,
    controlsJson: [
      {
        action: "Move",
        desktop: "W/A/S/D",
        mobile: "Virtual joystick",
        tablet: "Virtual joystick",
        console: "Left stick"
      },
      {
        action: "Jump",
        desktop: "Space",
        mobile: "Jump button",
        tablet: "Jump button",
        console: "A"
      },
      {
        action: "Attack / interact",
        desktop: "Left click",
        mobile: "Tap or attack button",
        tablet: "Tap or attack button",
        console: "RT"
      },
      {
        action: "Dash",
        desktop: "Q",
        mobile: "Dash button",
        tablet: "Dash button",
        console: "Double-tap or wiggle left stick"
      },
      {
        action: "Use fruit or weapon skills",
        desktop: "Z, X, C, V, F",
        mobile: "On-screen skill buttons",
        tablet: "On-screen skill buttons",
        console: "X, Y, B, LT, and mapped skill prompts"
      },
      {
        action: "Race ability",
        desktop: "T",
        mobile: "Race ability button",
        tablet: "Race ability button"
      },
      {
        action: "Toggle Aura",
        desktop: "J",
        mobile: "Aura button",
        tablet: "Aura button",
        console: "D-pad down"
      },
      {
        action: "Toggle Instinct",
        desktop: "E or K",
        mobile: "Instinct button",
        tablet: "Instinct button",
        console: "D-pad left"
      },
      {
        action: "Flash Step",
        desktop: "R",
        mobile: "Flash Step button, then tap a target spot",
        tablet: "Flash Step button, then tap a target spot",
        console: "Right stick press"
      }
    ]
  },
  "wizard-alchemy": {
    metaDescription: "Wizard Alchemy wiki hub with materials, potions, races, equipment, enchantments, chests, NPCs, locations, controls, and Roblox game details.",
    tipsMd: `- Materials and potions drive the main route. Farm ingredients around the Magic threshold you need instead of throwing rare drops into random brews.
- Brew at the spawn Alchemy table, then use the Refine machine only when you can afford the risk. Three matching potions give the cleanest upgrade attempt.
- Quests and monster farming are the early Gold engine. Harryint's starter quests, goblins, dwarfs, and Fugitive Orc routes help you buy wand, robe, hat, and stat upgrades before bosses feel comfortable.
- Keep Race Rerolls and Enchanted Stones for a build plan. A useful race or wand enchantment that fits your element, cooldowns, or survival is better than gambling every reward immediately.
- Learn the fixed route landmarks before New Mainland runs. Spawn services, river, mine, lighthouse side, Dwarf King, chests, and hidden shops decide how fast you gather materials and recover between fights.`,
    controlsJson: [
      {
        action: "Move",
        desktop: "W/A/S/D"
      },
      {
        action: "Jump",
        desktop: "Space"
      },
      {
        action: "Dash",
        desktop: "Q"
      },
      {
        action: "Attack",
        desktop: "Left mouse button"
      },
      {
        action: "Cast spells",
        desktop: "E / R"
      },
      {
        action: "Walk / run toggle",
        desktop: "Ctrl"
      }
    ]
  },
  "slime-rng": {
    metaDescription:
      "Slime RNG wiki hub with active codes, slime catalogs, zones, crafting recipes, items, Power Fruits, rebirths, index rewards, guides, and Roblox stats.",
    tipsMd: `- Roll with a goal in mind. Odds and variants show how hard a slime is to replace, while Power and Health decide whether it helps your team clear enemies.
- Push zones when your best slimes can kill enemies comfortably. New zones cost Coins, raise your highest-zone luck, and increase the Goop you can earn from kills.
- Check crafting recipes before feeding or discarding rare pulls. Each recipe consumes three named slimes, and later recipes can ask for crafted results or hard-to-roll ingredients.
- Time items around one job. Food belongs on slimes you plan to keep, 3-minute potions need a focused rolling or farming window, and mutation dice affect the next roll.
- Place Power Fruits carefully. A slime can only hold one fruit power, the fruit cannot be removed, and powered slimes cannot be used in the crafting machine.
- Rebirth when the Goop cost and luck multiplier are worth rebuilding. Rebirth resets Coins and unlocked zones, but your slimes, upgrades, luck, and highest-zone progress stay.
- Claim index rewards as collection milestones across Basic, Big, Huge, Shiny, and Inverted tracks. Those rewards can feed the next roll, fight, item window, or rebirth push.`,
    controlsJson: []
  },
  "kick-a-lucky-block": {
    metaDescription:
      "Kick a Lucky Block wiki hub with brainrots, mutations, weights, zones, Roblox details, and progression tips.",
    tipsMd: `- Kick power decides how far the lucky block travels, so weights and training upgrades matter before chasing higher zones.
- Brainrots earn cash on your plot after you bring them back safely. A far-zone roll is only useful if you survive the return.
- Mutations change brainrot earning value, but public odds are incomplete for some newer entries. Treat unknown odds as unknown instead of assuming they match nearby multipliers.
- Zones raise the reward ceiling as the block travels farther, while tsunami pressure makes return speed and positioning part of the route.
- Luck-source details beyond normal item and progression systems are still source-disputed, so keep boost planning flexible until in-game values are verified.`,
    controlsJson: []
  }
};

async function loadExistingPublishedAt() {
  if (dryRun) return new Map<string, string | null>();
  const sb = supabaseAdmin();
  const slugs = getTargetGroups().map((group) => group.gameSlug);
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
    getTargetGroups().map((group) => {
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

  for (const group of getTargetGroups()) {
    const copy = WIKI_COPY[group.gameSlug];
    if (!copy) continue;

    rows.push({
      slug: group.gameSlug,
      title: `${group.gameName} Wiki`,
      seo_title: `${group.gameName} Wiki`,
      meta_description: copy.metaDescription,
      universe_id: universeIdsByGameSlug.get(group.gameSlug) ?? null,
      controls_json: copy.controlsJson ?? [],
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
    .replace(/\s*\[[^\]]+\]\s*$/g, "")
    .trim()
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

  if (rows.length === 0) {
    throw new Error("No wiki pages matched the provided filters.");
  }

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
