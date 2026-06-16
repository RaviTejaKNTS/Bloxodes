import fs from "node:fs/promises";
import { repoPath } from "@/lib/paths";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { CatalogSelectNav } from "@/components/CatalogSelectNav";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { ForgeCatalogView } from "./ForgeCatalogView";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { renderPageContentNodes } from "@/lib/page-content";

const FALLBACK_IMAGE = "/og-image.png";

export const BASE_PATH = "/catalog/the-forge";

export type CatalogContentHtml = {
  id?: string | null;
  title?: string | null;
  introHtml?: string;
  howHtml?: string;
  descriptionHtml?: Array<{ key: string; html: string }>;
  faqHtml?: Array<{ q: string; a: string }>;
  updatedAt?: string | null;
};

export type ForgeCatalogConfig = {
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
  linkKey?: string;
  maxStats?: number;
};

export const FORGE_CATALOGS: ForgeCatalogConfig[] = [
  {
    slug: "ores",
    label: "Ores",
    file: "ores.json",
    navDescription: "Regions, rarities, drop chances, and multipliers.",
    description: "Browse every ore in The Forge with drop chances, multipliers, and regions.",
    groupKey: "region",
    groupLabel: "Region",
    badgeKey: "rarity",
    descriptionKey: "description",
    stats: [
      { key: "dropChance", label: "Drop" },
      { key: "multiplier", label: "Multiplier" },
      { key: "sellPrice", label: "Sell" },
      { key: "rocks", label: "Rock" },
      { key: "trait", label: "Trait" }
    ],
    maxStats: 4
  },
  {
    slug: "weapons",
    label: "Weapons",
    file: "weapons.json",
    navDescription: "Weapon classes with damage, speed, and range.",
    description: "Compare every forgeable weapon in The Forge grouped by class.",
    groupKey: "class",
    groupLabel: "Weapon class",
    stats: [
      { key: "baseDamage", label: "Damage" },
      { key: "attackSpeed", label: "Speed" },
      { key: "range", label: "Range" },
      { key: "sellPrice", label: "Sell" },
      { key: "chance", label: "Forge" }
    ],
    maxStats: 4
  },
  {
    slug: "armors",
    label: "Armors",
    file: "armors.json",
    navDescription: "Armor classes and slots with health values.",
    description: "See every armor piece in The Forge, grouped by armor class.",
    groupKey: "class",
    groupLabel: "Armor class",
    badgeKey: "slot",
    stats: [
      { key: "baseHealth", label: "Base health" },
      { key: "sellPrice", label: "Sell" },
      { key: "chance", label: "Forge" }
    ],
    maxStats: 3
  },
  {
    slug: "pickaxes",
    label: "Pickaxes",
    file: "pickaxes.json",
    navDescription: "Power, speed, luck, and where to find them.",
    description: "Explore every pickaxe in The Forge with power, speed, and luck stats.",
    groupKey: "category",
    groupLabel: "Region",
    subtitleKeys: ["location"],
    stats: [
      { key: "power", label: "Power" },
      { key: "speed", label: "Speed" },
      { key: "luck", label: "Luck" },
      { key: "slots", label: "Slots" },
      { key: "cost", label: "Cost" }
    ],
    linkKey: "link",
    maxStats: 4
  },
  {
    slug: "runes",
    label: "Runes",
    file: "runes.json",
    navDescription: "Elements, rarities, and effects.",
    description: "All The Forge runes with elements, rarities, and effects.",
    groupKey: "element",
    groupLabel: "Element",
    badgeKey: "rarity",
    descriptionKey: "effect",
    stats: [{ key: "primaryDrop", label: "Primary drop" }],
    linkKey: "link",
    maxStats: 2
  },
  {
    slug: "races",
    label: "Races",
    file: "races.json",
    navDescription: "Race tiers, rarities, and stat bonuses.",
    description: "Every The Forge race with tiers, roll chances, and stat bonuses.",
    groupKey: "tier",
    groupLabel: "Tier",
    badgeKey: "rarity",
    stats: [
      { key: "rollChance", label: "Roll" },
      { key: "damage", label: "Damage" },
      { key: "health", label: "Health" },
      { key: "speed", label: "Speed" }
    ],
    linkKey: "link",
    maxStats: 4
  },
  {
    slug: "essences",
    label: "Essences",
    file: "essences.json",
    navDescription: "Essence tiers with quick descriptions.",
    description: "All The Forge essences organized by tier.",
    groupKey: "tier",
    groupLabel: "Tier",
    descriptionKey: "description",
    stats: [],
    linkKey: "link",
    maxStats: 2
  },
  {
    slug: "totems",
    label: "Totems",
    file: "totems.json",
    navDescription: "Totem costs and effects.",
    description: "Every The Forge totem with cost and effect details.",
    groupKey: "section",
    groupLabel: "Section",
    descriptionKey: "effect",
    stats: [{ key: "cost", label: "Cost" }],
    linkKey: "link",
    maxStats: 2
  },
  {
    slug: "potions",
    label: "Potions",
    file: "potions.json",
    navDescription: "Potion costs and effects.",
    description: "Every The Forge potion with cost and effect details.",
    groupKey: "section",
    groupLabel: "Section",
    descriptionKey: "effect",
    stats: [{ key: "cost", label: "Cost" }],
    linkKey: "link",
    maxStats: 2
  },
  {
    slug: "enemies",
    label: "Enemies",
    file: "enemies.json",
    navDescription: "Enemy stats and rewards by area.",
    description: "The Forge enemy list with stats, gold, and experience rewards.",
    groupKey: "area",
    groupLabel: "Area",
    badgeKey: "level",
    subtitleKeys: ["group"],
    stats: [
      { key: "health", label: "Health" },
      { key: "damage", label: "Damage" },
      { key: "gold", label: "Gold" },
      { key: "experience", label: "XP" }
    ],
    linkKey: "link",
    maxStats: 4
  },
  {
    slug: "npcs",
    label: "NPCs",
    file: "npcs.json",
    navDescription: "NPC roles and locations.",
    description: "The Forge NPC roster and their roles.",
    groupKey: "area",
    groupLabel: "Area",
    badgeKey: "role",
    subtitleKeys: ["location"],
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "quests",
    label: "Quests",
    file: "quests.json",
    navDescription: "Quest objectives grouped by world and NPC.",
    description: "Track The Forge quests by world, NPC, and listed objectives.",
    groupKey: "world",
    groupLabel: "World",
    badgeKey: "status",
    subtitleKeys: ["npc"],
    descriptionKey: "objectives",
    cardDescriptionKey: "objectives",
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "skills",
    label: "Skills",
    file: "skills.json",
    navDescription: "Achievement skills, unlock requirements, and boosts.",
    description: "Compare The Forge skill boosts and the achievements used to unlock them.",
    groupKey: "boost",
    groupLabel: "Boost",
    badgeKey: "boost",
    subtitleKeys: ["requirement"],
    descriptionKey: "summary",
    cardDescriptionKey: "summary",
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "blueprints",
    label: "Blueprints",
    file: "blueprints.json",
    navDescription: "Weapon and armor blueprints with sources and availability.",
    description: "See The Forge blueprints, where they come from, and whether they are available.",
    groupKey: "source",
    groupLabel: "Source",
    badgeKey: "availability",
    subtitleKeys: ["itemType"],
    descriptionKey: "howToGet",
    cardDescriptionKey: "howToGet",
    hideImages: true,
    stats: [],
    maxStats: 0
  },
  {
    slug: "locations",
    label: "Locations",
    file: "locations.json",
    navDescription: "Important locations grouped by area.",
    description: "The Forge locations organized by area and type.",
    groupKey: "area",
    groupLabel: "Area",
    badgeKey: "type",
    descriptionKey: "description",
    stats: [],
    linkKey: "link",
    maxStats: 2
  }
];

export function getForgeCatalogConfig(slug: string): ForgeCatalogConfig | null {
  const normalized = slug.trim().toLowerCase();
  return FORGE_CATALOGS.find((entry) => entry.slug === normalized) ?? null;
}

export function buildForgeCatalogCodeCandidates(config: ForgeCatalogConfig): string[] {
  const primary = `the-forge-${config.slug}`;
  const legacy = `the-forge/${config.slug}`;
  return [primary, legacy];
}

export function buildForgeCatalogFlatCode(slug: string): string {
  return `the-forge-${slug.trim().toLowerCase()}`;
}

export function buildForgeCatalogPath(slug: string): string {
  return `/wiki/the-forge/${slug.trim().toLowerCase()}`;
}

type ForgeDatasetSource = {
  label?: string | null;
  url?: string | null;
  accessed?: string | null;
};

type ForgeDatasetMeta = {
  title?: string | null;
  updatedAt?: string | null;
  sources?: ForgeDatasetSource[] | null;
  columns?: string[] | null;
};

export type ForgeCatalogItem = {
  id: string;
  name: string;
  image?: string | null;
  link?: string | null;
  [key: string]: unknown;
};

export type ForgeCatalogDataset = {
  meta: ForgeDatasetMeta | null;
  items: ForgeCatalogItem[];
};

async function readForgeDataset(file: string): Promise<{ meta: ForgeDatasetMeta | null; items: ForgeCatalogItem[] }> {
  const datasetPath = repoPath("data", "The Forge", file);
  const raw = await fs.readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as
    | { meta?: ForgeDatasetMeta | null; items?: Record<string, unknown>[] | null }
    | Record<string, unknown>[];

  if (Array.isArray(parsed)) {
    return { meta: null, items: uniquifyForgeItemIds(parsed.map(normalizeItem).filter(Boolean) as ForgeCatalogItem[]) };
  }

  const items = uniquifyForgeItemIds((parsed.items ?? []).map(normalizeItem).filter(Boolean) as ForgeCatalogItem[]);
  return { meta: parsed.meta ?? null, items };
}

function uniquifyForgeItemIds(items: ForgeCatalogItem[]): ForgeCatalogItem[] {
  const seen = new Map<string, number>();
  const used = new Set<string>();

  return items.map((item) => {
    const baseId = item.id || "item";
    const occurrence = (seen.get(baseId) ?? 0) + 1;
    seen.set(baseId, occurrence);

    let nextId = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
    let suffix = occurrence;
    while (used.has(nextId)) {
      suffix += 1;
      nextId = `${baseId}-${suffix}`;
    }
    used.add(nextId);

    return nextId === item.id ? item : { ...item, id: nextId };
  });
}

function normalizeItem(row: Record<string, unknown>): ForgeCatalogItem | null {
  const name = normalizeName(row.name);
  if (!name) return null;
  return {
    ...row,
    id: toSlug(name),
    name,
    image: normalizeName(row.image) ?? null,
    link: normalizeName(row.link) ?? null
  };
}

function normalizeName(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return String(value);
}

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toLocaleString("en-US");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const lowered = trimmed.toLowerCase();
    if (["none", "n/a", "na", "null"].includes(lowered)) return null;
    return trimmed;
  }
  return String(value);
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


function buildGroupedSections(items: ForgeCatalogItem[], groupKey: string) {
  const groups = new Map<string, ForgeCatalogItem[]>();
  items.forEach((item) => {
    const rawGroup = groupKey ? item[groupKey] : null;
    const label = normalizeValue(rawGroup) ?? "Other";
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)?.push(item);
  });

  return Array.from(groups.entries()).map(([label, entries]) => ({
    id: toSectionId(label),
    label,
    items: entries
  }));
}

export function buildForgeCatalogSidebarSections(
  config: ForgeCatalogConfig,
  dataset: ForgeCatalogDataset
): Array<{ id: string; label: string; count: number }> {
  return buildGroupedSections(dataset.items, config.groupKey).map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length
  }));
}

function resolveDataUpdatedAt(meta: ForgeDatasetMeta | null): string | null {
  if (!meta) return null;
  if (meta.updatedAt) return meta.updatedAt;
  const sources = meta.sources ?? [];
  return sources.find((source) => source?.accessed)?.accessed ?? null;
}

export async function loadForgeCatalogDataset(config: ForgeCatalogConfig): Promise<ForgeCatalogDataset> {
  try {
    return await readForgeDataset(config.file);
  } catch (error) {
    console.error("Failed to load Forge catalog dataset", error);
    return { meta: null, items: [] };
  }
}

export function ForgeCatalogNav({
  activeSlug,
  className
}: {
  activeSlug: string;
  className?: string;
}) {
  return (
    <CatalogSelectNav
      label="Catalog page"
      value={activeSlug}
      className={className}
      options={FORGE_CATALOGS.map((entry) => ({
        value: entry.slug,
        label: entry.label,
        href: buildForgeCatalogPath(entry.slug)
      }))}
    />
  );
}

export function ForgeBreadcrumb({ items, className }: { items: Array<{ label: string; href?: string | null }>; className?: string }) {
  return <PageBreadcrumb items={items} className={className} />;
}

function ForgeSectionNav({
  sections,
  className
}: {
  sections: Array<{ id: string; label: string; count: number }>;
  className?: string;
}) {
  if (!sections.length) return null;
  return (
    <CatalogSelectNav
      label="Jump to section"
      placeholder="Choose a section"
      className={className}
      options={sections.map((section) => ({
        value: section.id,
        label: section.label,
        count: section.count,
        targetId: section.id
      }))}
    />
  );
}

export function buildForgeItemListSchema({
  title,
  description,
  url,
  items
}: {
  title: string;
  description: string;
  url: string;
  items: ForgeCatalogItem[];
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

export function renderForgeCatalogPage({
  config,
  dataset,
  contentHtml
}: {
  config: ForgeCatalogConfig;
  dataset: ForgeCatalogDataset;
  contentHtml?: CatalogContentHtml | null;
}) {
  const items = dataset.items;
  const itemCount = items.length;
  const pageTitle = `All ${itemCount.toLocaleString("en-US")} ${config.label} in The Forge`;
  const pageDescription = config.description;
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const faqHtml = contentHtml?.faqHtml ?? [];
  const dataUpdatedAt = resolveDataUpdatedAt(dataset.meta);
  const contentUpdatedAt = contentHtml?.updatedAt ?? null;
  const updatedAt = dataUpdatedAt ?? contentUpdatedAt;
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const canonicalPath = buildForgeCatalogPath(config.slug);
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const updatedIso = updatedDate?.toISOString() ?? null;
  const groupedSections = buildGroupedSections(items, config.groupKey);
  const sectionNav = groupedSections.map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length
  }));
  const hasDetails = Boolean(descriptionHtml.length) || Boolean(faqHtml.length);

  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Wiki", href: "/wiki" },
    { label: "The Forge", href: "/wiki/the-forge" },
    { label: config.label, href: null }
  ];

  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Wiki", url: `${SITE_URL.replace(/\/$/, "")}/wiki` },
      { name: "The Forge", url: `${SITE_URL.replace(/\/$/, "")}/wiki/the-forge` },
      { name: config.label, url: canonicalUrl }
    ])
  );

  const listSchema = buildForgeItemListSchema({
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
  const introNodes = introHtml ? renderPageContentNodes(introHtml, "forge-intro") : null;
  const descriptionNodes = descriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `forge-description-${entry.key}`)
  );
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `forge-faq-${idx}`)
  }));

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <ForgeBreadcrumb items={breadcrumbNavItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{pageTitle}</h1>
        <UpdatedTimestamp value={updatedDate} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes ? introNodes : null}

        <CatalogAdSlot />

        <div className="grid gap-4 md:grid-cols-2 md:items-end">
          <ForgeCatalogNav activeSlug={config.slug} className="max-w-none" />
          {sectionNav.length > 1 ? <ForgeSectionNav sections={sectionNav} className="max-w-none" /> : null}
        </div>

        <ForgeCatalogView sections={groupedSections} config={config} />

        <CatalogAdSlot />

        {hasDetails ? (
          <>
            {descriptionNodes.length ? descriptionNodes : null}

            <ContentFaq
              items={faqNodes.map((faq, idx) => ({
                id: `${faq.q}-${idx}`,
                question: faq.q,
                answer: faq.nodes
              }))}
            />
          </>
        ) : null}
      </section>

      {contentHtml?.id ? (
        <div className="mt-10">
          <CommentsSection entityType="wiki_catalog" entityId={contentHtml.id} />
        </div>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
