import "../shared/load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { GAME_COLLECTION_GROUPS, GAME_COLLECTIONS } from "@/lib/game-collections";
import { repoPath } from "@/lib/paths";
import { validateWikiControlsJson } from "../shared/wiki-controls";
import { isManagedDevelopmentSupabaseUrl } from "../shared/supabase-target";

type GameCollectionGroup = (typeof GAME_COLLECTION_GROUPS)[number];

type WikiPageUpsert = {
  slug: string;
  title: string;
  seo_title: string;
  meta_description: string;
  description_md: string;
  universe_id: number | null;
  controls_json: Array<Record<string, string>>;
  tips_md: string;
  cover_image?: string | null;
  is_published: boolean;
  published_at: string | null;
};

type WikiCopy = {
  title?: string;
  seoTitle?: string;
  metaDescription: string;
  descriptionMd: string;
  tipsMd: string;
  controlsJson?: Array<Record<string, string>>;
  coverImage?: string | null;
};

type WikiFinalJson = Partial<{
  slug: string;
  title: string;
  seo_title: string;
  meta_description: string;
  universe_id: number | null;
  controls_json: Array<Record<string, string>>;
  tips_md: string;
  description_md: string;
  cover_image: string | null;
}>;

type ResolvedWikiCopy = {
  title: string;
  seoTitle: string;
  metaDescription: string;
  descriptionMd: string;
  tipsMd: string;
  universeId?: number | null;
  controlsJson: Array<Record<string, string>>;
  coverImage?: string | null;
};

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const dryRun = args.has("--dry-run");
const draft = args.has("--draft");
const allowProd = args.has("--allow-prod");
const allowGeneratedCopy = args.has("--allow-generated-copy");
const targetGameSlugs = collectArgValues(rawArgs, ["--game", "--game-slug", "--wiki-slug"]);
const finalJsonRoot = collectSingleArgValue(rawArgs, ["--final-json-root", "--final-json-dir"]);
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

function collectSingleArgValue(argv: string[], names: string[]): string | null {
  let found: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const inlineName = names.find((name) => arg.startsWith(`${name}=`));
    if (inlineName) {
      const value = arg.slice(inlineName.length + 1).trim();
      if (!value) throw new Error(`Missing value for ${inlineName}`);
      if (found && found !== value) throw new Error(`Multiple values provided for ${inlineName}`);
      found = value;
      continue;
    }
    if (names.includes(arg)) {
      const value = argv[i + 1]?.trim();
      if (!value) throw new Error(`Missing value for ${arg}`);
      if (found && found !== value) throw new Error(`Multiple values provided for ${arg}`);
      found = value;
      i += 1;
    }
  }
  return found;
}

function getTargetGroups() {
  return GAME_COLLECTION_GROUPS.filter(
    (group) => !targetGameSlugs.length || targetGameSlugs.includes(group.gameSlug)
  );
}

async function findExistingFile(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

async function readFinalJsonOverride(group: GameCollectionGroup): Promise<WikiFinalJson | null> {
  if (!finalJsonRoot) return null;

  const root = path.isAbsolute(finalJsonRoot) ? finalJsonRoot : repoPath(finalJsonRoot);
  const filePath = await findExistingFile([
    path.join(root, group.gameSlug, "wiki", "final.json"),
    path.join(root, "wiki", group.gameSlug, "final.json"),
    path.join(root, group.gameSlug, "final.json"),
    path.join(root, "wiki", "final.json"),
    path.join(root, "final.json")
  ]);

  if (!filePath) {
    throw new Error(`Missing wiki final.json for ${group.gameSlug} under ${root}`);
  }

  const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as WikiFinalJson;
  if (parsed.slug && parsed.slug !== group.gameSlug) {
    throw new Error(`Wiki final.json slug ${parsed.slug} does not match ${group.gameSlug}`);
  }
  return parsed;
}

async function resolveWikiCopy(group: GameCollectionGroup): Promise<ResolvedWikiCopy | null> {
  const finalJson = await readFinalJsonOverride(group);
  const legacyCopy = WIKI_COPY[group.gameSlug];
  const generatedCopy = allowGeneratedCopy ? buildGeneratedWikiCopy(group) : null;

  if (!finalJson && !legacyCopy && !generatedCopy) return null;

  const metaDescription = finalJson?.meta_description ?? legacyCopy?.metaDescription ?? generatedCopy?.metaDescription;
  const descriptionMd = finalJson ? finalJson.description_md : legacyCopy?.descriptionMd ?? generatedCopy?.descriptionMd;
  const controlsJson = finalJson ? finalJson.controls_json : legacyCopy?.controlsJson ?? generatedCopy?.controlsJson ?? [];
  const tipsMd = finalJson?.tips_md ?? legacyCopy?.tipsMd ?? generatedCopy?.tipsMd;
  if (!metaDescription) throw new Error(`Missing meta_description for ${group.gameSlug}`);
  if (!descriptionMd) throw new Error(`Missing description_md for ${group.gameSlug}`);
  if (!tipsMd) throw new Error(`Missing tips_md for ${group.gameSlug}`);
  validateWikiControlsJson(controlsJson, `${group.gameSlug} controls_json`);

  return {
    title: finalJson?.title ?? legacyCopy?.title ?? generatedCopy?.title ?? `${group.gameName} Wiki`,
    seoTitle: finalJson?.seo_title ?? legacyCopy?.seoTitle ?? generatedCopy?.seoTitle ?? `${group.gameName} Wiki`,
    metaDescription,
    descriptionMd,
    tipsMd,
    universeId: finalJson && "universe_id" in finalJson ? finalJson.universe_id ?? null : undefined,
    controlsJson,
    coverImage:
      finalJson && "cover_image" in finalJson
        ? finalJson.cover_image ?? null
        : legacyCopy && "coverImage" in legacyCopy
          ? legacyCopy.coverImage ?? null
          : generatedCopy && "coverImage" in generatedCopy
            ? generatedCopy.coverImage ?? null
            : undefined
  };
}

function buildGeneratedWikiCopy(group: GameCollectionGroup): WikiCopy {
  const collections = GAME_COLLECTIONS.filter((config) => config.gameSlug === group.gameSlug).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  const labels = collections.map((config) => config.label);
  const collectionList = toReadableList(labels.slice(0, 8));
  const collectionCount = collections.length;
  const pageCountLabel = collectionCount.toLocaleString("en-US");
  const title = `${group.gameName} Wiki`;
  const metaDescription = truncateMeta(
    `${group.gameName} wiki hub with ${collectionList || "game collections"}, controls, tips, and related Roblox collection pages.`
  );
  const descriptionMd = `${group.gameName} is tracked on Bloxodes as a Roblox wiki hub for durable game systems, collection pages, and player reference data. Use this page as the starting point, then open a collection when you need item-level details.

The current local registry includes ${pageCountLabel} ${collectionCount === 1 ? "collection" : "collections"} for ${group.gameName}${collectionList ? `, including ${collectionList}` : ""}. Those collection pages hold the specific rows, fields, images, and grouping used by the public wiki experience.

This generated hub copy exists so local verification can load every registered wiki route from the same automation path. For production writing, prefer an approved wiki final.json with game-specific description, controls, and tips.`;
  const tipsMd = `- Start with the collection list when you need item-level data.
- Use card view for quick recognition and table view for scanning many rows.
- Treat blank fields as unknown instead of guessing missing game data.
- Check the related collection pages before deciding what to unlock, buy, trade, or save.
- Replace generated hub copy with approved game-specific copy before intentional production publishing.`;

  return {
    title,
    seoTitle: title,
    metaDescription,
    descriptionMd,
    tipsMd,
    controlsJson: [],
    coverImage: null
  };
}

const WIKI_COPY: Record<string, WikiCopy> = {
  "untitled-boxing-game": {
    metaDescription:
      "Untitled Boxing Game wiki hub with styles, gloves, emotes, knockout effects, titles, controls, and Roblox game details.",
    descriptionMd:
      "Untitled Boxing Game is a skill-based Roblox boxing battleground where most fights come down to stamina, reads, side dodges, back dashes, blocks, feints, and knowing what your fighting style wants to do. A normal match is not button mashing: every punch, dash, block, and feint can spend stamina, so strong players win by creating openings instead of throwing every heavy attack on cooldown.\n\nProgress sits around that fight loop. Cash, spins, lucky spins, daily quests, title quests, style rolls, ranked rating, and cosmetic shops all give players something to chase between matches. Styles shape combat, while gloves, emotes, maps, knockout effects, and titles let players customize how their fighter looks, celebrates, enters fights, or marks achievements.\n\nThe official Roblox description says every style can work, and the stronger community references make the same point in practice: rarity helps, but timing still matters. Learn the core controls first, then use styles, gloves, emotes, knockout effects, and title requirements to decide what to keep, trade, buy, or chase next.",
    tipsMd: `- Manage stamina before trying flashy pressure. Punches, dashes, blocks, and feints all matter more when you leave enough stamina to defend after your combo.
- Learn the difference between side dodges and back dashes. Side dodges help you slip left or right around an attack, while a back dash creates space when pressure is too close.
- Use feints to punish defensive habits. A cancelled attack can bait a block or dodge, then open a heavier hit or ultimate attempt.
- Treat styles as playstyle choices. The game says every style is viable, so keep a kit long enough to learn its rhythm before rerolling it away.
- Save spins and lucky spins for a goal. Preferred Legendary boosts and pity systems make more sense when you know which style you actually want.
- Practice in casual before ranked. Casual can use cosmetic maps and is safer for learning timing, while ranked uses standard rules and default-map pressure.
- Check glove availability before trading. Standard crate gloves are easier to understand than beta, ranked, holiday, event, or special-route gloves that may be harder to replace.
- Knockout effects, emotes, maps, and titles are identity systems, not direct power upgrades. Pick them for source, availability, behavior, or the achievement they represent.`,
    controlsJson: [
      {
        action: "Light punch",
        desktop: "M1 / left mouse button",
        mobile: "Tap left side",
        console: "Xbox X / PlayStation Square"
      },
      {
        action: "Heavy punch",
        desktop: "M2 / right mouse button",
        mobile: "Tap right side",
        console: "Xbox Y / PlayStation Triangle"
      },
      {
        action: "Dodge left / right",
        desktop: "Q",
        mobile: "Swipe left / right",
        console: "Xbox LB / RB, PlayStation L1 / R1"
      },
      {
        action: "Back dash",
        desktop: "E",
        mobile: "Swipe back",
        console: "Xbox LT / PlayStation L2"
      },
      {
        action: "Block",
        desktop: "Hold F",
        mobile: "Hold Block button",
        console: "Hold Xbox RT / PlayStation R2"
      },
      {
        action: "Feint",
        desktop: "V",
        mobile: "Feint button",
        console: "Xbox A / PlayStation Cross"
      },
      {
        action: "Ultimate",
        desktop: "R",
        mobile: "Ultimate button",
        console: "Xbox B / PlayStation Circle"
      }
    ],
    coverImage: "https://tr.rbxcdn.com/180DAY-91b9e5091f844a9a2630ca702e4d4334/512/512/Image/Png/noFilter"
  },
  "grow-a-garden-2": {
    metaDescription:
      "Grow a Garden 2 wiki hub with seeds, crops, pets, gears, sprinklers, crates, mutations, shops, night stealing, codes, and Roblox game details.",
    descriptionMd:
      "Grow a Garden 2 is a farming and garden-defense Roblox game where every session starts with seeds, crops, and Sheckles. You buy seeds, plant them on your farm, wait for crops to grow, harvest the fruit, and sell it so the next round of seeds, pets, gears, crates, and upgrades is easier to afford.\n\nThe sequel adds more pressure around the garden itself. Daytime is the cleaner farming window, while night turns the map into a stealing and defense problem. If you leave your plot open at night, other players can try to take fruit, so pets, props, crates, mushrooms, lanterns, and defensive setups matter alongside normal crop value.\n\nMost progress comes from choosing what to spend on next. Multi-harvest plants are better for steady farming, sprinklers help crops grow and improve special results, pets can boost farming or protect the plot, and mutations can turn a normal harvest into a much better sale. Guilds and weekly rewards give returning players another reason to keep the garden moving instead of only planting the most expensive seed they can afford.",
    tipsMd: `- Start with seeds and crops before chasing expensive pets or crates. A steady Sheckles route makes every later upgrade easier to afford.
- Keep multi-harvest plants working in your plot when you can. They keep producing after the first pickup, while single-harvest crops need replanting.
- Watch the day and night cycle. Daytime is better for planting and selling, while night is when stealing and garden defense become the main problem.
- Buy gears for a job, not just rarity. Sprinklers help growth and crop results, mushrooms help stealing or movement, and defensive tools help protect valuable fruit.
- Pets matter more once your garden has value worth protecting. Some help farming, some improve movement or mutations, and stronger defensive pets are better when night stealing becomes a real risk.
- Crates and props are part of the garden plan. Owner doors, traps, fences, conveyors, and teleporter pieces can change how easy your plot is to enter or defend.
- Treat mutations as value boosts on top of farming. Weather, pet support, and special effects can make one harvest much stronger than a normal crop sale.`,
    controlsJson: [
      {
        action: "Move",
        desktop: "W / A / S / D or arrow keys",
        mobile: "Virtual joystick",
        console: "Left stick"
      },
      {
        action: "Jump",
        desktop: "Space",
        mobile: "Jump button",
        console: "A"
      },
      {
        action: "Adjust camera",
        desktop: "Hold right mouse button and drag",
        mobile: "Drag on the right side of the screen",
        console: "Right stick"
      },
      {
        action: "Zoom camera",
        desktop: "Mouse wheel",
        mobile: "Pinch the screen"
      },
      {
        action: "Use shop, garden, sell, and prompt buttons",
        desktop: "Click the on-screen button or prompt",
        mobile: "Tap the on-screen button or prompt"
      }
    ],
    coverImage: null
  },
  "push-rock-for-brainrots": {
    metaDescription:
      "Push Rock for Brainrots wiki hub with Brainrots, rock gates, upgrades, rebirths, controls, and Roblox game details.",
    descriptionMd:
      "Push Rock for Brainrots is a Roblox rescue and tycoon game where rocks are the main gate between you and better Brainrots. A normal run is simple: push a rock, open the lane, rescue the Brainrot behind it, bring that Brainrot home, and use the Cash income to get stronger for the next push.\n\nThe loop gets harder as the route moves into stronger rarity gates. Strength decides whether a rock is worth fighting through, Carry decides how many rescued Brainrots you can move before returning home, and Rebirth turns a strong cash run into longer-term progress. Hunters add pressure while you are moving through the route, so cash upgrades and clean return trips matter more than just chasing the rarest visible Brainrot.\n\nStart by learning which rarity gate you are pushing toward, then use Brainrot income and upgrade panels to decide whether to spend Cash on Strength, Carry, or a Rebirth reset.",
    tipsMd: `- Upgrade Strength first when a rock gate barely moves. Bigger rocks are the main blocker between early rescues and stronger rarity lanes.
- Upgrade Carry when return trips start wasting time. More Carry means you can bring home more rescued Brainrots before heading back to base.
- Treat Rebirth as a reset decision. The panel gives stronger long-term rewards, but you still need enough Cash to rebuild after using it.
- Watch for Hunters while pushing or carrying Brainrots. A risky route only helps if you actually bring the rescue home and bank the Cash.`,
    controlsJson: [
      {
        action: "Move",
        desktop: "W / A / S / D or arrow keys",
        mobile: "Virtual joystick",
        console: "Left stick"
      },
      {
        action: "Jump",
        desktop: "Space",
        mobile: "Jump button",
        console: "A"
      },
      {
        action: "Push rocks",
        desktop: "Walk into the rock lane",
        mobile: "Move into the rock lane",
        console: "Move into the rock lane"
      },
      {
        action: "Use prompts, shop, upgrades, and rebirth",
        desktop: "Click the on-screen button or prompt",
        mobile: "Tap the on-screen button or prompt",
        console: "Use the on-screen prompt"
      }
    ],
    coverImage: "https://tr.rbxcdn.com/180DAY-78502ae7ad5eb1cd679d9d5d755901f8/512/512/Image/Png/noFilter"
  },
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
  "pet-simulator-99": {
    metaDescription:
      "Pet Simulator 99 wiki hub with pets, eggs, areas, machines, enchants, potions, mastery, minigames, relics, and trading cosmetics.",
    descriptionMd: `Pet Simulator 99 is a pet-collecting progression game where your pets break objects for coins and other currencies. Those currencies feed the main route: hatch better pets, unlock more areas, reach new worlds, and open the machines, eggs, minigames, chests, and rebirth gates tied to each part of the map.

Progress gets deeper once the early route opens up. Enchant books shape your loadout, potions add timed boosts, charms modify valuable pets, machines convert or upgrade pets and items, and mastery tracks reward repeated activities such as breaking objects, hatching, fishing, digging, keys, gifts, and machines.

The collection side matters just as much as raw progress. Huge, Titanic, and Gargantuan pets, retired eggs, hoverboards, booth skins, Shiny Relics, and Trading Plaza routes all depend on source, availability, and how hard something is to replace. Exact item names, locations, unlock routes, and counts are best handled by the matching system list.`,
    tipsMd: `- Push areas first when you are stuck. New areas unlock stronger eggs, better farming zones, machines, minigames, rebirth gates, and later worlds.
- Hatch around the egg you can afford to repeat. A rare pet is useful, but steady hatching and area progress usually matter more than chasing one expensive pull too early.
- Check machine inputs before spending pets or items. Some stations are simple upgrades, while others consume valuable pets, lock rewards behind timers, or use limited recipes.
- Time potions and enchants around one job. Farming, hatching, damage, drops, mastery XP, and chest runs all want different boost setups.
- Treat mastery as a long grind, not a side note. Breakables, eggs, gifts, keys, potions, enchants, fishing, digging, and machines all improve when you keep using their systems.
- Use minigame timers and Shiny Relic routes as repeat goals between area pushes. They are easiest to manage when you know the area or world each one belongs to.
- For hoverboards, booths, retired eggs, and older pets, source and availability matter more than rarity alone. Some items are direct unlocks, while others mostly depend on trading.`,
    controlsJson: [
      {
        action: "Move",
        desktop: "W / A / S / D or arrow keys",
        mobile: "Virtual joystick"
      },
      {
        action: "Jump",
        desktop: "Space",
        mobile: "Jump button"
      },
      {
        action: "Break objects and collect rewards",
        desktop: "Click breakables, rewards, or UI buttons",
        mobile: "Tap breakables, rewards, or UI buttons"
      },
      {
        action: "Use machines, eggs, menus, and prompts",
        desktop: "Click the prompt or button",
        mobile: "Tap the prompt or button"
      },
      {
        action: "Equip or unequip hoverboard",
        desktop: "Q or the hoverboard icon",
        mobile: "Hoverboard icon"
      }
    ],
    coverImage: null
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
  "1-speed-keyboard-escape": {
    metaDescription:
      "+1 Speed Keyboard Escape wiki hub for codes, trails, auras, stages, treadmills, rebirth tips, and Roblox game details.",
    tipsMd: `- Build Speed before forcing a stage, but learn each route at a controllable pace first. High Speed helps you cross gaps, yet it can also send you back to the start faster if you hold a direction too long.
- Rebirth when the game offers it and the multiplier is your next real progress step. The reset hurts for a moment, but the permanent bonus makes later Speed grinding easier.
- Treat Wins as upgrade currency before convenience currency. Teleports help once you already know a route, while Trails and Auras affect how quickly your Speed grows afterward.
- Use treadmills when you are short of a stage recommendation or rebuilding after a rebirth, then return to stage clears when you need Wins.
- In tight turns, maze sections, or chaser routes, use short movement taps instead of holding a key through every corner.`,
    controlsJson: [
      {
        action: "Move",
        desktop: "W / A / S / D or arrow keys"
      },
      {
        action: "Jump",
        desktop: "Space"
      },
      {
        action: "Adjust camera",
        desktop: "Hold right mouse button and drag"
      },
      {
        action: "Zoom camera",
        desktop: "Mouse wheel"
      }
    ],
    coverImage: null,
    descriptionMd:
      "+1 Speed Keyboard Escape | Candy & Chocolate is an incremental obby where every step builds Speed. You run and jump across candy-and-chocolate keyboard routes, then try to clear stage sections without losing control and being sent back to the start.\n\nProgress comes from more than walking. Stage clears feed Wins, Wins connect into upgrade choices, and Rebirths turn a reset into a stronger long-term Speed multiplier. Trails, Auras, and Treadmills all sit around that same loop: they help you rebuild faster, push into harder routes, or train Speed when active stage runs start to stall.\n\nThe smartest path is to understand the loop before spending. Build enough Speed for the route in front of you, use Wins on upgrades that keep helping after the next run, and treat exact item bonuses or treadmill options as details to compare before committing."
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
    descriptionMd:
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
  "murderers-vs-sheriffs": {
    metaDescription:
      "Murderers VS Sheriffs wiki with duel modes, weapons, crates, bundles, death effects, events, codes, trading tips, and Roblox details.",
    descriptionMd:
      "Murderers VS Sheriffs is a fast duel game where players queue into short sheriff-and-murderer fights and practice aim, dodging, knife timing, and round reads. The verified queue structure for the MVS Duels Community version covers solo `1v1`, team `2v2` and `3v3`, plus pass-gated Pro Servers access.\n\nProgress around the matches is mostly cosmetic and collection-driven. Coins, codes, PRO and GOD boxes, weapon skins, bundles, death effects, emotes, event rewards, and trading all feed into the inventory loop, so source and availability matter before you spend or accept a trade.\n\nThis version is separate from older similarly named Murderers VS Sheriffs games. Treat item lists, values, maps, battle pass notes, and reward claims as useful only when they tie back to this exact MVS Duels Community experience.",
    tipsMd: `- Start with 1v1 when you want clean aim and knife timing practice. Move into 2v2 or 3v3 when you want teammate spacing, trades, and crossfire to matter more.
- Treat Pro Servers as pass-gated access first. The verified data proves the Pro Servers Pass requirement, but not special rewards, matchmaking rules, or a guaranteed harder queue.
- Compare boxes by the facts the game shows before spending heavily. A PRO or GOD label is useful, but reward pools, odds, discounts, and duplicate rules matter more than the name alone.
- Check source and availability before trading for a weapon, bundle, death effect, or event item. Rarity and community value help, but they do not replace exact-game proof for this MVS Duels Community version.
- Read the arena quickly after a round starts. Open sightlines favor patient gun angles, while tighter cover gives knife pressure and teammate trades more room to work.
- Use codes and event rewards as bonus routes, not the whole plan. Live rewards can change, while queue practice, careful spending, and source checks stay useful every session.`,
    controlsJson: [
      {
        action: "Move",
        desktop: "W / A / S / D or arrow keys"
      },
      {
        action: "Jump",
        desktop: "Space"
      },
      {
        action: "Adjust camera",
        desktop: "Hold right mouse button and drag"
      },
      {
        action: "Zoom camera",
        desktop: "Mouse wheel"
      }
    ],
    coverImage: null
  },
  "dress-to-impress": {
    metaDescription:
      "Dress To Impress wiki hub with codes, events, theme help, item catalogs, gameplay tips, controls, and Roblox game details.",
    descriptionMd:
      "Dress To Impress is a timed fashion-round game where each player gets a theme, builds an outfit in the dressing room and salon, then walks the runway for votes. The round is about reading the prompt quickly, choosing clothing, hair, makeup, colors, patterns, and accessories that make the idea obvious, then using poses and presentation to sell the look.\n\nStars come from runway voting and move players through ranks, while Cash and seasonal currencies help unlock more wardrobe and presentation options. Codes, events, reward items, VIP pieces, pose packs, walk packs, runway effects, pattern packs, and theme knowledge all feed into the same goal: having more ways to answer a prompt before the timer ends.\n\nUse the wiki hub as the high-level map. The detailed catalog pages handle row-by-row theme meanings, rank thresholds, item sources, prices, unlock routes, images, and availability notes.",
    tipsMd: `- Read the theme first, then choose one clear silhouette or color direction before adding small accessories.
- Jump out of stations as soon as a choice is done so the dressing timer does not get eaten by menus.
- Use Freeplay to test outfits, colors, pattern packs, poses, walk packs, and runway effects before trying them in a timed round.
- Spend Cash around items or packs you will reuse across many themes before chasing a display item you may wear once.
- Treat codes, events, and reward routes as bonus wardrobe sources. The related pages should handle exact code and event details.
- Ranks explain Star progression, while item, pose, walk, pattern, VIP, and reward rows carry the exact unlock details.`,
    controlsJson: [
      {
        action: "Move",
        desktop: "W/A/S/D or arrow keys",
        mobile: "Drag the on-screen joystick",
        console: "Left stick"
      },
      {
        action: "Interact with a station",
        desktop: "E",
        mobile: "Tap the station or item",
        console: "X on Xbox / Square on PlayStation"
      },
      {
        action: "Choose station options",
        desktop: "Click with the mouse",
        mobile: "Tap the option",
        console: "Controller mode, then A on Xbox / Circle on PlayStation"
      },
      {
        action: "Leave a station",
        desktop: "Space",
        mobile: "Jump button",
        console: "A on Xbox / X on PlayStation"
      },
      {
        action: "Zoom camera",
        desktop: "Mouse wheel",
        mobile: "Two-finger pinch",
        console: "Press the right stick"
      },
      {
        action: "Vote on the runway",
        desktop: "Click the star rating",
        mobile: "Tap the star rating",
        console: "Controller mode, navigate to stars, then A on Xbox / Circle on PlayStation"
      },
      {
        action: "Open worn-item customization",
        desktop: "Click the outfit/customization icon",
        mobile: "Tap the outfit/customization icon",
        console: "Controller mode from minus/touchpad, then navigate with stick or D-pad"
      }
    ],
    coverImage: null
  },
  "99-nights-in-the-forest": {
    metaDescription:
      "99 Nights in the Forest wiki with survival tips, classes, crafting, materials, weapons, tools, food, locations, entities, and animals.",
    coverImage: "/99%20Nights%20in%20the%20Forest/Entities/the-deer.webp",
    descriptionMd:
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
  "jujutsu-shenanigans": {
    metaDescription:
      "Jujutsu Shenanigans wiki hub with characters, domains, items, maps, modes, emotes, achievements, Build Mode, controls, and Roblox details.",
    descriptionMd:
      "Jujutsu Shenanigans is a Roblox battlegrounds fighting game built around public-server brawls, destructible city movement, character kits, domains, items, and mode queues. A normal session starts with choosing a moveset, landing M1 chains and four skills, using dash or block to survive pressure, and building Awakening by dealing damage. Public servers are the sandbox, but Duels, Ranked Duels, Roulette minigames, private servers, Build Mode, Workshop, and Skill Builder give the game more structure than a simple free-for-all.\n\nThe main thing to learn first is how each character turns neutral hits into pressure. Characters such as Honored One, Vessel, Perfection, Restless Gambler, Ten Shadows, and the Early Access roster all change what your base moves, special, Awakening, or domain can do. Items, throwables, vending machines, map hazards, emotes, achievements, titles, and cosmetic rewards sit around that combat loop. Build Mode is its own creative layer, with blocks, tools, Workshop maps, and Skill Builder nodes for private-server movesets.\n\nReturning players should check character status, new domains, map or Roulette changes, item availability, achievement rewards, emote sources, and Build Mode systems before assuming an older video still matches the game. Jujutsu Shenanigans updates often change kits, modes, and side systems, so public fights and private-server building can feel different after a major patch.",
    tipsMd: `- Keep M1, dash, block, and special timing clean before swapping characters often. Most kits still rely on opening hits, avoiding endlag, and using the right move variant.
- Awakening bar fills through damage and can reset when you switch characters, so do not change kits right before you are ready to use G.
- Public map items, vending machines, throwables, the station train, and sewer routes matter in open fights, but Duels and Roulette use separate match rules.
- Character status matters. Complete kits are safer to learn, Early Access characters can change, and Base Only characters do not play like full awakening kits.
- Build Mode, Workshop, and Skill Builder belong to private-server creation. They are powerful, but they are separate from normal public-server progression.`,
    controlsJson: [
      {
        action: "Melee combo",
        desktop: "Left click / M1",
        mobile: "Punch button"
      },
      {
        action: "Use skills",
        desktop: "1, 2, 3, 4",
        mobile: "On-screen skill buttons"
      },
      {
        action: "Dash / evasive",
        desktop: "Q",
        mobile: "Dash button"
      },
      {
        action: "Block",
        desktop: "F",
        mobile: "Block button"
      },
      {
        action: "Special",
        desktop: "R",
        mobile: "Special button"
      },
      {
        action: "Awaken",
        desktop: "G",
        mobile: "Tap the Awakening bar"
      },
      {
        action: "Sprint",
        desktop: "W twice",
        mobile: "Auto Run setting or forward movement"
      },
      {
        action: "Shift-lock",
        desktop: "Left Shift",
        mobile: "Lock button"
      },
      {
        action: "Zoom",
        desktop: "I / O or mouse wheel",
        mobile: "Pinch on the right side of the screen"
      },
      {
        action: "Beam clash quick-time input",
        desktop: "W, A, D",
        mobile: "Tap the shown on-screen button"
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
  },
  "sell-lemons": {
    metaDescription:
      "Sell Lemons wiki hub with income sources, powers, secrets, Evolution stages, locations, controls, and Roblox game details.",
    descriptionMd:
      "Sell Lemons is a Roblox tycoon and idle game by BloxByte Games where a tiny lemon stand turns into a layered fruit empire. A normal run starts with clicking the stand, collecting dropped cash, buying early upgrades such as the Juicer and Cup Stand, then unlocking larger systems like LemonDash, Lemon Depot, Trading, Labs, Robotics, Republic, and Orange X.\n\nThe game rewards routing, timing, and checking what each purchase opens. Some useful upgrades appear after decoration or building purchases, managers turn active income sources into idle earners, and offline income makes automation worth planning around. As the numbers grow, Investors, Ascend, Evolution, powers, and permanent upgrades decide whether you should keep pushing the current run or reset for a faster rebuild.\n\nReturning players should check the systems that changed their route first: which income source is next, whether a manager is now worth buying, whether hidden Sewer or UFO unlocks are ready, and whether Evolution or First Tier progress is stronger than another normal cash push.",
    tipsMd: `- Rebuild the Lemon Stand cleanly after every reset. Juicer, Cup Stand, and the Cash Register Automator are early priorities because they restore the basic cash loop while you move toward the next source.
- Walk newly purchased areas before teleporting away. Sell Lemons hides useful buttons behind walls, roofs, floors, and other building pieces, so a new room or hill layer can matter as much as a visible income upgrade.
- Treat managers as timing purchases. The Stand Automator is useful early, but Depot, Trading, Labs, and Robotics managers make more sense after that source already earns enough for automation to pay off.
- Keep some cash outside Lemon Trading until you understand the price swings. Trading can speed up a run, but dumping the whole balance into a bad cycle can slow the next unlock.
- Check Investors before Evolution. Evolution gives a major fruit-stage speed boost, but giving up a strong Investor count too early can make the rebuild feel worse than expected.
- Use the map routes as progression clues. Lemon Depot, Hill Expansion, Sewer Maze, UFO, and First Tier Staircase each point to a system, secret, or permanent milestone.`,
    controlsJson: [
      {
        action: "Produce lemons",
        desktop: "Click the Lemon Stand"
      },
      {
        action: "Collect ground cash",
        desktop: "Walk over dropped bills and coins"
      },
      {
        action: "Open upgrades",
        desktop: "Click the dollar-sign shop button"
      },
      {
        action: "Teleport between unlocked sources",
        desktop: "Click the bottom-screen arrow buttons"
      }
    ],
    coverImage: null
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
  const targetGroups = getTargetGroups();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    return new Map(targetGroups.map((group) => [group.gameSlug, group.universeId ?? null]));
  }

  const rows = await loadRobloxUniverseLookupRows();
  const existingUniverseIds = new Set(rows.map((row) => row.universe_id));

  return new Map(
    targetGroups.map((group) => {
      if (group.universeId && existingUniverseIds.has(group.universeId)) return [group.gameSlug, group.universeId];
      const candidates = new Set([group.gameSlug, group.gameName, ...group.universeNames].map(normalizeLookup));
      const match = rows.find((row) =>
        [row.name, row.display_name].some((value) => candidates.has(normalizeLookup(value)))
      );
      return [group.gameSlug, match?.universe_id ?? null];
    })
  );
}

async function loadRobloxUniverseLookupRows() {
  const sb = supabaseAdmin();
  const rows: Array<{
    universe_id: number;
    name?: string | null;
    display_name?: string | null;
  }> = [];

  for (let from = 0; ; from += UNIVERSE_LOOKUP_PAGE_SIZE) {
    const to = from + UNIVERSE_LOOKUP_PAGE_SIZE - 1;
    const { data, error } = await sb
      .from("roblox_universes")
      .select("universe_id, name, display_name")
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
    const copy = await resolveWikiCopy(group);
    if (!copy) continue;

    const row: WikiPageUpsert = {
      slug: group.gameSlug,
      title: copy.title,
      seo_title: copy.seoTitle,
      meta_description: copy.metaDescription,
      description_md: copy.descriptionMd,
      universe_id: copy.universeId ?? universeIdsByGameSlug.get(group.gameSlug) ?? null,
      controls_json: copy.controlsJson,
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

function toReadableList(values: string[]): string {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0] ?? "";
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

function truncateMeta(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 155) return normalized;
  return `${normalized.slice(0, 152).replace(/\s+\S*$/, "")}...`;
}

async function main() {
  if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE)) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. Use --dry-run to preview without writing.");
  }
  if (!dryRun && !allowProd && !isManagedDevelopmentSupabaseUrl(process.env.SUPABASE_URL)) {
    throw new Error("Refusing to write outside managed development. Use --allow-prod only after managed-dev review is clean.");
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
