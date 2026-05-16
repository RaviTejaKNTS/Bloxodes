import fs from "node:fs/promises";
import { repoPath } from "@/lib/paths";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { CatalogSelectNav } from "@/components/CatalogSelectNav";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { ForgeCatalogView } from "../the-forge/ForgeCatalogView";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { renderPageContentNodes } from "@/lib/page-content";
import {
  buildGameDatasetCatalogPath,
  GAME_DATASET_CATALOGS,
  getFieldLabel,
  getGameDatasetCatalogConfigByCode,
  type GameDatasetCatalogConfig
} from "@/lib/game-dataset-catalogs";

const FALLBACK_IMAGE = "/og-image.png";

export type GameDatasetCatalogContentHtml = {
  id?: string | null;
  title?: string | null;
  introHtml?: string;
  howHtml?: string;
  descriptionHtml?: Array<{ key: string; html: string }>;
  faqHtml?: Array<{ q: string; a: string }>;
  updatedAt?: string | null;
};

type GameDatasetSource = {
  label?: string | null;
  url?: string | null;
  accessed?: string | null;
};

export type GameDatasetMeta = {
  title?: string | null;
  updatedAt?: string | null;
  sources?: GameDatasetSource[] | null;
  columns?: string[] | null;
};

export type GameDatasetCatalogItem = {
  id: string;
  name: string;
  image?: string | null;
  [key: string]: unknown;
};

export type GameDatasetCatalogDataset = {
  meta: GameDatasetMeta | null;
  columns: string[];
  items: GameDatasetCatalogItem[];
};

type GenericViewConfig = {
  slug: string;
  label: string;
  groupLabel: string;
  groupKey: string;
  stats: Array<{ key: string; label: string }>;
  maxStats?: number;
  badgeKey?: string;
  subtitleKeys?: string[];
  descriptionKey?: string;
  cardDescriptionKey?: string;
  hideImages?: boolean;
};

const GROUP_KEY_PRIORITY = [
  "rarity",
  "tier",
  "category",
  "type",
  "sea",
  "sourceType",
  "status",
  "rewardCategory",
  "machine",
  "location",
  "building",
  "level"
];

const BADGE_KEY_PRIORITY = ["rarity", "tier", "status", "type", "category", "sea"];

const SUBTITLE_KEY_PRIORITY = [
  "category",
  "type",
  "sea",
  "location",
  "building",
  "source",
  "sourceType",
  "availability",
  "status",
  "level",
  "cost",
  "price",
  "money",
  "robux",
  "requirements"
];

const DESCRIPTION_KEY_PRIORITY = [
  "description",
  "overview",
  "summary",
  "whatItDoes",
  "use",
  "effect",
  "benefits",
  "obtainment",
  "acquisition",
  "unlock",
  "usageTips",
  "notes",
  "visuals",
  "changesNotes",
  "appearance",
  "formation",
  "weather",
  "specialItemsAbilities",
  "reason",
  "descriptionNotes"
];

const STAT_KEY_PRIORITY = [
  "income",
  "cost",
  "price",
  "costBucks",
  "costStars",
  "money",
  "robux",
  "requiredCash",
  "requiredBrainrots",
  "multiplier",
  "maxChance",
  "spawnChance",
  "level",
  "exp",
  "expNeeded",
  "dodges",
  "health",
  "seats",
  "cannons",
  "speed",
  "requirements",
  "obtainment",
  "source",
  "bonuses",
  "drops",
  "abilities",
  "stats",
  "chances",
  "available",
  "availability"
];

const HIDDEN_FIELD_KEYS = new Set([
  "id",
  "slug",
  "name",
  "image",
  "sourceImageUrl",
  "sourcePage",
  "wikiUrl",
  "imageCandidate",
  "sourceTables",
  "fields",
  "raw",
  "rawText",
  "sections"
]);

export function getGameDatasetCatalogConfig(collectionCode: string): GameDatasetCatalogConfig | null {
  return getGameDatasetCatalogConfigByCode(collectionCode);
}

async function readDataset(
  config: GameDatasetCatalogConfig
): Promise<{ meta: GameDatasetMeta | null; rows: Record<string, unknown>[] }> {
  const datasetPath = repoPath("data", config.dataDir, config.file);
  const raw = await fs.readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw) as
    | { meta?: GameDatasetMeta | null; items?: Record<string, unknown>[] | null; data?: Record<string, unknown>[] | null }
    | Record<string, unknown>[];

  if (Array.isArray(parsed)) {
    return { meta: null, rows: parsed };
  }

  return {
    meta: parsed.meta ?? null,
    rows: parsed.items ?? parsed.data ?? []
  };
}

export async function loadGameDatasetCatalogDataset(
  config: GameDatasetCatalogConfig
): Promise<GameDatasetCatalogDataset> {
  try {
    const { meta, rows } = await readDataset(config);
    const items = uniquifyIds(rows.map(normalizeItem).filter(Boolean) as GameDatasetCatalogItem[]);
    return {
      meta,
      columns: resolveColumns(meta, rows, items),
      items
    };
  } catch (error) {
    console.error(`Failed to load ${config.code} catalog dataset`, error);
    return { meta: null, columns: [], items: [] };
  }
}

function normalizeItem(row: Record<string, unknown>): GameDatasetCatalogItem | null {
  const name = normalizeText(row.name) ?? normalizeText(row.title) ?? normalizeText(row.item);
  if (!name) return null;

  const fields = isRecord(row.fields) ? row.fields : {};
  const flattenedFields = Object.fromEntries(
    Object.entries(fields).filter(([key]) => !(key in row) && key !== "image" && key !== "item")
  );
  const slug = normalizeText(row.slug) ?? toSlug(name);

  return {
    ...flattenedFields,
    ...row,
    id: toSlug(slug || name),
    name,
    image: normalizeImage(row.image) ?? normalizeImage(row.imageCandidate) ?? null
  };
}

function uniquifyIds(items: GameDatasetCatalogItem[]): GameDatasetCatalogItem[] {
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

function resolveColumns(
  meta: GameDatasetMeta | null,
  rows: Record<string, unknown>[],
  items: GameDatasetCatalogItem[]
): string[] {
  const fromMeta = (meta?.columns ?? []).filter(Boolean);
  const seen = new Set<string>(fromMeta);
  for (const row of [...rows.slice(0, 20), ...items.slice(0, 20)]) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
      }
    }
  }
  return Array.from(seen);
}

function buildViewConfig(
  config: GameDatasetCatalogConfig,
  dataset: GameDatasetCatalogDataset
): GenericViewConfig {
  const columns = dataset.columns;
  const groupKey = pickFirstExistingKey(columns, GROUP_KEY_PRIORITY) ?? "catalogGroup";
  const badgeKey = pickFirstExistingKey(columns, BADGE_KEY_PRIORITY);
  const descriptionKey = pickFirstExistingKey(columns, DESCRIPTION_KEY_PRIORITY);
  const subtitleKeys = SUBTITLE_KEY_PRIORITY.filter((key) => columns.includes(key) && key !== badgeKey).slice(0, 2);
  const statKeys = [
    ...STAT_KEY_PRIORITY.filter((key) => columns.includes(key)),
    ...columns.filter((key) => !HIDDEN_FIELD_KEYS.has(key))
  ].filter((key) => key !== badgeKey && key !== descriptionKey && !subtitleKeys.includes(key));
  const stats = Array.from(new Set(statKeys))
    .slice(0, 6)
    .map((key) => ({ key, label: getFieldLabel(key) }));
  const hasImages = dataset.items.some((item) => Boolean(normalizeText(item.image)));

  if (groupKey === "catalogGroup") {
    dataset.items.forEach((item) => {
      item.catalogGroup = "Items";
    });
  }

  return {
    slug: config.code,
    label: config.label,
    groupKey,
    groupLabel: groupKey === "catalogGroup" ? "Group" : getFieldLabel(groupKey),
    badgeKey: badgeKey ?? undefined,
    subtitleKeys,
    descriptionKey: descriptionKey ?? undefined,
    cardDescriptionKey: descriptionKey ?? undefined,
    stats,
    maxStats: Math.min(6, stats.length),
    hideImages: !hasImages
  };
}

function buildGroupedSections(items: GameDatasetCatalogItem[], groupKey: string) {
  const groups = new Map<string, GameDatasetCatalogItem[]>();
  items.forEach((item) => {
    const label = normalizeValue(item[groupKey]) ?? "Other";
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)?.push(item);
  });

  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, entries]) => ({
      id: `section-${toSlug(label || "items")}`,
      label,
      items: entries
    }));
}

function pickFirstExistingKey(columns: string[], keys: string[]): string | null {
  return keys.find((key) => columns.includes(key)) ?? null;
}

function resolveDataUpdatedAt(meta: GameDatasetMeta | null): string | null {
  if (!meta) return null;
  if (meta.updatedAt) return meta.updatedAt;
  const sources = meta.sources ?? [];
  return sources.find((source) => source?.accessed)?.accessed ?? null;
}

function resolveAbsoluteUrl(value: string | null | undefined): string {
  if (!value) return `${SITE_URL}${FALLBACK_IMAGE}`;
  if (value.startsWith("http")) return value;
  return `${SITE_URL.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}

function buildItemListSchema({
  title,
  description,
  url,
  items
}: {
  title: string;
  description: string;
  url: string;
  items: GameDatasetCatalogItem[];
}) {
  const itemListElement = items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Thing",
      name: item.name,
      url: `${url}#item-${item.id}`,
      image: resolveAbsoluteUrl(item.image ?? FALLBACK_IMAGE)
    }
  }));

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

function DatasetCatalogNav({
  config,
  className
}: {
  config: GameDatasetCatalogConfig;
  className?: string;
}) {
  const options = GAME_DATASET_CATALOGS.filter((entry) => entry.gameSlug === config.gameSlug).map((entry) => ({
    value: entry.code,
    label: entry.label,
    href: buildGameDatasetCatalogPath(entry.code)
  }));

  return <CatalogSelectNav label={`${config.gameName} catalog`} value={config.code} className={className} options={options} />;
}

function SectionNav({
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

export function renderGameDatasetCatalogPage({
  config,
  dataset,
  contentHtml
}: {
  config: GameDatasetCatalogConfig;
  dataset: GameDatasetCatalogDataset;
  contentHtml?: GameDatasetCatalogContentHtml | null;
}) {
  const items = dataset.items;
  const itemCount = items.length;
  const pageTitle =
    contentHtml?.title?.trim() ||
    `All ${itemCount.toLocaleString("en-US")} ${config.label} in ${config.gameName}`;
  const pageDescription = `${config.gameName} ${config.label.toLowerCase()} catalog with ${itemCount.toLocaleString("en-US")} tracked entries.`;
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const howHtml = contentHtml?.howHtml?.trim() ? contentHtml.howHtml : "";
  const faqHtml = contentHtml?.faqHtml ?? [];
  const dataUpdatedAt = resolveDataUpdatedAt(dataset.meta);
  const contentUpdatedAt = contentHtml?.updatedAt ?? null;
  const updatedAt = dataUpdatedAt ?? contentUpdatedAt;
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const canonicalPath = buildGameDatasetCatalogPath(config.code);
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const updatedIso = updatedDate?.toISOString() ?? null;
  const viewConfig = buildViewConfig(config, dataset);
  const groupedSections = buildGroupedSections(items, viewConfig.groupKey);
  const sectionNav = groupedSections.map((section) => ({
    id: section.id,
    label: section.label,
    count: section.items.length
  }));
  const hasDetails = Boolean(descriptionHtml.length) || Boolean(howHtml) || Boolean(faqHtml.length);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: config.gameName, href: `/wiki/${config.gameSlug}` },
    { label: config.label, href: null }
  ];

  const introNodes = introHtml ? renderPageContentNodes(introHtml, `${config.code}-intro`) : null;
  const descriptionNodes = descriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `${config.code}-description-${entry.key}`)
  );
  const howNodes = howHtml ? renderPageContentNodes(howHtml, `${config.code}-how`) : null;
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `${config.code}-faq-${idx}`)
  }));

  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: config.gameName, url: `${SITE_URL.replace(/\/$/, "")}/wiki/${config.gameSlug}` },
      { name: config.label, url: canonicalUrl }
    ])
  );

  const listSchema = buildItemListSchema({
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

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={breadcrumbItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{pageTitle}</h1>
        <UpdatedTimestamp value={updatedDate} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes ? introNodes : null}

        <CatalogAdSlot />

        <div className="grid gap-4 md:grid-cols-2 md:items-end">
          <DatasetCatalogNav config={config} className="max-w-none" />
          {sectionNav.length > 1 ? <SectionNav sections={sectionNav} className="max-w-none" /> : null}
        </div>

        <ForgeCatalogView sections={groupedSections} config={viewConfig} />

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) || isRecord(value)) return null;
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

function normalizeValue(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (normalized) return normalized;
  if (Array.isArray(value)) {
    const parts = value.map((entry) => normalizeValue(entry)).filter(Boolean) as string[];
    return parts.length ? parts.join("; ") : null;
  }
  if (isRecord(value)) {
    const parts = Object.entries(value)
      .map(([key, entry]) => {
        const entryValue = normalizeValue(entry);
        return entryValue ? `${getFieldLabel(key)}: ${entryValue}` : null;
      })
      .filter(Boolean) as string[];
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

function normalizeImage(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized || normalized.startsWith("data:image")) return null;
  return normalized;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
