import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import "@/styles/article-content.css";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CatalogCard } from "@/components/CatalogCard";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import {
  BASE_PATH,
  FORGE_CATALOGS,
  ForgeBreadcrumb,
  loadForgeCatalogDataset
} from "./page-data";

export const revalidate = 86400;

const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;
const CATALOG_CODE_CANDIDATES = ["the-forge"];
const DEFAULT_DESCRIPTION =
  "The Forge Wiki with simple guides for ores, weapons, armors, pickaxes, runes, races, quests, skills, blueprints, essences, potions, totems, enemies, NPCs, and locations.";
const FORGE_CARD_TONES = ["indigo", "amber", "emerald"] as const;

type ForgeCollectionSummary = {
  slug: string;
  label: string;
  description: string;
  itemCount: number;
  updatedAt: string | null;
};

type ForgeWikiSection = {
  title?: string;
  paragraphs: string[];
  collectionSlug?: string;
};

const FORGE_WIKI_SECTIONS: ForgeWikiSection[] = [
  {
    paragraphs: [
      "The Forge is one of those Roblox games that sneaks up on you. What starts as simple mining quickly turns into a full-blown action RPG with deep crafting, combat, and progression systems that will keep you hooked for hours. Here is everything you need to know.",
      "The core loop is mine ores, forge gear, fight enemies, and explore. But once you are actually in it, you realize how deep it goes. The game was inspired by a browser classic called Jacksmith, a childhood favorite of lead developer Fireatacck, and you can feel that influence in how the forge sits at the center of literally everything."
    ]
  },
  {
    title: "Races",
    collectionSlug: "races",
    paragraphs: [
      "Races are The Forge's version of classes, and they matter more than most people realize at the start. You do not pick your race manually though. You roll for it, which means RNG decides your starting identity.",
      "Each race pushes you toward a different playstyle. Some are built for mining and trading, others for straight-up combat, and a couple are just flat-out stronger than everything else but nearly impossible to land. If your roll does not feel right, you can reroll using specific in-game items. Checking the races tier list before spending a reroll is a smart move."
    ]
  },
  {
    title: "Ores",
    collectionSlug: "ores",
    paragraphs: [
      "Ores are the currency of everything in The Forge. Every piece of gear you ever craft comes from what you mine, so understanding ores early saves you a lot of wasted effort later.",
      "Each ore has a multiplier that affects the quality of your forged gear, and some carry special traits that pass on unique passives to your weapon or armor. The quantity you use determines the weight class of your output, so loading up more ores generally gives you heavier, more powerful results.",
      "The rarest ones are the three mythical ores: Demonite, Darkryte, and the Arcane Crystal. These carry the highest multipliers in the game and are genuinely hard to find. There are also heart ores like the Prismatic Heart, Yeti Heart, Golem Heart, Stolen Heart, and Heart of the Island, each tied to specific progression content."
    ]
  },
  {
    title: "Pickaxes",
    collectionSlug: "pickaxes",
    paragraphs: [
      "Your pickaxe determines what you can mine and how good that ore is when you find it. Mining power decides which rocks you can actually break, and luck affects the rarity of what drops when you do.",
      "Early game is simple. Mid-game is where people stall, usually stuck choosing between the Magma and Arcane pickaxe. If you have the budget and some Demonite saved, just skip that decision and go straight for the Demonic pickaxe. Late game, the Prismatic and Dragon Head pickaxes are the clear targets."
    ]
  },
  {
    title: "Weapons",
    collectionSlug: "weapons",
    paragraphs: [
      "There are 25+ weapon types in The Forge, each tied to specific ore recipes. Before forging anything, check the percentage menu on the left of the forge screen so you know exactly what you are about to make. Skipping that step is how people waste good ores.",
      "The forging process has three minigames to clear. Two of them can be skipped with the Fast Forge gamepass, which is worth it if you are crafting a lot. Mixing different ores can also shift the outcome depending on your primary material, so experimenting pays off once you know what you are doing."
    ]
  },
  {
    title: "Armor",
    collectionSlug: "armors",
    paragraphs: [
      "Armor works the same way as weapons at the forge, but instead of one item you are building a full set: helmet, chestplate, and leggings. Ore quantity controls the weight class and ore quality controls how strong the defense stat ends up being.",
      "Check the percentage menu here too before forging. A complete, well-forged armor set is genuinely the difference between surviving a hard zone and getting wiped immediately."
    ]
  },
  {
    title: "Runes",
    collectionSlug: "runes",
    paragraphs: [
      "Runes are dropped by enemies and carved into slots on your gear to add bonuses like faster mining or higher damage. They are gear-specific though, meaning a pickaxe rune only fits a pickaxe slot, a weapon rune only fits a weapon, and so on.",
      "The runes tier list is worth consulting before you carve anything, because not all runes are equal and some are clearly worth prioritizing over others."
    ]
  },
  {
    title: "Quests",
    collectionSlug: "quests",
    paragraphs: [
      "Quests in The Forge are not optional padding. Some of them unlock rooms that contain some of the best gear in the game, which makes them a real part of progression and not just a side activity.",
      "NPCs like Sensei Moro, Captain Rowan, Isaac, the Goblin King, Bard, Monke, Tomo, Bjorn, and Raven each have their own quest and rewards. Finishing the Lost Guitar quest gives you the Unknown Key for the Arcane Pickaxe room. Demon Skal's quest in the late game gives you the Demonite Key for the Demonic Pickaxe room. Do not sleep on quests."
    ]
  },
  {
    title: "NPCs",
    collectionSlug: "npcs",
    paragraphs: [
      "NPCs are how The Forge quietly organizes the whole game. Some give quests, some sell or buy items, and some unlock systems you will use constantly. If an NPC has a yellow question mark over their head, that usually means they have a quest ready for you.",
      "The important early names are easy to remember once you know what they do. Miner Fred handles pickaxes, Maria sells potions, the Wizard handles race rerolls, Marbles and Greedy Cey help turn inventory into money, and the Enhancer and Runemaker are where your gear starts becoming a real build. Later NPCs like Goblin King, Goblin Lord, Raven, LocalModuled, Zarall, and Fungi matter because they connect directly to keys, questlines, blueprints, and hidden progression."
    ]
  },
  {
    title: "Locations",
    collectionSlug: "locations",
    paragraphs: [
      "The map has a lot going on beneath the surface. Different zones bring different enemies, different ores, and secrets that even experienced players have not fully mapped out. There are reportedly even rooms full of Lucky Blocks hidden in the world.",
      "Key areas to know are Island 3, the Raven Cave, and various hidden zones. The Volcanic Depths is where the difficulty really spikes, home to enemies like Elite Rogue Skeletons, Reapers, and the Blight Pyromancer. Do not walk in there underprepared."
    ]
  },
  {
    title: "Enemies",
    collectionSlug: "enemies",
    paragraphs: [
      "Enemies scale hard as you move deeper into the map. Early zones are forgiving, but mid and late-game areas will punish weak gear fast. The Ice Golem is a notable boss to watch out for.",
      "More importantly, every enemy drops essences when defeated, and essences are the only way to enhance and enchant your gear. Farming enemies is not just about clearing the path, it is a core part of getting stronger."
    ]
  },
  {
    title: "Essences",
    collectionSlug: "essences",
    paragraphs: [
      "Essences are the reason enemy farming matters even after you have already cleared a zone. They are enemy drops used with gold at the Enhancer to upgrade weapons and armor, so they sit right between combat and long-term gear progression.",
      "The tier matters. Tiny and Small Essence are early-game fuel, Medium and Large help bridge into stronger gear, and Greater, Superior, Epic, and Legendary Essence are the ones you care about for serious late-game upgrades. Tougher enemies have better chances to drop higher-tier essence, so do not waste your best stacks on gear you already know you are replacing soon.",
      "Essences also connect to runes. Enhancing gear to +3 unlocks a rune slot, which means essence farming is not just a stat boost grind. It is part of getting your weapon or armor ready for the rune effects that actually shape your build."
    ]
  },
  {
    title: "Skills",
    collectionSlug: "skills",
    paragraphs: [
      "There are 10 skills in The Forge that improve your mining speed, combat effectiveness, and upgrade efficiency as you level them up. They grow as you play, but knowing which ones to focus on early makes the mid-game noticeably smoother."
    ]
  },
  {
    title: "Potions",
    collectionSlug: "potions",
    paragraphs: [
      "Potions give you a direct performance boost while you are out in the mines or in a fight. They are not something you want to burn randomly. Saving them for tougher zones or high-stakes grind sessions is where they actually make a difference."
    ]
  },
  {
    title: "Totems",
    collectionSlug: "totems",
    paragraphs: [
      "Totems work similarly but are more specifically geared toward temporary mining and combat buffs. The best time to use them is during 2x luck weekend events, where stacking a totem with the luck bonus can pull rare ores that would otherwise take hours to find through normal play."
    ]
  },
  {
    title: "Blueprints",
    collectionSlug: "blueprints",
    paragraphs: [
      "Blueprints are your crafting reference. They show you exactly what materials are needed to forge a specific weapon or armor piece, so you are not guessing or wasting ores on trial and error. If you are pushing toward a late-game item, finding its blueprint first is the cleanest way to get there."
    ]
  }
];

function formatUpdatedLabel(value: string | null) {
  if (!value) return null;
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return null;
  }
}

function resolveDatasetUpdatedAt(value: Awaited<ReturnType<typeof loadForgeCatalogDataset>>["meta"]): string | null {
  if (!value) return null;
  if (value.updatedAt) return value.updatedAt;
  const sourceAccessed = value.sources?.find((source) => source?.accessed)?.accessed ?? null;
  return sourceAccessed;
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) continue;
    if (timestamp > latestTime) {
      latestTime = timestamp;
      latest = value;
    }
  }

  return latest;
}

async function loadCollectionSummaries(): Promise<ForgeCollectionSummary[]> {
  return Promise.all(
    FORGE_CATALOGS.map(async (config) => {
      const dataset = await loadForgeCatalogDataset(config);
      return {
        slug: config.slug,
        label: config.label,
        description: config.navDescription,
        itemCount: dataset.items.length,
        updatedAt: resolveDatasetUpdatedAt(dataset.meta)
      };
    })
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES);
  const title = `The Forge Wiki | ${SITE_NAME}`;
  const description = DEFAULT_DESCRIPTION;
  const image = catalog?.thumb_url ?? `${SITE_URL}/og-image.png`;

  return {
    title,
    description,
    alternates: buildAlternates(CANONICAL),
    openGraph: {
      type: "website",
      url: CANONICAL,
      title,
      description,
      siteName: SITE_NAME,
      images: [image]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function ForgeCatalogIndexPage() {
  const [catalog, collections] = await Promise.all([
    getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES),
    loadCollectionSummaries()
  ]);
  const collectionMap = new Map(collections.map((entry) => [entry.slug, entry]));
  const usedCollectionSlugs = new Set(
    FORGE_WIKI_SECTIONS.map((section) => section.collectionSlug).filter(Boolean) as string[]
  );
  const remainingCollections = collections.filter((entry) => !usedCollectionSlugs.has(entry.slug));

  const title = "The Forge Wiki";
  const updatedAt = latestTimestamp([
    catalog?.content_updated_at ?? catalog?.updated_at ?? catalog?.published_at ?? catalog?.created_at ?? null,
    ...collections.map((entry) => entry.updatedAt)
  ]);
  const formattedUpdated = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
  const updatedRelativeLabel = formatUpdatedLabel(updatedAt);

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <ForgeBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Catalog", href: "/catalog" },
            { label: "The Forge", href: null }
          ]}
        />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        {formattedUpdated ? (
          <p className="text-sm text-foreground/80">
            Updated on <span className="font-semibold text-foreground">{formattedUpdated}</span>
            {updatedRelativeLabel ? <span>{" "}({updatedRelativeLabel})</span> : null}
          </p>
        ) : null}
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        <div className="space-y-12">
          {FORGE_WIKI_SECTIONS.map((section, index) => {
            const collection = section.collectionSlug ? collectionMap.get(section.collectionSlug) ?? null : null;

            return (
              <section key={section.title ?? `intro-${index}`} className="space-y-4">
                <div className="max-w-3xl space-y-4">
                  {section.title ? (
                    <h2 className="text-2xl font-semibold text-foreground md:text-3xl">{section.title}</h2>
                  ) : null}
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} data-md-copy className="md-copy-node md-copy-p">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {collection ? (
                  <div
                    className="max-w-4xl"
                    data-analytics-event="select_item"
                    data-analytics-item-list-name="forge_catalog_index"
                    data-analytics-item-id={collection.slug}
                    data-analytics-item-name={collection.label}
                    data-analytics-position={index + 1}
                    data-analytics-content-type="catalog"
                  >
                    <CatalogCard
                      href={`${BASE_PATH}/${collection.slug}`}
                      title={collection.label}
                      description={collection.description}
                      category="Forge"
                      metricLabel="items"
                      metricValue={collection.itemCount}
                      tileLabel={collection.label}
                      tone={FORGE_CARD_TONES[index % FORGE_CARD_TONES.length]}
                    />
                  </div>
                ) : null}

                {index === 5 ? <CatalogAdSlot /> : null}
              </section>
            );
          })}

          {remainingCollections.length ? (
            <section className="space-y-6">
              {remainingCollections.map((entry, index) => (
                <div
                  key={entry.slug}
                  className="max-w-4xl"
                  data-analytics-event="select_item"
                  data-analytics-item-list-name="forge_catalog_index"
                  data-analytics-item-id={entry.slug}
                  data-analytics-item-name={entry.label}
                  data-analytics-position={FORGE_WIKI_SECTIONS.length + index + 1}
                  data-analytics-content-type="catalog"
                >
                  <CatalogCard
                    href={`${BASE_PATH}/${entry.slug}`}
                    title={entry.label}
                    description={entry.description}
                    category="Forge"
                    metricLabel="items"
                    metricValue={entry.itemCount}
                    tileLabel={entry.label}
                    tone={FORGE_CARD_TONES[(FORGE_WIKI_SECTIONS.length + index) % FORGE_CARD_TONES.length]}
                  />
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </section>

      {catalog?.id ? (
        <div className="mt-10">
          <CommentsSection entityType="catalog" entityId={catalog.id} />
        </div>
      ) : null}
    </div>
  );
}
