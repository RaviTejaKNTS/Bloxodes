import Link from "next/link";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { MoreCatalogs } from "@/components/more-content";
import { PageBreadcrumb, type PageBreadcrumbItem } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import type { CatalogPageContent } from "@/lib/catalog";
import { formatRelativeDate } from "@/lib/content-dates";
import {
  DEFAULT_SORT,
  normalizeSearchQuery,
  normalizeSortKey,
  type DecalSortKey
} from "@/lib/decal-ids-search";
import {
  DECAL_CATEGORY_DEFINITIONS,
  getDecalCategoryDescription,
  getDecalCategoryLabel,
  normalizeCategorySlug
} from "@/lib/decal-id-categories";
import { buildPageContentHtml, renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import { breadcrumbJsonLd, CATALOG_DESCRIPTION, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabase";
import { DecalIdsBrowser } from "./DecalIdsBrowser";
import { getDecalGameIdPage, type DecalGameDatasetPreset } from "@/lib/game-specific-id-pages";

const PAGE_SIZE = 24;
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";
const DECAL_SOURCE_TABLE = "roblox_decal_ids";
const BASE_SELECT_FIELDS =
  "asset_id, texture_id, name, description, creator_id, creator_type, creator_name, creator_verified, roblox_created_at, roblox_updated_at, is_public_domain, is_for_sale, price_in_robux, sales, purchasable, vote_count, upvote_percent, thumbnail_url, thumbnail_state, thumbnail_checked_at, source, first_seen_at, last_seen_at, verified_at, popularity_score, categories, primary_category, curated_score, curated_rank, curated_tier, curated_reason";

export const BASE_PATH = "/catalog/roblox-decal-ids";
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;
export const DECAL_SEO_TITLE = "Roblox Decal IDs [24K+ Image Codes]";
export const DECAL_PAGE_HEADING = "Roblox Decal IDs / Image IDs";

export function buildDecalCuratedPath(): string {
  return `${BASE_PATH}/curated`;
}

export function buildDecalCategoriesPath(): string {
  return `${BASE_PATH}/categories`;
}

export function buildDecalCategoryPath(categorySlug: string): string {
  return `${BASE_PATH}/categories/${categorySlug}`;
}

export type DecalRow = {
  asset_id: number;
  texture_id: number | null;
  name: string;
  description: string | null;
  creator_id: number | null;
  creator_type: string | null;
  creator_name: string | null;
  creator_verified: boolean | null;
  roblox_created_at: string | null;
  roblox_updated_at: string | null;
  is_public_domain: boolean | null;
  is_for_sale: boolean | null;
  price_in_robux: number | null;
  sales: number | null;
  purchasable: boolean | null;
  vote_count: number | null;
  upvote_percent: number | null;
  thumbnail_url: string | null;
  thumbnail_state: string | null;
  thumbnail_checked_at: string | null;
  source: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  verified_at: string | null;
  popularity_score: number | null;
  categories: string[] | null;
  primary_category: string | null;
  curated_score: number | null;
  curated_rank: number | null;
  curated_tier: string | null;
  curated_reason: string | null;
  thumbnail_ready: boolean | null;
  age_bucket: number | null;
  source_count: number | null;
};

export type DecalCategoryRow = {
  slug: string;
  label: string;
  description: string;
  count: number;
  latestVerifiedAt: string | null;
  topCuratedScore: number | null;
};

export type CatalogContentHtml = PageContentHtml;

type PageData = {
  decals: DecalRow[];
  total: number;
  totalPages: number;
};

export type DecalResolvedSearch = {
  search: string;
  sort: DecalSortKey;
};

export type DecalNavKey = "all" | "curated" | "categories" | "games";

type DecalNavItem = {
  id: DecalNavKey;
  title: string;
  description: string;
  href: string;
};

export type BreadcrumbItem = PageBreadcrumbItem;

type OrderableQuery<T> = {
  order: (...args: any[]) => T;
};

type DecalListOptions = {
  category?: string | null;
  curated?: boolean;
  preset?: DecalGameDatasetPreset | null;
};

const DECAL_NAV_ITEMS: DecalNavItem[] = [
  {
    id: "all",
    title: "All Decal IDs",
    description: "Broad verified decal ID discovery with copy-ready image codes.",
    href: BASE_PATH
  },
  {
    id: "curated",
    title: "Curated",
    description: "Higher-signal decal IDs from curated sources and ranking checks.",
    href: buildDecalCuratedPath()
  },
  {
    id: "categories",
    title: "Categories",
    description: "Browse decal IDs by image style, theme, and common use.",
    href: buildDecalCategoriesPath()
  },
  {
    id: "games",
    title: "Game Specific",
    description: "Image IDs selected for the custom-image features in Roblox games.",
    href: `${BASE_PATH}/games`
  }
];

export async function buildRobloxDecalCatalogContentHtml(
  catalog: CatalogPageContent | null
): Promise<CatalogContentHtml | null> {
  return buildPageContentHtml(catalog);
}

function formatLoadError(error: unknown) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (typeof (error as { message?: unknown }).message === "string") {
    const message = (error as { message: string }).message;
    return message.length > 240 ? `${message.slice(0, 240)}...` : message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function reportLoadError(context: string, error: unknown) {
  if (IS_BUILD) return;
  console.error(context, formatLoadError(error));
}

function buildLoosePattern(value: string): string {
  const cleaned = value.replace(/[%_]/g, " ").trim();
  const pattern = cleaned.replace(/[^a-z0-9]+/gi, "%").replace(/%{2,}/g, "%");
  return `%${pattern}%`;
}

function applySort<T extends OrderableQuery<T>>(query: T, sort: DecalSortKey): T {
  switch (sort) {
    case "popular":
      return query
        .order("vote_count", { ascending: false, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false });
    case "newest":
      return query.order("roblox_created_at", { ascending: false, nullsFirst: false });
    case "oldest":
      return query.order("roblox_created_at", { ascending: true, nullsFirst: false });
    case "name_asc":
      return query.order("name", { ascending: true, nullsFirst: false });
    case "creator_asc":
      return query.order("creator_name", { ascending: true, nullsFirst: false });
    case "recommended":
    default:
      return query
        .order("curated_rank", { ascending: true, nullsFirst: false })
        .order("curated_score", { ascending: false, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false });
  }
}

function normalizeBaseDecalRows(rows: unknown[] | null): DecalRow[] {
  return (rows ?? []).map((row) => ({
    ...(row as DecalRow),
    thumbnail_ready: (row as DecalRow).thumbnail_state === "Completed" && Boolean((row as DecalRow).thumbnail_url),
    age_bucket: null,
    source_count: null
  }));
}

export async function loadRobloxDecalIdsPageData(
  page: number,
  search: DecalResolvedSearch = { search: "", sort: DEFAULT_SORT },
  options: DecalListOptions = {}
): Promise<PageData> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const offset = (safePage - 1) * PAGE_SIZE;
  const supabase = supabaseAdmin();
  let query = supabase.from(DECAL_SOURCE_TABLE).select(BASE_SELECT_FIELDS, { count: "exact" });

  query = query
    .eq("status", "active")
    .eq("thumbnail_state", "Completed")
    .not("thumbnail_url", "is", null)
    .not("thumbnail_url", "ilike", "%/UnknownImage/%");

  if (options.curated) {
    query = query.not("curated_rank", "is", null);
  }

  if (options.preset === "crosshairs") {
    query = query.ilike("name", "%crosshair%");
  } else if (options.preset === "faces") {
    query = query.overlaps("categories", ["faces"]);
  } else if (options.preset === "decor") {
    query = query.overlaps("categories", ["posters", "aesthetic", "textures"]);
  } else if (options.preset === "jjs-images") {
    query = query.overlaps("categories", ["anime", "memes", "characters", "posters"]);
  } else if (options.preset === "spray-paint") {
    query = query.not("curated_rank", "is", null);
  }

  const categorySlug = options.category ? normalizeCategorySlug(options.category) : null;
  if (categorySlug) {
    query = query.contains("categories", [categorySlug]);
  }

  if (search.search) {
    const pattern = buildLoosePattern(search.search);
    const orParts = [
      `name.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `creator_name.ilike.${pattern}`
    ];
    if (/^\d+$/.test(search.search)) {
      orParts.unshift(`asset_id.eq.${search.search}`, `texture_id.eq.${search.search}`);
    }
    query = query.or(orParts.join(","));
  }

  if (options.curated && search.sort === DEFAULT_SORT) {
    query = query
      .order("curated_rank", { ascending: true, nullsFirst: false })
      .order("curated_score", { ascending: false, nullsFirst: false })
      .order("popularity_score", { ascending: false, nullsFirst: false });
  } else {
    query = applySort(query, search.sort);
  }

  const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);
  if (error) {
    reportLoadError("Failed to load Roblox decal IDs", error);
    return { decals: [], total: 0, totalPages: 1 };
  }

  const total = count ?? data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { decals: normalizeBaseDecalRows(data), total, totalPages };
}

export async function loadGameDecalIdsPageData(
  page: number,
  gameSlug: string,
  preset: DecalGameDatasetPreset,
  search: DecalResolvedSearch = { search: "", sort: DEFAULT_SORT }
): Promise<PageData> {
  const game = getDecalGameIdPage(gameSlug);
  const requiresTextureId = game?.copyTextureId ?? false;

  try {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const offset = (safePage - 1) * PAGE_SIZE;
    const supabase = supabaseAdmin();
    let query = supabase
      .from("roblox_decal_ids_game_view")
      .select(BASE_SELECT_FIELDS, { count: "exact" })
      .eq("game_slug", gameSlug);

    if (requiresTextureId) {
      query = query.not("texture_id", "is", null).gt("texture_id", 0);
    }

    if (search.search) {
      const pattern = buildLoosePattern(search.search);
      const orParts = [
        `name.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `creator_name.ilike.${pattern}`
      ];
      if (/^\d+$/.test(search.search)) orParts.unshift(`asset_id.eq.${search.search}`, `texture_id.eq.${search.search}`);
      query = query.or(orParts.join(","));
    }

    if (search.sort === DEFAULT_SORT) {
      query = query.order("game_sort_order", { ascending: true }).order("popularity_score", { ascending: false, nullsFirst: false });
    } else {
      query = applySort(query, search.sort);
    }

    const { data, error, count } = await query.order("asset_id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (!error && (count ?? 0) > 0) {
      const total = count ?? data?.length ?? 0;
      return { decals: normalizeBaseDecalRows(data), total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
    }
    if (error) reportLoadError(`Failed to load mapped decal IDs for ${gameSlug}`, error);
  } catch (error) {
    reportLoadError(`Failed to load mapped decal IDs for ${gameSlug}`, error);
  }

  if (!requiresTextureId) return loadRobloxDecalIdsPageData(page, search, { preset });

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const offset = (safePage - 1) * PAGE_SIZE;
  const supabase = supabaseAdmin();
  let fallback = supabase
    .from(DECAL_SOURCE_TABLE)
    .select(BASE_SELECT_FIELDS, { count: "exact" })
    .eq("status", "active")
    .eq("thumbnail_state", "Completed")
    .not("thumbnail_url", "is", null)
    .not("thumbnail_url", "ilike", "%/UnknownImage/%")
    .not("texture_id", "is", null)
    .gt("texture_id", 0);

  if (preset === "crosshairs") {
    fallback = fallback.ilike("name", "%crosshair%");
  } else if (preset === "faces") {
    fallback = fallback.overlaps("categories", ["faces"]);
  } else if (preset === "decor") {
    fallback = fallback.overlaps("categories", ["posters", "aesthetic", "textures"]);
  } else if (preset === "jjs-images") {
    fallback = fallback.overlaps("categories", ["anime", "memes", "characters", "posters"]);
  } else if (preset === "spray-paint") {
    fallback = fallback.not("curated_rank", "is", null);
  }

  if (search.search) {
    const pattern = buildLoosePattern(search.search);
    const orParts = [
      `name.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `creator_name.ilike.${pattern}`
    ];
    if (/^\d+$/.test(search.search)) orParts.unshift(`asset_id.eq.${search.search}`, `texture_id.eq.${search.search}`);
    fallback = fallback.or(orParts.join(","));
  }

  fallback = applySort(fallback, search.sort);
  const { data, error, count } = await fallback.range(offset, offset + PAGE_SIZE - 1);
  if (error) {
    reportLoadError(`Failed to load texture IDs for ${gameSlug}`, error);
    return { decals: [], total: 0, totalPages: 1 };
  }
  const total = count ?? data?.length ?? 0;
  return { decals: normalizeBaseDecalRows(data), total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function loadDecalCategories(): Promise<DecalCategoryRow[]> {
  try {
    const supabase = supabaseAdmin();
    const rows = await Promise.all(
      DECAL_CATEGORY_DEFINITIONS.map(async (category) => {
        const { count, error } = await supabase
          .from("roblox_decal_ids")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .eq("thumbnail_state", "Completed")
          .not("thumbnail_url", "is", null)
          .not("thumbnail_url", "ilike", "%/UnknownImage/%")
          .contains("categories", [category.slug]);
        if (error) {
          reportLoadError(`Failed to load Roblox decal category ${category.slug}`, error);
        }
        return {
          slug: category.slug,
          label: category.label,
          description: category.description,
          count: count ?? 0,
          latestVerifiedAt: null,
          topCuratedScore: null
        };
      })
    );

    return rows.filter((row) => row.count > 0);
  } catch (error) {
    reportLoadError("Failed to load Roblox decal categories", error);
    return [];
  }
}

export async function loadDecalCategoryBySlug(slug: string): Promise<DecalCategoryRow | null> {
  const normalized = normalizeCategorySlug(slug);
  if (!normalized) return null;
  const category = DECAL_CATEGORY_DEFINITIONS.find((entry) => entry.slug === normalized);
  if (!category) return null;
  const categories = await loadDecalCategories();
  return categories.find((entry) => entry.slug === normalized) ?? {
    slug: category.slug,
    label: category.label,
    description: category.description,
    count: 0,
    latestVerifiedAt: null,
    topCuratedScore: null
  };
}

function buildRobloxUrl(assetId: number): string {
  return `https://www.roblox.com/library/${assetId}`;
}

function buildThumbnailUrl(decal: DecalRow): string {
  if (decal.thumbnail_url) return decal.thumbnail_url;
  return `https://www.roblox.com/asset-thumbnail/image?assetId=${decal.asset_id}&width=420&height=420&format=png`;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function DecalCatalogNav({ active }: { active: DecalNavKey }) {
  return (
    <section className="catalog-surface grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Roblox decal ID sections">
      {DECAL_NAV_ITEMS.map((item) => {
        const isActive = item.id === active;
        const cardClasses = `group relative h-full overflow-hidden rounded-lg border px-5 py-4 transition ${isActive
            ? "border-accent/60 bg-accent/10"
            : "border-border/70 bg-surface/80 hover:border-accent/55"
          }`;
        const card = (
          <article className={cardClasses} aria-current={isActive ? "page" : undefined}>
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 h-1 ${isActive ? "bg-accent" : "bg-accent/30 group-hover:bg-accent/60"
                }`}
            />
            <div className="flex h-full flex-col gap-3">
              <p className="text-lg font-semibold text-foreground">{item.title}</p>
              <p className="text-sm text-muted">{item.description}</p>
            </div>
          </article>
        );

        if (isActive) {
          return (
            <div key={item.id} className="h-full" aria-current="page">
              {card}
            </div>
          );
        }

        return (
          <Link key={item.id} href={item.href} className="block h-full">
            {card}
          </Link>
        );
      })}
    </section>
  );
}

export function renderRobloxDecalCategoriesPage({
  categories
}: {
  categories: DecalCategoryRow[];
}) {
  const baseTitle = "Roblox Decal ID Categories";
  const description = "Browse Roblox decal IDs by image style, theme, and common decal search intent.";
  const canonicalPath = buildDecalCategoriesPath();
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const image = `${SITE_URL}/Bloxodes.png`;
  const breadcrumbNavItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox Decal IDs", href: BASE_PATH },
    { label: "Categories", href: null }
  ];
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox Decal IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: "Categories", url: canonicalUrl }
    ])
  );
  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: baseTitle,
      description,
      image,
      author: null
    })
  );

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <DecalBreadcrumb items={breadcrumbNavItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{baseTitle}</h1>
        <p className="max-w-3xl text-base leading-7 text-muted">{description}</p>
      </header>

      <section
        id="article-body"
        itemProp="articleBody"
        className="journey-content-stream journey-content-stream--options"
      >
        <DecalCatalogNav active="categories" />

        {categories.map((category) => (
          <div key={category.slug} data-journey-item className="h-full">
            <a
              href={buildDecalCategoryPath(category.slug)}
              className="block h-full rounded-lg border border-border/70 bg-surface p-5 transition hover:border-accent/60"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold text-foreground">{category.label}</h2>
                <span className="rounded-md border border-border/70 bg-background/60 px-2 py-1 text-xs font-semibold text-muted">
                  {formatCount(category.count)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{category.description}</p>
            </a>
          </div>
        ))}
      </section>

      <MoreCatalogs excludeCode="roblox-decal-ids" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}

export function DecalBreadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return <PageBreadcrumb items={items} className={className} />;
}

export function buildDecalItemListSchema({
  title,
  description,
  url,
  decals,
  total,
  startIndex
}: {
  title: string;
  description: string;
  url: string;
  decals: DecalRow[];
  total: number;
  startIndex: number;
}) {
  const itemListElement = decals.map((decal, index) => {
    const item: Record<string, unknown> = {
      "@type": "ImageObject",
      name: decal.name,
      url: buildRobloxUrl(decal.asset_id),
      contentUrl: buildThumbnailUrl(decal),
      identifier: String(decal.asset_id)
    };
    if (decal.creator_name) {
      item.creator = { "@type": decal.creator_type === "Group" ? "Organization" : "Person", name: decal.creator_name };
    }
    if (decal.description) {
      item.description = decal.description;
    }
    return {
      "@type": "ListItem",
      position: startIndex + index + 1,
      item
    };
  });

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url,
    numberOfItems: total,
    itemListElement
  });
}

export function renderRobloxDecalIdsPage({
  decals,
  total,
  totalPages,
  currentPage,
  showHero,
  contentHtml,
  section = "all",
  category = null,
  pageTitleOverride,
  pageDescription
}: {
  decals: DecalRow[];
  total: number;
  totalPages: number;
  currentPage: number;
  showHero: boolean;
  contentHtml?: CatalogContentHtml | null;
  section?: "all" | "curated" | "category";
  category?: DecalCategoryRow | null;
  pageTitleOverride?: string;
  pageDescription?: string;
}) {
  const latest = decals.reduce<Date | null>((latestDate, decal) => {
    const dateValue = decal.verified_at ?? decal.last_seen_at ?? decal.thumbnail_checked_at;
    if (!dateValue) return latestDate;
    const candidate = new Date(dateValue);
    if (Number.isNaN(candidate.getTime())) return latestDate;
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = formatRelativeDate(latest);
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml?.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const howHtml = contentHtml?.howHtml?.trim() ? contentHtml?.howHtml : "";
  const faqHtml = contentHtml?.faqHtml ?? [];
  const baseTitle = pageTitleOverride ?? (contentHtml?.title?.trim() ? contentHtml.title.trim() : "Roblox Decal IDs");
  const publishedDate = contentHtml?.publishedAt ? new Date(contentHtml.publishedAt) : null;
  const updatedDate = contentHtml?.updatedAt ? new Date(contentHtml.updatedAt) : latest;
  const basePath =
    section === "curated" ? buildDecalCuratedPath() :
      section === "category" && category ? buildDecalCategoryPath(category.slug) :
        BASE_PATH;
  const canonicalPath = currentPage > 1 ? `${basePath}/page/${currentPage}` : basePath;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = currentPage > 1 ? `${baseTitle} - Page ${currentPage}` : baseTitle;
  const description = pageDescription ?? CATALOG_DESCRIPTION;
  const image = `${SITE_URL}/Bloxodes.png`;
  const publishedIso = publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : undefined;
  const updatedIso = updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toISOString() : undefined;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const activeNav: DecalNavKey = section === "curated" ? "curated" : section === "category" ? "categories" : "all";

  const breadcrumbNavItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox Decal IDs", href: section === "all" && currentPage <= 1 ? null : BASE_PATH }
  ];
  if (section === "curated") {
    breadcrumbNavItems.push({ label: "Curated", href: currentPage > 1 ? buildDecalCuratedPath() : null });
  }
  if (section === "category" && category) {
    breadcrumbNavItems.push({ label: "Categories", href: buildDecalCategoriesPath() });
    breadcrumbNavItems.push({ label: category.label, href: currentPage > 1 ? buildDecalCategoryPath(category.slug) : null });
  }
  if (currentPage > 1) {
    breadcrumbNavItems.push({ label: `Page ${currentPage}`, href: null });
  }

  const breadcrumbSchemaItems =
    currentPage > 1
      ? [
        { name: "Home", url: SITE_URL },
        { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
        { name: "Roblox Decal IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
        { name: `Page ${currentPage}`, url: canonicalUrl }
      ]
      : [
        { name: "Home", url: SITE_URL },
        { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
        { name: "Roblox Decal IDs", url: canonicalUrl }
      ];

  const hasDetails = Boolean(descriptionHtml.length) || Boolean(howHtml) || Boolean(faqHtml.length);
  const introNodes = introHtml ? renderPageContentNodes(introHtml, "decal-intro") : null;
  const descriptionNodes = descriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `decal-description-${entry.key}`)
  );
  const howNodes = howHtml ? renderPageContentNodes(howHtml, "decal-how") : null;
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `decal-faq-${idx}`)
  }));

  const listSchema = buildDecalItemListSchema({
    title: pageTitle,
    description,
    url: canonicalUrl,
    decals,
    total,
    startIndex
  });

  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitle,
      description,
      image,
      author: null,
      publishedAt: publishedIso,
      updatedAt: updatedIso
    })
  );
  const breadcrumbSchema = JSON.stringify(breadcrumbJsonLd(breadcrumbSchemaItems));

  return (
    <div className="catalog-surface space-y-10">
      {showHero ? (
        <header className="space-y-4">
          <DecalBreadcrumb items={breadcrumbNavItems} />
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{baseTitle}</h1>
          {pageDescription ? <p className="max-w-3xl text-base leading-7 text-muted">{pageDescription}</p> : null}
          <UpdatedTimestamp value={updatedDate} />
        </header>
      ) : (
        <header className="space-y-2">
          <DecalBreadcrumb items={breadcrumbNavItems} />
          <h1 className="text-3xl font-semibold text-foreground">{baseTitle}</h1>
          <UpdatedTimestamp value={updatedDate} />
          <p className="text-sm text-muted">
            {refreshedLabel ? `Fresh data ${refreshedLabel} · ` : ""}Page {currentPage} of {totalPages}
          </p>
        </header>
      )}

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space journey-content-stream journey-content-stream--decals">
        {introNodes ? introNodes : null}

        {section === "curated" && currentPage === 1 ? (
          <p>
            Curated Roblox decal IDs are a smaller set of previewed images chosen for strong source and community signals. Use them when you want a reliable starting point for posters, signs, paintings, screens, and other custom images without digging through the full decal catalog.
          </p>
        ) : null}

        <DecalCatalogNav active={activeNav} />

        {section === "curated" && currentPage === 1 ? (
          <div className="space-y-3 border-y border-border/60 py-6">
            <h2 className="text-2xl font-semibold leading-snug text-foreground">
              How we choose the best Roblox decal IDs
            </h2>
            <p>
              These curated Roblox decal IDs form a quality-first shortlist rather than another copy of the full catalog. Every entry must be an active Roblox decal with a completed image preview and enough source information to review confidently.
            </p>
            <p>
              Ranking considers trusted curated sources, Roblox community votes, favorites, source coverage, creator information, and useful metadata. Cards show their current rank and the strongest available reason for their selection.
            </p>
          </div>
        ) : null}

        <DecalIdsBrowser
          initialDecals={decals}
          initialTotalPages={totalPages}
          currentPage={currentPage}
          basePath={basePath}
          section={section}
          category={category?.slug ?? null}
        />

        {section === "curated" && currentPage === 1 ? (
          <div className="space-y-8 border-t border-border/60 pt-8">
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold leading-snug text-foreground">
                How to use a curated Roblox decal ID
              </h2>
              <p>
                Open the image preview first and make sure it matches what you want. Copy the numeric Decal ID, then paste it into a Roblox experience or Studio property that accepts decal assets. Common uses include signs, posters, paintings, screens, clothing templates, and custom build details.
              </p>
              <p>
                Games do not all use the same kind of number. Some accept the public Decal ID, while others ask for the underlying image or texture ID. The game-specific decal sections use the ID format required by that feature when a separate texture ID is available.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-semibold leading-snug text-foreground">
                Why a Roblox decal ID may not work
              </h2>
              <p>
                A decal can stop loading if Roblox moderates the asset, changes its privacy, or removes its image. The game may also block custom images or expect a texture ID instead of the Decal ID you copied. Check the preview, copy only the digits, and confirm which ID type the game asks for before trying another image.
              </p>
            </section>

            <ContentFaq
              title="Curated Roblox Decal IDs FAQ"
              items={[
                {
                  id: "curated-meaning",
                  question: "What makes a Roblox decal ID curated?",
                  answer: <p>Curated entries pass the normal active-asset and preview checks, then rank strongly using source quality, community signals, creator information, and useful metadata.</p>
                },
                {
                  id: "curated-safe",
                  question: "Are curated decal IDs guaranteed to stay available?",
                  answer: <p>No. Curation confirms the strongest information available when the list is refreshed. Roblox can still moderate, privatize, or remove an asset later.</p>
                },
                {
                  id: "decal-texture-difference",
                  question: "What is the difference between a Decal ID and an image ID?",
                  answer: <p>The Decal ID identifies the public Roblox decal asset. The image or texture ID identifies the underlying uploaded image. A game can require either one, so use the format named by its input.</p>
                }
              ]}
            />
          </div>
        ) : null}

        {showHero && hasDetails ? (
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
      <MoreCatalogs excludeCode="roblox-decal-ids" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
