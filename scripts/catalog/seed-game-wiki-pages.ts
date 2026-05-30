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
  cover_image?: string | null;
  is_published: boolean;
  published_at: string | null;
};

type WikiCopy = {
  metaDescription: string;
  tipsMd: string;
  controlsJson?: Array<Record<string, string>>;
  gameDescriptionMd?: string;
  coverImage?: string | null;
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
  },
  "survive-zombie-arena": {
    metaDescription:
      "Survive Zombie Arena wiki with classes, weapons, gear, maps, upgrades, Roblox stats, and wave-survival planning.",
    gameDescriptionMd:
      "Survive Zombie Arena is a wave-survival shooter where each run starts with preparation in the lobby, then turns into a fight against huge zombie waves. You earn Credits by killing zombies and surviving longer, then spend them on class unlocks, Armory weapons, gear, and Mr. Santito upgrades before the next push. The game rewards a clear role more than random spending: pick a class, cover a Rooftop lane, upgrade the weapon you actually use, and build enough damage and delay tools to keep the horde from collapsing your hold.",
    tipsMd: `- Treat each run as a Credits problem. Zombies and waves feed your economy, and the best spend is usually the class, weapon, or upgrade that stops the next wave from breaking your hold.
- Pick a class for the job you expect to do. Medic and Marksman are cleaner early unlocks, Engineer and Tactician help lane holds, and Necromancer is a long-term Credit sink for late-wave scaling.
- Buy weapons by Armory slot instead of collecting every sidegrade. Shotgun-style weapons help early packs, Rifle/Burst/AK style guns cover mid-wave pressure, and heavy or crate weapons make more sense once your Credit route is stable.
- Upgrade the weapon you are actually firing at Mr. Santito's shop. Damage or fire-rate improvements on your main lane gun usually beat saving for a flashy weapon that will sit unused.
- Build gear around a shared hold point. Barricades, turrets, traps, healing tools, bunkers, and drones work when the team commits to a Rooftop lane before zombies start flooding the stairs and ramps.
- Use current map status before copying older farming advice. Rooftop Map is the current reference, Square Arena is retired context, and Atlantis belongs outside planning until its live layout is confirmed.
- Keep preview and event claims separate from your main plan. Unverified enemies, crate pools, map previews, and event reward rumors should not replace a guaranteed Credit upgrade or class unlock.`,
    controlsJson: [
      { action: "Move", desktop: "W / A / S / D" },
      { action: "Jump", desktop: "Spacebar" },
      { action: "Fire weapon", desktop: "Left Mouse Button" },
      { action: "Equip weapon slot", desktop: "1 / 2 / 3 / 4" },
      { action: "Reload", desktop: "R" },
      { action: "Sprint", desktop: "Shift" }
    ]
  },
  "99-nights-in-the-forest": {
    metaDescription:
      "99 Nights in the Forest wiki with survival tips, classes, crafting, materials, weapons, tools, food, locations, entities, and animals.",
    coverImage: "/99%20Nights%20in%20the%20Forest/Entities/the-deer.webp",
    gameDescriptionMd:
      "99 Nights in the Forest is a co-op survival game about keeping a camp alive while the forest gets more dangerous at night. A normal run moves between fueling the Campfire, gathering food and materials, crafting upgrades, rescuing missing children, and choosing when to push into cultist, cave, snow, or volcano routes. Classes, tools, weapons, food, tameable animals, entities, and locations all change how safely you can leave camp and return before hunger, darkness, raids, or major threats punish an overextended trip.",
    tipsMd: `- Fuel the Campfire and plan a safe return before long routes. A good loot run can fall apart if the team comes back hungry, underarmed, or too late at night.
- Pick a class around the job you want to handle. Some classes make early gathering easier, while others matter more for combat, support, building, food, or late-run goals.
- Build around the Crafting Bench instead of spending rare materials at random. Better storage, light, food support, defenses, and station upgrades can make the next rescue or biome route safer.
- Bring food, weapons, and utility tools before pushing cultist, cave, snow, or volcano routes. The destination can be dangerous, but the return trip also needs enough hunger, health, and fuel left.
- Treat limited, removed, event-only, and admin-only rows as reference context unless the active route still exists. A normal survival plan should focus on gear, materials, and locations you can actually use in a run.`,
    controlsJson: [
      {
        action: "Move",
        desktop: "W / A / S / D",
        mobile: "Virtual joystick"
      },
      {
        action: "Jump",
        desktop: "Space"
      },
      {
        action: "Sprint",
        desktop: "Left Shift",
        mobile: "Sprint button"
      },
      {
        action: "Attack / use equipped tool",
        desktop: "Left Mouse Button",
        mobile: "Tap target or on-screen attack button"
      },
      {
        action: "Interact / pick up",
        desktop: "Press or hold E",
        mobile: "Tap the on-screen prompt"
      },
      {
        action: "Open map after crafting it",
        desktop: "M",
        mobile: "Map icon in the top-right"
      },
      {
        action: "Store items with a sack equipped",
        desktop: "F"
      }
    ]
  },
  rivals: {
    metaDescription:
      "RIVALS wiki hub with codes, weapons, maps, skins, wraps, charms, finishers, emotes, UGC items, Roblox details, and practical duel tips.",
    tipsMd: `- RIVALS is built around short first-to-5 duels, so judge your loadout by repeated rounds, not one lucky fight.
- Spend Keys with every weapon slot in mind. Primary, Secondary, Melee, and Utility choices all change how you handle peeks, pressure, and cleanup rounds.
- Start contracts on weapons you actually use. A contract reward is easier to finish when the weapon already fits your normal duel plan.
- Learn the map before blaming the weapon. Regular, big, experimental, legacy, and private-server maps can change sightlines, team size pressure, and safe angles.
- Cosmetic source matters more than rarity alone. Skins, wraps, charms, finishers, and emotes can come from cases, boxes, capsules, shop routes, bundles, milestones, old code or event origins, ranked sources, UGC rewards, or special grants.
- Official RIVALS UGC is Roblox avatar gear from Nosniy Games. It is separate from weapon skins, and official purchases can count toward the in-game UGC reward track.`,
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

    const row: WikiPageUpsert = {
      slug: group.gameSlug,
      title: `${group.gameName} Wiki`,
      seo_title: `${group.gameName} Wiki`,
      meta_description: copy.metaDescription,
      universe_id: universeIdsByGameSlug.get(group.gameSlug) ?? null,
      controls_json: copy.controlsJson ?? [],
      tips_md: copy.tipsMd,
      is_published: !draft,
      published_at: draft ? existingPublishedAt.get(group.gameSlug) ?? null : existingPublishedAt.get(group.gameSlug) ?? now
    };
    if ("coverImage" in copy) {
      row.cover_image = copy.coverImage ?? null;
    }
    rows.push(row);
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

  for (const group of getTargetGroups()) {
    const copy = WIKI_COPY[group.gameSlug];
    const universeId = universeIdsByGameSlug.get(group.gameSlug);
    if (!copy?.gameDescriptionMd || !universeId) continue;

    const { error } = await sb
      .from("roblox_universes")
      .update({ game_description_md: copy.gameDescriptionMd })
      .eq("universe_id", universeId);
    if (error) throw error;
  }

  console.log(`Upserted ${rows.length} ${draft ? "draft" : "published"} wiki pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
