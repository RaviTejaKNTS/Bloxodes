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
import { THE_FORGE_COLLECTIONS, type GameCollectionViewConfig } from "@/lib/game-collections/games/the-forge";
import { unwrapDatasetItems } from "@/lib/local-datasets";
import { toIsoContentDate } from "@/lib/content-dates";

const FALLBACK_IMAGE = "/Bloxodes.png";


export type CollectionContentHtml = {
  id?: string | null;
  title?: string | null;
  introHtml?: string;
  howHtml?: string;
  descriptionHtml?: Array<{ key: string; html: string }>;
  faqHtml?: Array<{ q: string; a: string }>;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

export function getTheForgeCollectionConfig(slug: string): GameCollectionViewConfig | null {
  const normalized = slug.trim().toLowerCase();
  return THE_FORGE_COLLECTIONS.find((entry) => entry.slug === normalized) ?? null;
}

export function buildTheForgeCollectionCodeCandidates(config: GameCollectionViewConfig): string[] {
  const primary = `the-forge-${config.slug}`;
  const legacy = `the-forge/${config.slug}`;
  return [primary, legacy];
}

export function buildTheForgeCollectionFlatCode(slug: string): string {
  return `the-forge-${slug.trim().toLowerCase()}`;
}

export function buildTheForgeCollectionPath(slug: string): string {
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

export type GameCollectionItem = {
  id: string;
  name: string;
  image?: string | null;
  link?: string | null;
  [key: string]: unknown;
};

export type TheForgeCollectionDataset = {
  meta: ForgeDatasetMeta | null;
  items: GameCollectionItem[];
};

async function readForgeDataset(file: string): Promise<{ meta: ForgeDatasetMeta | null; items: GameCollectionItem[] }> {
  const datasetPath = repoPath("data", "The Forge", file);
  const raw = await fs.readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as
    | { meta?: ForgeDatasetMeta | null; items?: Record<string, unknown>[] | null }
    | Record<string, unknown>[];

  if (Array.isArray(parsed)) {
    return { meta: null, items: uniquifyForgeItemIds(parsed.map(normalizeItem).filter(Boolean) as GameCollectionItem[]) };
  }

  const items = uniquifyForgeItemIds(unwrapDatasetItems(parsed).map(normalizeItem).filter(Boolean) as GameCollectionItem[]);
  return { meta: parsed.meta ?? null, items };
}

function uniquifyForgeItemIds(items: GameCollectionItem[]): GameCollectionItem[] {
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

function normalizeItem(row: Record<string, unknown>): GameCollectionItem | null {
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


function buildGroupedSections(items: GameCollectionItem[], groupKey: string) {
  const groups = new Map<string, GameCollectionItem[]>();
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

export function buildTheForgeCollectionSidebarSections(
  config: GameCollectionViewConfig,
  dataset: TheForgeCollectionDataset
): Array<{ id: string; label: string; count: number }> {
  return buildTheForgePreparedCollection(config, dataset).groupedSections.map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length
  }));
}

export function getTheForgeCollectionPageCount(config: GameCollectionViewConfig, dataset: TheForgeCollectionDataset) {
  return buildTheForgePreparedCollection(config, dataset).totalPages;
}

function resolveDataUpdatedAt(meta: ForgeDatasetMeta | null): string | null {
  if (!meta) return null;
  if (meta.updatedAt) return meta.updatedAt;
  const sources = meta.sources ?? [];
  return sources.find((source) => source?.accessed)?.accessed ?? null;
}

export async function loadTheForgeCollectionDataset(config: GameCollectionViewConfig): Promise<TheForgeCollectionDataset> {
  try {
    return await readForgeDataset(config.file);
  } catch (error) {
    console.error("Failed to load The Forge collection dataset", error);
    return { meta: null, items: [] };
  }
}

type TheForgePreparedCollection = {
  dataset: TheForgeCollectionDataset;
  groupedSections: ReturnType<typeof buildGroupedSections>;
  itemCount: number;
  totalPages: number;
};

const theForgePreparedCollectionCache = new Map<string, Promise<TheForgePreparedCollection>>();

function buildTheForgePreparedCollection(config: GameCollectionViewConfig, dataset: TheForgeCollectionDataset): TheForgePreparedCollection {
  const groupedSections = buildGroupedSections(dataset.items, config.groupKey);
  const totalPages = buildCollectionPagination({
    sections: groupedSections,
    currentPage: 1,
    basePath: buildTheForgeCollectionPath(config.slug)
  }).info.totalPages;

  return {
    dataset,
    groupedSections,
    itemCount: dataset.items.length,
    totalPages
  };
}

export async function loadPreparedTheForgeCollection(config: GameCollectionViewConfig): Promise<TheForgePreparedCollection> {
  const cached = theForgePreparedCollectionCache.get(config.slug);
  if (cached) return cached;

  const next = loadTheForgeCollectionDataset(config).then((dataset) => buildTheForgePreparedCollection(config, dataset));
  theForgePreparedCollectionCache.set(config.slug, next);
  return next;
}

export async function getPreparedTheForgeCollectionPageCount(config: GameCollectionViewConfig) {
  return (await loadPreparedTheForgeCollection(config)).totalPages;
}

export function TheForgeCollectionNav({
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
      options={THE_FORGE_COLLECTIONS.map((entry) => ({
        value: entry.slug,
        label: entry.label,
        href: buildTheForgeCollectionPath(entry.slug)
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

export function buildForgeItemListSchema({
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
  items: GameCollectionItem[];
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

export function renderTheForgeCollectionPage({
  config,
  dataset,
  contentHtml,
  currentPage = 1,
  prepared
}: {
  config: GameCollectionViewConfig;
  dataset: TheForgeCollectionDataset;
  contentHtml?: CollectionContentHtml | null;
  currentPage?: number;
  prepared?: TheForgePreparedCollection;
}) {
  const preparedCollection = prepared ?? buildTheForgePreparedCollection(config, dataset);
  const items = preparedCollection.dataset.items;
  const itemCount = preparedCollection.itemCount;
  const pageTitle = `All ${itemCount.toLocaleString("en-US")} ${config.label} in The Forge`;
  const pageDescription = config.description;
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const faqHtml = contentHtml?.faqHtml ?? [];
  const dataUpdatedAt = resolveDataUpdatedAt(preparedCollection.dataset.meta);
  const contentUpdatedAt = contentHtml?.updatedAt ?? null;
  const updatedAt = dataUpdatedAt ?? contentUpdatedAt;
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const basePath = buildTheForgeCollectionPath(config.slug);
  const pagination = buildCollectionPagination({
    sections: preparedCollection.groupedSections,
    currentPage,
    basePath
  });
  const pageSections = pagination.sections;
  const pageItems = pageSections.flatMap((section) => section.items);
  const canonicalPath =
    pagination.info.currentPage === 1 ? basePath : `${basePath}/page/${pagination.info.currentPage}`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitleWithPage =
    pagination.info.currentPage === 1 ? pageTitle : `${pageTitle} - Page ${pagination.info.currentPage}`;
  const pageDescriptionWithPage =
    pagination.info.currentPage === 1
      ? pageDescription
      : `${pageDescription} Page ${pagination.info.currentPage} of ${pagination.info.totalPages}.`;
  const updatedIso = updatedDate?.toISOString() ?? null;
  const publishedIso = toIsoContentDate(contentHtml?.publishedAt) ?? updatedIso;
  const sectionNav = pagination.sectionLinks;
  const hasDetails = pagination.info.currentPage === 1 && (Boolean(descriptionHtml.length) || Boolean(faqHtml.length));

  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Wiki", href: "/wiki" },
    { label: "The Forge", href: "/wiki/the-forge" },
    {
      label: pagination.info.currentPage === 1 ? config.label : `${config.label} page ${pagination.info.currentPage}`,
      href: null
    }
  ];

  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Wiki", url: `${SITE_URL.replace(/\/$/, "")}/wiki` },
      { name: "The Forge", url: `${SITE_URL.replace(/\/$/, "")}/wiki/the-forge` },
      { name: pagination.info.currentPage === 1 ? config.label : `${config.label} page ${pagination.info.currentPage}`, url: canonicalUrl }
    ])
  );

  const listSchema = buildForgeItemListSchema({
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
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{pageTitleWithPage}</h1>
        <UpdatedTimestamp value={updatedDate} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {pagination.info.currentPage === 1 && introNodes ? introNodes : null}

        <CatalogAdSlot />

        <GameCollectionView
          sections={pageSections}
          config={config}
          pagination={pagination.info}
          toolbar={
            <>
              <TheForgeCollectionNav activeSlug={config.slug} className="max-w-none" />
              {sectionNav.length > 1 ? <ForgeSectionNav sections={sectionNav} className="max-w-none" /> : null}
            </>
          }
        />

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
          <MoreWikiCollections wikiSlug="the-forge" excludeCollectionSlug={config.slug} gameName="The Forge" />
        </>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
