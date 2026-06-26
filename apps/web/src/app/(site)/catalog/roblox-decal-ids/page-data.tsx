import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { MoreCatalogs } from "@/components/more-content";
import { PageBreadcrumb, type PageBreadcrumbItem } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import type { CatalogPageContent } from "@/lib/catalog";
import { formatRelativeDate } from "@/lib/content-dates";
import {
  DEFAULT_SORT,
  buildSearchQueryString,
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

const PAGE_SIZE = 24;
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";
const DECAL_SOURCE_TABLE = "roblox_decal_ids";
const DECAL_SOURCE_VIEW = "roblox_decal_ids_ranked_view";
const BASE_SELECT_FIELDS =
  "asset_id, texture_id, name, description, creator_id, creator_type, creator_name, creator_verified, roblox_created_at, roblox_updated_at, is_public_domain, is_for_sale, price_in_robux, sales, purchasable, vote_count, upvote_percent, thumbnail_url, thumbnail_state, thumbnail_checked_at, source, first_seen_at, last_seen_at, verified_at, popularity_score, categories, primary_category, curated_score, curated_rank, curated_tier, curated_reason";
const VIEW_SELECT_FIELDS =
  "asset_id, texture_id, name, description, creator_id, creator_type, creator_name, creator_verified, roblox_created_at, roblox_updated_at, is_public_domain, is_for_sale, price_in_robux, sales, purchasable, vote_count, upvote_percent, thumbnail_url, thumbnail_state, thumbnail_checked_at, source, first_seen_at, last_seen_at, verified_at, popularity_score, categories, primary_category, curated_score, curated_rank, curated_tier, curated_reason, thumbnail_ready, age_bucket, source_count";

export const BASE_PATH = "/catalog/roblox-decal-ids";
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;
export const DECAL_SEO_TITLE = "Roblox Decal IDs [24K+ Image Codes]";

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

export type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

export type DecalResolvedSearch = {
  search: string;
  sort: DecalSortKey;
};

export type BreadcrumbItem = PageBreadcrumbItem;

type OrderableQuery<T> = {
  order: (...args: any[]) => T;
};

type DecalListOptions = {
  category?: string | null;
  curated?: boolean;
};

export async function buildRobloxDecalCatalogContentHtml(
  catalog: CatalogPageContent | null
): Promise<CatalogContentHtml | null> {
  return buildPageContentHtml(catalog);
}

function firstSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function resolveDecalSearch(searchParams: SearchParamsInput): Promise<DecalResolvedSearch> {
  const params = searchParams ? await searchParams : {};
  return {
    search: normalizeSearchQuery(firstSearchParam(params.q)),
    sort: normalizeSortKey(firstSearchParam(params.sort))
  };
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
    case "sources_desc":
      return query
        .order("source_count", { ascending: false, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false });
    case "recommended":
    default:
      return query
        .order("curated_score", { ascending: false, nullsFirst: false })
        .order("popularity_score", { ascending: false, nullsFirst: false })
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .order("verified_at", { ascending: false, nullsFirst: false });
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
  const usesRankedView = search.sort === "sources_desc";
  let query = usesRankedView
    ? supabase.from(DECAL_SOURCE_VIEW).select(VIEW_SELECT_FIELDS, { count: "exact" })
    : supabase.from(DECAL_SOURCE_TABLE).select(BASE_SELECT_FIELDS, { count: "exact" });

  if (usesRankedView) {
    query = query.eq("thumbnail_ready", true);
  } else {
    query = query
      .eq("status", "active")
      .eq("thumbnail_state", "Completed")
      .not("thumbnail_url", "is", null);
  }

  if (options.curated) {
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

  return { decals: usesRankedView ? ((data ?? []) as DecalRow[]) : normalizeBaseDecalRows(data), total, totalPages };
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

function DecalSectionNav({ active }: { active: "all" | "curated" | "categories" }) {
  const items = [
    { id: "all", label: "All", href: BASE_PATH },
    { id: "curated", label: "Curated", href: buildDecalCuratedPath() },
    { id: "categories", label: "Categories", href: buildDecalCategoriesPath() }
  ] as const;

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Roblox decal ID sections">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <a
            key={item.id}
            href={item.href}
            className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
              isActive
                ? "border-accent bg-accent text-white"
                : "border-border/70 bg-surface text-muted hover:border-accent/60 hover:text-foreground"
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

export function renderRobloxDecalCategoriesPage({
  categories,
  contentHtml
}: {
  categories: DecalCategoryRow[];
  contentHtml?: CatalogContentHtml | null;
}) {
  const baseTitle = "Roblox Decal ID Categories";
  const description = "Browse Roblox decal IDs by image style, theme, and common decal search intent.";
  const canonicalPath = buildDecalCategoriesPath();
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const image = `${SITE_URL}/og-image.png`;
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
        <DecalSectionNav active="categories" />
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <a
            key={category.slug}
            href={buildDecalCategoryPath(category.slug)}
            className="rounded-lg border border-border/70 bg-surface p-5 transition hover:border-accent/60"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold text-foreground">{category.label}</h2>
              <span className="rounded-md border border-border/70 bg-background/60 px-2 py-1 text-xs font-semibold text-muted">
                {formatCount(category.count)}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{category.description}</p>
          </a>
        ))}
      </section>

      {contentHtml?.id ? (
        <div className="mt-10">
          <CommentsSection entityType="catalog" entityId={contentHtml.id} />
        </div>
      ) : null}
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
  search = "",
  sort = DEFAULT_SORT,
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
  search?: string;
  sort?: DecalSortKey;
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
  const updatedDate = contentHtml?.updatedAt ? new Date(contentHtml.updatedAt) : latest;
  const basePath =
    section === "curated" ? buildDecalCuratedPath() :
      section === "category" && category ? buildDecalCategoryPath(category.slug) :
        BASE_PATH;
  const canonicalPath = currentPage > 1 ? `${basePath}/page/${currentPage}` : basePath;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = currentPage > 1 ? `${baseTitle} - Page ${currentPage}` : baseTitle;
  const description = pageDescription ?? CATALOG_DESCRIPTION;
  const image = `${SITE_URL}/og-image.png`;
  const updatedIso = updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toISOString() : undefined;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const searchQueryString = buildSearchQueryString({ query: search, sort });

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
      publishedAt: updatedIso,
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
          <DecalSectionNav active={section === "curated" ? "curated" : section === "category" ? "categories" : "all"} />
        </header>
      ) : (
        <header className="space-y-2">
          <DecalBreadcrumb items={breadcrumbNavItems} />
          <h1 className="text-3xl font-semibold text-foreground">{baseTitle}</h1>
          <UpdatedTimestamp value={updatedDate} />
          <p className="text-sm text-muted">
            {refreshedLabel ? `Fresh data ${refreshedLabel} · ` : ""}Page {currentPage} of {totalPages}
          </p>
          <DecalSectionNav active={section === "curated" ? "curated" : section === "category" ? "categories" : "all"} />
        </header>
      )}

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes ? introNodes : null}

        <CatalogAdSlot />

        <DecalIdsBrowser
          initialDecals={decals}
          initialTotalPages={totalPages}
          currentPage={currentPage}
          basePath={basePath}
          section={section}
          category={category?.slug ?? null}
        />

        <CatalogAdSlot />

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
