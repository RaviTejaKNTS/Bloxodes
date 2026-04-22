import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { ForgeCatalogView } from "../the-forge/ForgeCatalogView";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { renderPageContentNodes } from "@/lib/page-content";
import type { CatalogContentHtml } from "../the-forge/page-data";

const FALLBACK_IMAGE = "/og-image.png";

export type GrowGardenCatalogConfig = {
  slug: string;
  label: string;
  file: string;
  navDescription: string;
  description: string;
  groupKey: string;
  groupLabel: string;
  stats: Array<{ key: string; label: string }>;
  badgeKey?: string;
  subtitleKeys?: string[];
  descriptionKey?: string;
  cardDescriptionKey?: string;
  hideImages?: boolean;
  maxStats?: number;
};

export const GROW_GARDEN_CATALOGS: GrowGardenCatalogConfig[] = [
  {
    slug: "crops",
    label: "Crops",
    file: "crops.json",
    navDescription: "Values, weights, harvest behavior, and availability.",
    description: "Browse every crop in Grow a Garden with value, weight, harvest behavior, and availability notes.",
    groupKey: "catalogGroup",
    groupLabel: "Tier",
    badgeKey: "tierBadge",
    subtitleKeys: ["harvestMode", "availability"],
    descriptionKey: "farmSummary",
    cardDescriptionKey: "farmSummary",
    hideImages: true,
    stats: [
      { key: "purchasePrice", label: "Price" },
      { key: "averageValue", label: "Average value" },
      { key: "averageWeight", label: "Average weight" },
      { key: "hugeChance", label: "Huge chance" }
    ],
    maxStats: 4
  },
  {
    slug: "seeds",
    label: "Seeds",
    file: "seeds.json",
    navDescription: "Shop access, crafting, and seed pack sources.",
    description: "Compare Grow a Garden seeds by tier, harvest type, shop access, crafting routes, and pack availability.",
    groupKey: "catalogGroup",
    groupLabel: "Tier",
    badgeKey: "tierBadge",
    subtitleKeys: ["harvestType", "availability"],
    descriptionKey: "secondarySummary",
    cardDescriptionKey: "secondarySummary",
    hideImages: true,
    stats: [
      { key: "shopCount", label: "Shop entries" },
      { key: "craftingCount", label: "Crafting" },
      { key: "packCount", label: "Seed packs" }
    ],
    maxStats: 3
  },
  {
    slug: "pets",
    label: "Pets",
    file: "pets.json",
    navDescription: "Egg sources, merchant sources, and abilities.",
    description: "See every Grow a Garden pet grouped by rarity with egg sources, merchant availability, and ability counts.",
    groupKey: "catalogGroup",
    groupLabel: "Rarity",
    badgeKey: "tierBadge",
    subtitleKeys: ["availability"],
    descriptionKey: "secondarySummary",
    cardDescriptionKey: "secondarySummary",
    hideImages: true,
    stats: [
      { key: "eggCount", label: "Eggs" },
      { key: "merchantCount", label: "Merchants" },
      { key: "abilityCount", label: "Abilities" }
    ],
    maxStats: 3
  },
  {
    slug: "eggs",
    label: "Eggs",
    file: "eggs.json",
    navDescription: "Hatch times, drop pools, and availability.",
    description: "Track Grow a Garden egg types by shop category, hatch time, obtainable status, and pet drop pool size.",
    groupKey: "catalogGroup",
    groupLabel: "Egg category",
    subtitleKeys: ["hatchTime", "availability"],
    descriptionKey: "probabilityText",
    cardDescriptionKey: "probabilityText",
    hideImages: true,
    stats: [{ key: "dropCount", label: "Pet drops" }],
    maxStats: 1
  },
  {
    slug: "gears",
    label: "Gears",
    file: "gears.json",
    navDescription: "Gear categories, prices, stock, and effects.",
    description: "Browse Grow a Garden gear by category with price, stock ranges, and what each tool actually does.",
    groupKey: "catalogGroup",
    groupLabel: "Category",
    subtitleKeys: ["availability"],
    descriptionKey: "use",
    cardDescriptionKey: "use",
    stats: [
      { key: "price", label: "Price" },
      { key: "stock", label: "Stock" }
    ],
    maxStats: 2
  },
  {
    slug: "crop-mutations",
    label: "Crop Mutations",
    file: "crop-mutations.json",
    navDescription: "Multipliers, visuals, and trigger sources.",
    description: "Review Grow a Garden crop mutations with multipliers, appearance notes, and the ways each mutation can be applied.",
    groupKey: "catalogGroup",
    groupLabel: "Category",
    badgeKey: "multiplier",
    descriptionKey: "obtainment",
    cardDescriptionKey: "visualDescription",
    hideImages: true,
    stats: [{ key: "multiplier", label: "Multiplier" }],
    maxStats: 1
  },
  {
    slug: "pet-mutations",
    label: "Pet Mutations",
    file: "pet-mutations.json",
    navDescription: "Mutation types, odds, and passive boosts.",
    description: "Compare Grow a Garden pet mutations by type, chance, XP boost, and sell multiplier.",
    groupKey: "catalogGroup",
    groupLabel: "Type",
    badgeKey: "chance",
    descriptionKey: "passive",
    cardDescriptionKey: "passive",
    hideImages: true,
    stats: [
      { key: "amount", label: "Amount" },
      { key: "chance", label: "Chance" },
      { key: "petSellMultiplier", label: "Sell" }
    ],
    maxStats: 3
  },
  {
    slug: "weather",
    label: "Weather",
    file: "weather.json",
    navDescription: "Standard, event, and admin weather effects.",
    description: "Browse Grow a Garden weather types and see which effects, mutations, and gameplay changes each one brings.",
    groupKey: "catalogGroup",
    groupLabel: "Category",
    descriptionKey: "details",
    cardDescriptionKey: "effects",
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "merchants",
    label: "Merchants",
    file: "merchants.json",
    navDescription: "Spawn merchants and what they sell.",
    description: "See Grow a Garden merchants, how they appear, and the kinds of seeds, pets, gear, or event items they offer.",
    groupKey: "catalogGroup",
    groupLabel: "Type",
    descriptionKey: "function",
    cardDescriptionKey: "function",
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "npcs",
    label: "NPCs",
    file: "npcs.json",
    navDescription: "Important NPC roles and interaction notes.",
    description: "Track Grow a Garden NPCs and what each one does, from quest helpers to themed event characters and shop mascots.",
    groupKey: "catalogGroup",
    groupLabel: "Type",
    subtitleKeys: ["birthday"],
    descriptionKey: "function",
    cardDescriptionKey: "function",
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "shops",
    label: "Shops",
    file: "shops.json",
    navDescription: "Refresh cycles, currencies, and NPC owners.",
    description: "Compare Grow a Garden shops by owner, currency, and refresh cadence so you know where items rotate in and out.",
    groupKey: "catalogGroup",
    groupLabel: "Currency",
    badgeKey: "npc",
    subtitleKeys: ["refreshCadence"],
    descriptionKey: "description",
    cardDescriptionKey: "description",
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "seed-packs",
    label: "Seed Packs",
    file: "seed-packs.json",
    navDescription: "Pack types, contents, prices, and dates added.",
    description: "Browse Grow a Garden seed packs with obtainment notes, pack contents, prices, and release timing.",
    groupKey: "catalogGroup",
    groupLabel: "Pack type",
    badgeKey: "availability",
    subtitleKeys: ["dateAdded"],
    descriptionKey: "obtainment",
    cardDescriptionKey: "obtainment",
    stats: [
      { key: "price", label: "Price" },
      { key: "contentsCount", label: "Contents" }
    ],
    maxStats: 2
  },
  {
    slug: "crafting-recipes",
    label: "Crafting Recipes",
    file: "crafting-recipes.json",
    navDescription: "Seed, sprinkler, and item crafting routes.",
    description: "Check Grow a Garden crafting recipes by category with craft time, ingredient summary, and alternative prices.",
    groupKey: "catalogGroup",
    groupLabel: "Category",
    subtitleKeys: ["craftTime"],
    descriptionKey: "recipe",
    cardDescriptionKey: "recipe",
    hideImages: true,
    stats: [{ key: "alternativePrices", label: "Alternative price" }],
    maxStats: 1
  },
  {
    slug: "food",
    label: "Food",
    file: "food.json",
    navDescription: "Cooking outputs, recipe groups, and base stats.",
    description: "Browse Grow a Garden food recipes with recipe groups, cook time, and base weight for each dish.",
    groupKey: "catalogGroup",
    groupLabel: "Category",
    descriptionKey: "recipes",
    cardDescriptionKey: "recipes",
    hideImages: true,
    stats: [
      { key: "baseTime", label: "Base time" },
      { key: "baseWeight", label: "Base weight" }
    ],
    maxStats: 2
  },
  {
    slug: "currencies",
    label: "Currencies",
    file: "currencies.json",
    navDescription: "Core currencies and how they are earned.",
    description: "See the main currencies used in Grow a Garden and the primary ways players earn or exchange them.",
    groupKey: "catalogGroup",
    groupLabel: "Category",
    badgeKey: "availability",
    descriptionKey: "obtainment",
    cardDescriptionKey: "obtainment",
    hideImages: true,
    stats: [],
    maxStats: 0
  }
];

type GrowGardenDatasetSource = {
  label?: string | null;
  url?: string | null;
  accessed?: string | null;
};

type GrowGardenDatasetMeta = {
  title?: string | null;
  updatedAt?: string | null;
  sources?: GrowGardenDatasetSource[] | null;
  columns?: string[] | null;
};

export type GrowGardenCatalogItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: unknown;
};

export type GrowGardenCatalogDataset = {
  meta: GrowGardenDatasetMeta | null;
  items: GrowGardenCatalogItem[];
};

export function getGrowGardenCatalogConfig(slug: string): GrowGardenCatalogConfig | null {
  const normalized = slug.trim().toLowerCase();
  return GROW_GARDEN_CATALOGS.find((entry) => entry.slug === normalized) ?? null;
}

export function buildGrowGardenCatalogCodeCandidates(config: GrowGardenCatalogConfig): string[] {
  const primary = `grow-a-garden-${config.slug}`;
  const legacy = `grow-a-garden/${config.slug}`;
  return [primary, legacy];
}

export function buildGrowGardenCatalogFlatCode(slug: string): string {
  return `grow-a-garden-${slug.trim().toLowerCase()}`;
}

export function buildGrowGardenCatalogPath(slug: string): string {
  return `/catalog/${buildGrowGardenCatalogFlatCode(slug)}`;
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    const lowered = trimmed.toLowerCase();
    if (["none", "n/a", "na", "null"].includes(lowered)) return null;
    return trimmed;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toLocaleString("en-US");
  }
  return String(value);
}

function normalizeAvailability(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (["✓", "yes", "true", "available", "obtainable"].includes(lowered)) return "Yes";
  if (["✗", "no", "false", "unavailable"].includes(lowered)) return "No";
  return normalized;
}

function normalizeHarvestMode(value: unknown): string | null {
  const normalized = normalizeAvailability(value);
  if (!normalized) return null;
  if (normalized === "Yes") return "Multi-harvest";
  if (normalized === "No") return "Single harvest";
  return normalized;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toSectionId(value: string): string {
  return `section-${toSlug(value || "items")}`;
}

function resolveAbsoluteUrl(value: string | null | undefined): string {
  if (!value) return `${SITE_URL}${FALLBACK_IMAGE}`;
  if (value.startsWith("http")) return value;
  return `${SITE_URL.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function sanitizeImage(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.startsWith("data:image")) return null;
  return normalized;
}

function firstSourceCategory(sourceGroups: unknown): string | null {
  const [entry] = asArray<Record<string, unknown>>(sourceGroups);
  if (!entry) return null;
  return normalizeText(entry.category) ?? normalizeText(entry.subcategory);
}

function pickItemName(row: Record<string, unknown>): string | null {
  return normalizeText(row.name) ?? normalizeText(row.item);
}

function buildImage(row: Record<string, unknown>, slug: string): string | null {
  const direct = sanitizeImage(row.image) ?? sanitizeImage(row.wikiImageUrl);
  if (direct) return direct;

  if (slug === "seed-packs") {
    for (const content of asArray<Record<string, unknown>>(row.contents)) {
      const image = sanitizeImage(content.image);
      if (image) return image;
    }
  }

  return null;
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeGroupLabel(value: unknown, fallback = "Other"): string {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  if (normalized === normalized.toLowerCase()) {
    return titleCaseWords(normalized);
  }
  return normalized;
}

function normalizeNumericCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function normalizeGrowGardenItem(slug: string, row: Record<string, unknown>): GrowGardenCatalogItem | null {
  const name = pickItemName(row);
  if (!name) return null;

  const image = buildImage(row, slug);
  const sourceCategory = firstSourceCategory(row.sourceGroups);
  const tier = normalizeText(row.tier);
  const availability = normalizeAvailability(row.obtainable);

  const base: GrowGardenCatalogItem = {
    ...row,
    id: toSlug(name),
    name,
    image
  };

  switch (slug) {
    case "crops":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(tier ?? sourceCategory),
        tierBadge: tier ?? sourceCategory,
        purchasePrice: normalizeText(row.purchasePriceValue),
        availability,
        harvestMode: normalizeHarvestMode(row.multiHarvest)
      };
    case "seeds":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(tier ?? sourceCategory),
        tierBadge: tier ?? sourceCategory,
        availability,
        shopCount: normalizeNumericCount(row.shopEntries),
        craftingCount: normalizeNumericCount(row.craftingRecipes),
        packCount: normalizeNumericCount(row.seedPacks)
      };
    case "pets":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(tier ?? firstSourceCategory(row.categories)),
        tierBadge: tier,
        availability,
        eggCount: normalizeNumericCount(row.eggSources),
        merchantCount: normalizeNumericCount(row.merchantSources),
        abilityCount: normalizeNumericCount(row.abilities)
      };
    case "eggs":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(row.eggCategory),
        availability,
        dropCount: normalizeNumericCount(row.drops)
      };
    case "gears":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(row.category),
        availability
      };
    case "crop-mutations":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(row.category)
      };
    case "pet-mutations":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(row.type),
        availability
      };
    case "weather":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(row.category)
      };
    case "merchants":
    case "npcs":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(row.category)
      };
    case "shops":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(row.currency, "Shops")
      };
    case "seed-packs":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(row.packType),
        availability,
        contentsCount: normalizeNumericCount(row.contents)
      };
    case "crafting-recipes":
      return {
        ...base,
        catalogGroup: normalizeGroupLabel(row.category)
      };
    case "food":
      return {
        ...base,
        catalogGroup: "Cooking"
      };
    case "currencies":
      return {
        ...base,
        catalogGroup: "Currencies",
        availability
      };
    default:
      return base;
  }
}

async function readGrowGardenDataset(
  config: GrowGardenCatalogConfig
): Promise<{ meta: GrowGardenDatasetMeta | null; items: GrowGardenCatalogItem[] }> {
  const datasetPath = path.join(process.cwd(), "data", "Grow a Garden", config.file);
  const raw = await fs.readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as
    | { meta?: GrowGardenDatasetMeta | null; items?: Record<string, unknown>[] | null }
    | Record<string, unknown>[];

  if (Array.isArray(parsed)) {
    return {
      meta: null,
      items: parsed
        .map((row) => normalizeGrowGardenItem(config.slug, row))
        .filter(Boolean) as GrowGardenCatalogItem[]
    };
  }

  return {
    meta: parsed.meta ?? null,
    items: (parsed.items ?? [])
      .map((row) => normalizeGrowGardenItem(config.slug, row))
      .filter(Boolean) as GrowGardenCatalogItem[]
  };
}

function resolveDataUpdatedAt(meta: GrowGardenDatasetMeta | null): string | null {
  if (!meta) return null;
  if (meta.updatedAt) return meta.updatedAt;
  const sources = meta.sources ?? [];
  return sources.find((source) => source?.accessed)?.accessed ?? null;
}

function groupSortWeight(value: string): number {
  const order = [
    "Common",
    "Uncommon",
    "Rare",
    "Legendary",
    "Mythical",
    "Divine",
    "Prismatic",
    "Transcendent",
    "Natural",
    "Standard",
    "Merchant",
    "Currencies",
    "Cooking",
    "Other"
  ];
  const index = order.indexOf(value);
  return index >= 0 ? index : order.length + value.localeCompare("Other");
}

function buildGroupedSections(items: GrowGardenCatalogItem[], groupKey: string) {
  const groups = new Map<string, { label: string; items: GrowGardenCatalogItem[] }>();

  items.forEach((item) => {
    const rawLabel = normalizeText(item[groupKey]) ?? "Other";
    const groupId = rawLabel.toLowerCase();
    const existing = groups.get(groupId);
    if (existing) {
      existing.items.push(item);
      return;
    }
    groups.set(groupId, { label: rawLabel, items: [item] });
  });

  return Array.from(groups.values())
    .sort((left, right) => {
      const weightDelta = groupSortWeight(left.label) - groupSortWeight(right.label);
      if (weightDelta !== 0) return weightDelta;
      return left.label.localeCompare(right.label);
    })
    .map((entry) => ({
      id: toSectionId(entry.label),
      label: entry.label,
      items: [...entry.items].sort((left, right) => left.name.localeCompare(right.name))
    }));
}

export async function loadGrowGardenCatalogDataset(config: GrowGardenCatalogConfig): Promise<GrowGardenCatalogDataset> {
  try {
    return await readGrowGardenDataset(config);
  } catch (error) {
    console.error("Failed to load Grow a Garden catalog dataset", error);
    return { meta: null, items: [] };
  }
}

export function GrowGardenCatalogNav({ activeSlug }: { activeSlug: string }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {GROW_GARDEN_CATALOGS.map((entry) => {
        const isActive = entry.slug === activeSlug;
        const cardClasses = `group relative overflow-hidden rounded-2xl border px-5 py-4 transition ${
          isActive
            ? "border-accent/70 bg-gradient-to-br from-accent/15 via-surface to-background shadow-soft"
            : "border-border/60 bg-surface/80 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-soft"
        }`;

        const card = (
          <article className={cardClasses} aria-current={isActive ? "page" : undefined}>
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 h-1 ${
                isActive ? "bg-accent" : "bg-accent/30 group-hover:bg-accent/60"
              }`}
            />
            <div className="flex h-full flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-foreground">{entry.label}</p>
                {isActive ? (
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Active
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted">{entry.navDescription}</p>
            </div>
          </article>
        );

        if (isActive) {
          return (
            <div key={entry.slug} className="h-full" aria-current="page">
              {card}
            </div>
          );
        }

        return (
          <Link key={entry.slug} href={buildGrowGardenCatalogPath(entry.slug)} className="block h-full">
            {card}
          </Link>
        );
      })}
    </section>
  );
}

export function GrowGardenBreadcrumb({
  items,
  className
}: {
  items: Array<{ label: string; href?: string | null }>;
  className?: string;
}) {
  return <PageBreadcrumb items={items} className={className} />;
}

function GrowGardenSectionNav({ sections }: { sections: Array<{ id: string; label: string; count: number }> }) {
  if (!sections.length) return null;
  return (
    <nav aria-label="Jump to section" className="flex flex-wrap gap-2">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="rounded-full border border-border/60 bg-surface/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted transition hover:border-accent/70 hover:text-accent"
        >
          {section.label} ({section.count})
        </a>
      ))}
    </nav>
  );
}

export function buildGrowGardenItemListSchema({
  title,
  description,
  url,
  items
}: {
  title: string;
  description: string;
  url: string;
  items: GrowGardenCatalogItem[];
}) {
  const itemListElement = items.map((item, index) => {
    const image = resolveAbsoluteUrl(item.image ?? FALLBACK_IMAGE);
    const itemUrl = `${url}#item-${item.id}`;
    return {
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Thing",
        name: item.name,
        url: itemUrl,
        image
      }
    };
  });

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url,
    numberOfItems: items.length,
    itemListElement
  });
}

export function renderGrowGardenCatalogPage({
  config,
  dataset,
  contentHtml
}: {
  config: GrowGardenCatalogConfig;
  dataset: GrowGardenCatalogDataset;
  contentHtml?: CatalogContentHtml | null;
}) {
  const items = dataset.items;
  const itemCount = items.length;
  const pageTitle = `All ${itemCount.toLocaleString("en-US")} ${config.label} in Grow a Garden`;
  const pageDescription = config.description;
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const howHtml = contentHtml?.howHtml?.trim() ? contentHtml.howHtml : "";
  const faqHtml = contentHtml?.faqHtml ?? [];
  const dataUpdatedAt = resolveDataUpdatedAt(dataset.meta);
  const contentUpdatedAt = contentHtml?.updatedAt ?? null;
  const updatedAt = dataUpdatedAt ?? contentUpdatedAt;
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const canonicalPath = buildGrowGardenCatalogPath(config.slug);
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const updatedIso = updatedDate?.toISOString() ?? null;
  const groupedSections = buildGroupedSections(items, config.groupKey);
  const sectionNav = groupedSections.map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length
  }));
  const hasDetails = Boolean(descriptionHtml.length) || Boolean(howHtml) || Boolean(faqHtml.length);

  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: config.label, href: null }
  ];

  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: config.label, url: canonicalUrl }
    ])
  );

  const listSchema = buildGrowGardenItemListSchema({
    title: pageTitle,
    description: pageDescription,
    url: canonicalUrl,
    items
  });

  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitle,
      description: pageDescription,
      image: `${SITE_URL}/og-image.png`,
      author: null,
      publishedAt: updatedIso,
      updatedAt: updatedIso
    })
  );

  const introNodes = introHtml ? renderPageContentNodes(introHtml, "grow-garden-intro") : null;
  const descriptionNodes = descriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `grow-garden-description-${entry.key}`)
  );
  const howNodes = howHtml ? renderPageContentNodes(howHtml, "grow-garden-how") : null;
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `grow-garden-faq-${idx}`)
  }));

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <GrowGardenBreadcrumb items={breadcrumbNavItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{pageTitle}</h1>
        <UpdatedTimestamp value={updatedDate} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes ? introNodes : null}

        <CatalogAdSlot />

        {sectionNav.length > 1 ? <GrowGardenSectionNav sections={sectionNav} /> : null}

        <ForgeCatalogView sections={groupedSections} config={config} />

        <CatalogAdSlot />

        {hasDetails ? (
          <>
            {descriptionNodes.length ? descriptionNodes : null}

            {howNodes ? howNodes : null}

            <ContentFaq
              items={faqNodes.map((faq, idx) => ({
                id: `${faq.q}-${idx}`,
                question: faq.q,
                answer: faq.nodes
              }))}
            />
          </>
        ) : null}

        <GrowGardenCatalogNav activeSlug={config.slug} />
      </section>

      {contentHtml?.id ? (
        <div className="mt-10">
          <CommentsSection entityType="catalog" entityId={contentHtml.id} />
        </div>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
