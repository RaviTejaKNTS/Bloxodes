import Link from "next/link";
import { Suspense } from "react";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { MoreCatalogs } from "@/components/more-content";
import { PagePagination } from "@/components/PagePagination";
import { RobloxCatalogItemCard } from "@/components/RobloxCatalogItemCard";
import type { CatalogPageContent } from "@/lib/catalog";
import { getFreeItemCategories, getFreeItemSubcategories, listFreeItems, type FreeItem } from "@/lib/db";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  buildSearchQueryString,
  normalizeSearchQuery,
  normalizeSortKey,
  type FreeItemsSortKey
} from "@/lib/free-items-search";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { buildPageContentHtml, renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import { PageBreadcrumb, type PageBreadcrumbItem } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { FreeItemsBrowser } from "./FreeItemsBrowser";

const PAGE_SIZE = 24;

export const FREE_ITEMS_CATALOG_CODE = "free-roblox-items";
export const LEGACY_FREE_ITEMS_CATALOG_CODE = "roblox-free-items";
export const FREE_ITEMS_CATALOG_CODES = [FREE_ITEMS_CATALOG_CODE, LEGACY_FREE_ITEMS_CATALOG_CODE] as const;
export const BASE_PATH = `/catalog/${FREE_ITEMS_CATALOG_CODE}`;
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;

export function buildFreeItemCatalogCodeCandidates(...segments: string[]): string[] {
  const normalizedSegments = segments.map((segment) => segment.trim()).filter(Boolean);
  return FREE_ITEMS_CATALOG_CODES.map((code) =>
    normalizedSegments.length ? `${code}/${normalizedSegments.join("/")}` : code
  );
}

export function buildFreeItemCategoryPath(categorySlug: string, subcategorySlug?: string): string {
  return subcategorySlug ? `${BASE_PATH}/${categorySlug}/${subcategorySlug}` : `${BASE_PATH}/${categorySlug}`;
}

export type CatalogContentHtml = PageContentHtml;

type PageData = {
  items: FreeItem[];
  total: number;
  totalPages: number;
};

export type CategoryOption = {
  slug: string;
  label: string;
  count: number;
};

export type SubcategoryOption = {
  slug: string;
  label: string;
  count: number;
};

export type BreadcrumbItem = PageBreadcrumbItem;

type FreeItemsPageFilters = {
  category?: string;
  subcategory?: string;
  search?: string;
  sort?: "featured" | "newest" | "popular" | "updated";
};

export type SearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

export type FreeItemsResolvedSearch = {
  search: string;
  sort: FreeItemsSortKey;
};

function firstSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function resolveFreeItemsSearch(searchParams: SearchParamsInput): Promise<FreeItemsResolvedSearch> {
  const params = searchParams ? await searchParams : {};
  return {
    search: normalizeSearchQuery(firstSearchParam(params.q)),
    sort: normalizeSortKey(firstSearchParam(params.sort))
  };
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value: string): string {
  const normalized = normalizeKey(value);
  return normalized.replace(/\s+/g, "-");
}

function buildRobloxUrl(item: Pick<FreeItem, "asset_id" | "item_type" | "roblox_url">): string {
  if (item.roblox_url) {
    return item.roblox_url;
  }

  if (item.item_type === "Bundle") {
    return `https://www.roblox.com/bundles/${Math.abs(Math.trunc(item.asset_id))}`;
  }

  return `https://www.roblox.com/catalog/${item.asset_id}`;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatItemCount(value: number): string {
  return `${formatCount(value)} ${value === 1 ? "item" : "items"}`;
}

function formatTaxonomyLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

export function appendItemCountToSeoTitle(title: string, count: number): string {
  return `${title} (${formatCount(count)} items)`;
}

export function resolveFreeItemsDescription(
  description: string | null | undefined,
  fallback: string
): string {
  const trimmed = description?.trim();
  if (!trimmed) {
    return fallback;
  }

  if (/^draft page for\b/i.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

export async function buildFreeItemsCatalogContentHtml(
  catalog: CatalogPageContent | null
): Promise<CatalogContentHtml | null> {
  return buildPageContentHtml(catalog);
}

export async function loadFreeItemsPageData(
  page: number,
  filters: FreeItemsPageFilters = {}
): Promise<PageData> {
  try {
    const { items, total } = await listFreeItems(page, PAGE_SIZE, filters);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return { items, total, totalPages };
  } catch (error) {
    console.error("Failed to load free items page data", error);
    return { items: [], total: 0, totalPages: 1 };
  }
}

export async function loadFreeItemCategories(): Promise<CategoryOption[]> {
  try {
    const categories = await getFreeItemCategories();
    return categories.map((entry) => ({
      slug: slugify(entry.category),
      label: entry.category,
      count: entry.count
    }));
  } catch (error) {
    console.error("Failed to load free item categories", error);
    return [];
  }
}

export async function loadFreeItemCategoryBySlug(slug: string): Promise<CategoryOption | null> {
  const categories = await loadFreeItemCategories();
  return categories.find((entry) => entry.slug === slug) ?? null;
}

export async function loadFreeItemSubcategories(category: string): Promise<SubcategoryOption[]> {
  if (!category) return [];
  try {
    const subcategories = await getFreeItemSubcategories(category);
    return subcategories.map((entry) => ({
      slug: slugify(entry.subcategory),
      label: entry.subcategory,
      count: entry.count
    }));
  } catch (error) {
    console.error("Failed to load free item subcategories", error);
    return [];
  }
}

export async function loadFreeItemSubcategoryBySlug(
  category: string,
  slug: string
): Promise<SubcategoryOption | null> {
  const subcategories = await loadFreeItemSubcategories(category);
  return subcategories.find((entry) => entry.slug === slug) ?? null;
}

export function FreeItemsNav({ active, categories }: { active: string; categories: CategoryOption[] }) {
  const navItems = [
    {
      id: "all",
      title: "All Free Items",
      description: "All directly claimable items.",
      href: BASE_PATH,
      count: null
    },
    ...categories.map((category) => ({
      id: category.slug,
      title: formatTaxonomyLabel(category.label),
      description: formatItemCount(category.count),
      href: buildFreeItemCategoryPath(category.slug),
      count: category.count
    }))
  ];

  return (
    <section className="catalog-surface grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {navItems.map((item) => {
        const isActive = item.id === active;
        const cardClasses = `group relative overflow-hidden rounded-lg border px-5 py-4 transition ${
          isActive
            ? "border-accent/60 bg-accent/10"
            : "border-border/70 bg-surface/80 hover:border-accent/55"
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
                <p className="text-lg font-semibold text-foreground">{item.title}</p>
                {isActive ? (
                  <span className="rounded-md bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Active
                  </span>
                ) : null}
              </div>
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

export function FreeItemsBreadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return <PageBreadcrumb items={items} className={className} />;
}

export function buildFreeItemsItemListSchema({
  title,
  description,
  url,
  items,
  total,
  startIndex
}: {
  title: string;
  description: string;
  url: string;
  items: FreeItem[];
  total: number;
  startIndex: number;
}) {
  const itemListElement = items.map((item, index) => {
    const schemaItem: {
      "@type": "Thing";
      name: string;
      url: string;
      image?: string;
    } = {
      "@type": "Thing",
      name: item.name ?? `Roblox item ${item.asset_id}`,
      url: buildRobloxUrl(item)
    };

    if (item.thumbnail_url) {
      schemaItem.image = item.thumbnail_url;
    }

    return {
      "@type": "ListItem",
      position: startIndex + index + 1,
      item: schemaItem
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

export function buildSimpleItemListSchema({
  title,
  description,
  url,
  items,
  itemType = "Thing"
}: {
  title: string;
  description: string;
  url: string;
  items: Array<{ name: string; url: string }>;
  itemType?: string;
}) {
  const itemListElement = items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": itemType,
      name: item.name,
      url: item.url
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

export function buildCategoryCards(categories: CategoryOption[]) {
  if (!categories.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No categories are available yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={buildFreeItemCategoryPath(category.slug)}
          className="group block h-full"
        >
          <article className="relative h-full overflow-hidden rounded-lg border border-border/70 bg-surface p-5 transition hover:border-accent/55">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.3),transparent_55%)]"
            />
            <div className="relative space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted">Category</div>
              <h2 className="text-xl font-semibold text-foreground">{formatTaxonomyLabel(category.label)}</h2>
              <div className="flex items-center justify-between text-sm text-muted">
                <span>{formatItemCount(category.count)}</span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">Explore</span>
              </div>
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}

function FreeItemsFilterForm({
  basePath,
  search,
  sort
}: {
  basePath: string;
  search: string;
  sort: FreeItemsSortKey;
}) {
  const hasFilters = search.length > 0 || sort !== DEFAULT_SORT;

  return (
    <form action={basePath} method="get" className="flex flex-col gap-4 md:flex-row md:items-end">
      <div className="flex-1 space-y-2">
        <label htmlFor="free-items-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Search
        </label>
        <input
          id="free-items-search"
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Search item name, creator, or ID"
          className="w-full rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      <div className="w-full space-y-2 md:w-56">
        <label htmlFor="free-items-sort" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Sort
        </label>
        <select
          id="free-items-sort"
          name="sort"
          defaultValue={sort}
          className="w-full rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
        >
          Apply
        </button>
        {hasFilters ? (
          <Link href={basePath} className="text-sm font-semibold text-muted transition hover:text-accent">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function FreeItemsGrid({ items }: { items: FreeItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
        No free items match those filters right now.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <RobloxCatalogItemCard key={item.asset_id} item={item} categoryLabelMode="taxonomy" />
      ))}
    </div>
  );
}

export async function renderRobloxFreeItemsPage({
  items,
  total,
  totalPages,
  currentPage,
  showHero,
  contentHtml,
  pageTitle,
  description,
  breadcrumbItems,
  basePath = BASE_PATH,
  navActive,
  categorySlug,
  categoryLabel,
  subcategories,
  activeSubcategorySlug,
  search = "",
  sort = DEFAULT_SORT
}: {
  items: FreeItem[];
  total: number;
  totalPages: number;
  currentPage: number;
  showHero: boolean;
  contentHtml?: CatalogContentHtml | null;
  pageTitle: string;
  description: string;
  breadcrumbItems: BreadcrumbItem[];
  basePath?: string;
  navActive?: string;
  categorySlug?: string;
  categoryLabel?: string;
  subcategories?: SubcategoryOption[];
  activeSubcategorySlug?: string;
  search?: string;
  sort?: FreeItemsSortKey;
}) {
  const navCategories = await loadFreeItemCategories();
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const howHtml = contentHtml?.howHtml?.trim() ? contentHtml.howHtml : "";
  const faqHtml = contentHtml?.faqHtml ?? [];
  const publishedDate = contentHtml?.publishedAt ? new Date(contentHtml.publishedAt) : null;
  const updatedDate = contentHtml?.updatedAt ? new Date(contentHtml.updatedAt) : null;
  const canonicalPath = currentPage > 1 ? `${basePath}/page/${currentPage}` : basePath;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const publishedIso = publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : null;
  const updatedIso = updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toISOString() : null;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const searchQueryString = buildSearchQueryString({ query: search, sort });
  const hasDetails =
    Boolean(descriptionHtml.length) || Boolean(howHtml) || Boolean(faqHtml.length);
  const listSchema = buildFreeItemsItemListSchema({
    title: pageTitle,
    description,
    url: canonicalUrl,
    items,
    total,
    startIndex
  });
  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitle,
      description,
      image: `${SITE_URL}/og-image.png`,
      author: null,
      publishedAt: publishedIso,
      updatedAt: updatedIso
    })
  );
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd(
      breadcrumbItems.map((item) => ({
        name: item.label,
        url: item.href ? `${SITE_URL.replace(/\/$/, "")}${item.href}` : canonicalUrl
      }))
    )
  );
  const introNodes = introHtml ? renderPageContentNodes(introHtml, "free-items-intro") : null;
  const descriptionNodes = descriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `free-items-description-${entry.key}`)
  );
  const howNodes = howHtml ? renderPageContentNodes(howHtml, "free-items-how") : null;
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `free-items-faq-${idx}`)
  }));

  return (
    <div className="catalog-surface space-y-10">
      {showHero ? (
        <header className="space-y-4">
          <FreeItemsBreadcrumb items={breadcrumbItems} />
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{pageTitle}</h1>
          <UpdatedTimestamp value={updatedDate} />
        </header>
      ) : (
        <header className="space-y-2">
          <FreeItemsBreadcrumb items={breadcrumbItems} />
          <h1 className="text-3xl font-semibold text-foreground">{pageTitle}</h1>
          <p className="text-sm text-muted">
            Page {currentPage} of {totalPages}
          </p>
        </header>
      )}

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes && showHero ? introNodes : null}

        <CatalogAdSlot />

        <FreeItemsNav active={navActive ?? categorySlug ?? "all"} categories={navCategories} />

        {subcategories?.length && categorySlug ? (
          <section className="flex flex-wrap gap-2">
            <Link
              href={buildFreeItemCategoryPath(categorySlug)}
              className={`rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                activeSubcategorySlug
                  ? "border-border/70 bg-background/70 text-muted hover:border-accent/70 hover:text-accent"
                  : "border-accent/70 bg-accent/10 text-accent"
              }`}
            >
              {categoryLabel ? `All ${categoryLabel}` : "All"}
            </Link>
            {subcategories.map((subcategory) => {
              const isActive = subcategory.slug === activeSubcategorySlug;
              return (
                <Link
                  key={subcategory.slug}
                  href={buildFreeItemCategoryPath(categorySlug, subcategory.slug)}
                  className={`rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    isActive
                      ? "border-accent/70 bg-accent/10 text-accent"
                      : "border-border/70 bg-background/70 text-muted hover:border-accent/70 hover:text-accent"
                  }`}
                >
                  {subcategory.label}
                </Link>
              );
            })}
          </section>
        ) : null}

        <Suspense
          fallback={
            <div className="catalog-surface space-y-6">
              <FreeItemsFilterForm basePath={basePath} search={search} sort={sort} />
              <FreeItemsGrid items={items} />
              <PagePagination
                basePath={basePath}
                currentPage={currentPage}
                totalPages={totalPages}
                query={searchQueryString || undefined}
              />
            </div>
          }
        >
          <FreeItemsBrowser
            initialItems={items}
            initialTotalPages={totalPages}
            currentPage={currentPage}
            basePath={basePath}
            category={categoryLabel}
            subcategory={
              activeSubcategorySlug
                ? subcategories?.find((entry) => entry.slug === activeSubcategorySlug)?.label
                : undefined
            }
          />
        </Suspense>

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
      <MoreCatalogs excludeCode={FREE_ITEMS_CATALOG_CODE} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}

export { buildRobloxUrl };
