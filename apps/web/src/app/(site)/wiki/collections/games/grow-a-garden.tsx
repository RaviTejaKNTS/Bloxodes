import fs from "node:fs/promises";
import { repoPath } from "@/lib/paths";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { CatalogSelectNav } from "@/components/CatalogSelectNav";
import { MoreWikiCollections } from "@/components/more-content";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { GameCollectionView } from "@/components/game-collections/GameCollectionView";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { renderPageContentNodes } from "@/lib/page-content";
import { buildCollectionPagination } from "@/components/game-collections/collection-pagination";
import { GROW_GARDEN_COLLECTIONS, type GrowGardenCollectionConfig } from "@/lib/game-collections/games/grow-a-garden";
import { unwrapDatasetItems } from "@/lib/local-datasets";
import { toIsoContentDate } from "@/lib/content-dates";
import {
  getPublishedWikiCollectionRuntimeByCode,
  shouldFallbackToLocalWikiCollectionData
} from "@/lib/wiki-collection-runtime";
import type { CollectionContentHtml } from "./the-forge";

const FALLBACK_IMAGE = "/Bloxodes.png";

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
  display?: {
    groupLabel?: string | null;
    sectionOrder?: string[] | null;
  } | null;
};

export type GrowGardenCollectionItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: unknown;
};

export type GrowGardenCollectionDataset = {
  meta: GrowGardenDatasetMeta | null;
  items: GrowGardenCollectionItem[];
};

export function getGrowGardenCollectionConfig(slug: string): GrowGardenCollectionConfig | null {
  const normalized = slug.trim().toLowerCase();
  return GROW_GARDEN_COLLECTIONS.find((entry) => entry.slug === normalized) ?? null;
}

export function buildGrowGardenCollectionCodeCandidates(config: GrowGardenCollectionConfig): string[] {
  const primary = `grow-a-garden-${config.slug}`;
  const legacy = `grow-a-garden/${config.slug}`;
  return [primary, legacy];
}

export function buildGrowGardenCollectionFlatCode(slug: string): string {
  return `grow-a-garden-${slug.trim().toLowerCase()}`;
}

export function buildGrowGardenCollectionPath(slug: string): string {
  return `/wiki/grow-a-garden/${slug.trim().toLowerCase()}`;
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

function normalizeGrowGardenItem(slug: string, row: Record<string, unknown>): GrowGardenCollectionItem | null {
  const name = pickItemName(row);
  if (!name) return null;

  const image = buildImage(row, slug);
  const sourceCategory = firstSourceCategory(row.sourceGroups);
  const tier = normalizeText(row.tier);
  const availability = normalizeAvailability(row.obtainable);

  const base: GrowGardenCollectionItem = {
    ...row,
    id: toSlug(name),
    name,
    image
  };

  switch (slug) {
    case "crops":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(tier ?? sourceCategory),
        tierBadge: tier ?? sourceCategory,
        purchasePrice: normalizeText(row.purchasePriceValue),
        availability,
        harvestMode: normalizeHarvestMode(row.multiHarvest)
      };
    case "seeds":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(tier ?? sourceCategory),
        tierBadge: tier ?? sourceCategory,
        availability,
        shopCount: normalizeNumericCount(row.shopEntries),
        craftingCount: normalizeNumericCount(row.craftingRecipes),
        packCount: normalizeNumericCount(row.seedPacks)
      };
    case "pets":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(tier ?? firstSourceCategory(row.categories)),
        tierBadge: tier,
        availability,
        eggCount: normalizeNumericCount(row.eggSources),
        merchantCount: normalizeNumericCount(row.merchantSources),
        abilityCount: normalizeNumericCount(row.abilities)
      };
    case "eggs":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.eggCategory),
        availability,
        dropCount: normalizeNumericCount(row.drops)
      };
    case "gears":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.category),
        availability
      };
    case "crop-mutations":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.category)
      };
    case "pet-mutations":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.type),
        availability
      };
    case "weather":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.category)
      };
    case "merchants":
    case "npcs":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.category)
      };
    case "shops":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.currency, "Shops")
      };
    case "seed-packs":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.packType),
        availability,
        contentsCount: normalizeNumericCount(row.contents)
      };
    case "crafting-recipes":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.category)
      };
    case "food":
      return {
        ...base,
        collectionGroup: "Cooking"
      };
    case "currencies":
      return {
        ...base,
        collectionGroup: "Currencies",
        availability
      };
    case "cosmetics":
    case "cosmetic-crates":
    case "ascension-upgrades":
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.collectionSection)
      };
    default:
      return {
        ...base,
        collectionGroup: normalizeGroupLabel(row.collectionSection ?? row.collectionGroup)
      };
  }
}

async function readGrowGardenDataset(
  config: GrowGardenCollectionConfig
): Promise<{ meta: GrowGardenDatasetMeta | null; items: GrowGardenCollectionItem[] }> {
  const datasetPath = repoPath("data", "Grow a Garden", config.file);
  const raw = await fs.readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as
    | { meta?: GrowGardenDatasetMeta | null; items?: Record<string, unknown>[] | null }
    | Record<string, unknown>[];

  return parseGrowGardenDataset(config, parsed);
}

function parseGrowGardenDataset(
  config: GrowGardenCollectionConfig,
  parsed:
    | { meta?: GrowGardenDatasetMeta | null; items?: Record<string, unknown>[] | null }
    | Record<string, unknown>[]
): GrowGardenCollectionDataset {

  if (Array.isArray(parsed)) {
    return {
      meta: null,
      items: uniquifyGrowGardenItemIds(
        parsed
          .map((row) => normalizeGrowGardenItem(config.slug, row))
          .filter(Boolean) as GrowGardenCollectionItem[]
      )
    };
  }

  return {
    meta: parsed.meta ?? null,
    items: uniquifyGrowGardenItemIds(
      unwrapDatasetItems(parsed)
        .map((row) => normalizeGrowGardenItem(config.slug, row))
        .filter(Boolean) as GrowGardenCollectionItem[]
    )
  };
}

function uniquifyGrowGardenItemIds(items: GrowGardenCollectionItem[]): GrowGardenCollectionItem[] {
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

function buildGroupedSections(
  items: GrowGardenCollectionItem[],
  groupKey: string,
  sectionOrder?: string[] | null
) {
  const groups = new Map<string, { label: string; items: GrowGardenCollectionItem[] }>();

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

  const orderedSectionIndex = new Map(
    (sectionOrder ?? []).map((label, index) => [label.toLowerCase(), index] as const)
  );

  return Array.from(groups.values())
    .sort((left, right) => {
      if (orderedSectionIndex.size) {
        const leftRank = orderedSectionIndex.get(left.label.toLowerCase()) ?? orderedSectionIndex.size;
        const rightRank = orderedSectionIndex.get(right.label.toLowerCase()) ?? orderedSectionIndex.size;
        if (leftRank !== rightRank) return leftRank - rightRank;
        if (leftRank === orderedSectionIndex.size) return left.label.localeCompare(right.label);
        return 0;
      }
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

export function buildGrowGardenCollectionSidebarSections(
  config: GrowGardenCollectionConfig,
  dataset: GrowGardenCollectionDataset
): Array<{ id: string; label: string; count: number }> {
  return buildGrowGardenPreparedCollection(config, dataset).groupedSections.map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length
  }));
}

export function getGrowGardenCollectionPageCount(config: GrowGardenCollectionConfig, dataset: GrowGardenCollectionDataset) {
  return buildGrowGardenPreparedCollection(config, dataset).totalPages;
}

export async function loadGrowGardenCollectionDataset(config: GrowGardenCollectionConfig): Promise<GrowGardenCollectionDataset> {
  const code = buildGrowGardenCollectionFlatCode(config.slug);
  const runtime = await getPublishedWikiCollectionRuntimeByCode(code);
  if (runtime) {
    return parseGrowGardenDataset(
      config,
      runtime.document as { meta?: GrowGardenDatasetMeta | null; items?: Record<string, unknown>[] | null }
    );
  }
  if (!shouldFallbackToLocalWikiCollectionData(code)) {
    throw new Error(`Required database runtime for ${code} did not load. Local fallback is disabled.`);
  }
  try {
    return await readGrowGardenDataset(config);
  } catch (error) {
    console.error("Failed to load Grow a Garden collection dataset", error);
    return { meta: null, items: [] };
  }
}

type GrowGardenPreparedCollection = {
  dataset: GrowGardenCollectionDataset;
  groupedSections: ReturnType<typeof buildGroupedSections>;
  itemCount: number;
  totalPages: number;
};

const growGardenPreparedCollectionCache = new Map<string, Promise<GrowGardenPreparedCollection>>();

function buildGrowGardenPreparedCollection(
  config: GrowGardenCollectionConfig,
  dataset: GrowGardenCollectionDataset
): GrowGardenPreparedCollection {
  const groupedSections = buildGroupedSections(
    dataset.items,
    config.groupKey,
    dataset.meta?.display?.sectionOrder ?? null
  );
  const totalPages = buildCollectionPagination({
    sections: groupedSections,
    currentPage: 1,
    basePath: buildGrowGardenCollectionPath(config.slug)
  }).info.totalPages;

  return {
    dataset,
    groupedSections,
    itemCount: dataset.items.length,
    totalPages
  };
}

export async function loadPreparedGrowGardenCollection(
  config: GrowGardenCollectionConfig
): Promise<GrowGardenPreparedCollection> {
  const cached = growGardenPreparedCollectionCache.get(config.slug);
  if (cached) return cached;

  const next = loadGrowGardenCollectionDataset(config).then((dataset) => buildGrowGardenPreparedCollection(config, dataset));
  growGardenPreparedCollectionCache.set(config.slug, next);
  return next;
}

export async function getPreparedGrowGardenCollectionPageCount(config: GrowGardenCollectionConfig) {
  return (await loadPreparedGrowGardenCollection(config)).totalPages;
}

export function GrowGardenCollectionNav({
  activeSlug,
  className
}: {
  activeSlug: string;
  className?: string;
}) {
  return (
    <CatalogSelectNav
      label="Collection page"
      value={activeSlug}
      className={className}
      options={GROW_GARDEN_COLLECTIONS.map((entry) => ({
        value: entry.slug,
        label: entry.label,
        href: buildGrowGardenCollectionPath(entry.slug)
      }))}
    />
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

function GrowGardenSectionNav({
  sections,
  className
}: {
  sections: Array<{ id: string; label: string; count: number; href?: string }>;
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
        href: section.href,
        targetId: section.id
      }))}
    />
  );
}

export function buildGrowGardenItemListSchema({
  title,
  description,
  url,
  items,
  positionOffset = 0,
  totalItems
}: {
  title: string;
  description: string;
  url: string;
  items: GrowGardenCollectionItem[];
  positionOffset?: number;
  totalItems?: number;
}) {
  const itemListElement = items.map((item, index) => {
    const image = resolveAbsoluteUrl(item.image ?? FALLBACK_IMAGE);
    const itemUrl = `${url}#item-${item.id}`;
    return {
      "@type": "ListItem",
      position: positionOffset + index + 1,
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
    numberOfItems: totalItems ?? items.length,
    itemListElement
  });
}

export function renderGrowGardenCollectionPage({
  config,
  dataset,
  contentHtml,
  currentPage = 1,
  prepared
}: {
  config: GrowGardenCollectionConfig;
  dataset: GrowGardenCollectionDataset;
  contentHtml?: CollectionContentHtml | null;
  currentPage?: number;
  prepared?: GrowGardenPreparedCollection;
}) {
  const preparedCollection = prepared ?? buildGrowGardenPreparedCollection(config, dataset);
  const items = preparedCollection.dataset.items;
  const itemCount = preparedCollection.itemCount;
  const pageTitle = `All ${itemCount.toLocaleString("en-US")} ${config.label} in Grow a Garden`;
  const pageDescription = config.description;
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const faqHtml = contentHtml?.faqHtml ?? [];
  const dataUpdatedAt = resolveDataUpdatedAt(preparedCollection.dataset.meta);
  const contentUpdatedAt = contentHtml?.updatedAt ?? null;
  const updatedAt = dataUpdatedAt ?? contentUpdatedAt;
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const basePath = buildGrowGardenCollectionPath(config.slug);
  const updatedIso = updatedDate?.toISOString() ?? null;
  const publishedIso = toIsoContentDate(contentHtml?.publishedAt) ?? updatedIso;
  const pagination = buildCollectionPagination({
    sections: preparedCollection.groupedSections,
    currentPage,
    basePath
  });
  const pageSections = pagination.sections;
  const pageItems = pageSections.flatMap((section) => section.items);
  const canonicalPath =
    pagination.info.currentPage === 1 ? basePath : `${basePath}/page/${pagination.info.currentPage}`;
  const pageTitleWithPage =
    pagination.info.currentPage === 1 ? pageTitle : `${pageTitle} - Page ${pagination.info.currentPage}`;
  const pageDescriptionWithPage =
    pagination.info.currentPage === 1
      ? pageDescription
      : `${pageDescription} Page ${pagination.info.currentPage} of ${pagination.info.totalPages}.`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const sectionNav = pagination.sectionLinks;
  const hasDetails = pagination.info.currentPage === 1 && (Boolean(descriptionHtml.length) || Boolean(faqHtml.length));

  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Wiki", href: "/wiki" },
    { label: "Grow a Garden", href: "/wiki/grow-a-garden" },
    {
      label: pagination.info.currentPage === 1 ? config.label : `${config.label} page ${pagination.info.currentPage}`,
      href: null
    }
  ];

  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Wiki", url: `${SITE_URL.replace(/\/$/, "")}/wiki` },
      { name: "Grow a Garden", url: `${SITE_URL.replace(/\/$/, "")}/wiki/grow-a-garden` },
      { name: pagination.info.currentPage === 1 ? config.label : `${config.label} page ${pagination.info.currentPage}`, url: canonicalUrl }
    ])
  );

  const listSchema = buildGrowGardenItemListSchema({
    title: pageTitleWithPage,
    description: pageDescriptionWithPage,
    url: canonicalUrl,
    items: pageItems,
    positionOffset: pagination.info.pageStartIndex,
    totalItems: itemCount
  });

  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitleWithPage,
      description: pageDescriptionWithPage,
      image: `${SITE_URL}/Bloxodes.png`,
      author: null,
      publishedAt: publishedIso,
      updatedAt: updatedIso
    })
  );

  const introNodes = introHtml ? renderPageContentNodes(introHtml, "grow-garden-intro") : null;
  const descriptionNodes = descriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `grow-garden-description-${entry.key}`)
  );
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `grow-garden-faq-${idx}`)
  }));

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <GrowGardenBreadcrumb items={breadcrumbNavItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{pageTitleWithPage}</h1>
        <UpdatedTimestamp value={updatedDate} />
      </header>

      <section className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {pagination.info.currentPage === 1 && introNodes ? introNodes : null}

        <CatalogAdSlot />

        <div className="grid gap-4 md:grid-cols-2 md:items-end">
          <GrowGardenCollectionNav activeSlug={config.slug} className="max-w-none" />
          {sectionNav.length > 1 ? <GrowGardenSectionNav sections={sectionNav} className="max-w-none" /> : null}
        </div>

        <GameCollectionView sections={pageSections} config={config} pagination={pagination.info} />

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

      {pagination.info.currentPage === 1 ? (
        <>
          {contentHtml?.id ? (
            <div className="mt-10">
              <CommentsSection entityType="wiki_collection" entityId={contentHtml.id} />
            </div>
          ) : null}
          <MoreWikiCollections wikiSlug="grow-a-garden" excludeCollectionSlug={config.slug} gameName="Grow a Garden" />
        </>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
