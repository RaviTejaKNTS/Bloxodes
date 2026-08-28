import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { MoreCatalogs } from "@/components/more-content";
import { ContentFaq } from "@/components/ContentFaq";
import { PageBreadcrumb, type PageBreadcrumbItem } from "@/components/PageBreadcrumb";
import { PagePagination } from "@/components/PagePagination";
import { RobloxCatalogItemCard } from "@/components/RobloxCatalogItemCard";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import type { CatalogPageContent } from "@/lib/catalog";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { buildPageContentHtml, renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import {
  AVATAR_CATALOG_MASTER_CODE,
  AVATAR_CATALOG_MASTER_TITLE,
  AVATAR_CATALOG_CREATOR_OPTIONS,
  AVATAR_CATALOG_PAGE_SIZE,
  AVATAR_CATALOG_SALE_OPTIONS,
  AVATAR_CATALOG_SORT_OPTIONS,
  buildAvatarCatalogQueryString,
  getAvatarCatalogPageHeading,
  getAvatarCatalogSeoDescription,
  getAvatarCatalogSeoTitle,
  getAvatarCatalogCount,
  listAvatarCatalogItems,
  normalizeAvatarCatalogCreator,
  normalizeAvatarCatalogSale,
  normalizeAvatarCatalogSearch,
  normalizeAvatarCatalogSort,
  resolveAvatarCatalogConfig,
  resolveAvatarCatalogTopLevelConfig,
  type AvatarCatalogChild,
  type AvatarCatalogConfig,
  type AvatarCatalogItem,
  type AvatarCatalogResolvedSearch
} from "@/lib/roblox-avatar-catalog";
import { breadcrumbJsonLd, buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL, webPageJsonLd } from "@/lib/seo";

export type AvatarCatalogSearchParamsInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

export type AvatarCatalogRouteState = {
  config: AvatarCatalogConfig;
  topLevelConfig: AvatarCatalogConfig;
  page: number;
};

type AvatarCatalogPageData = {
  items: AvatarCatalogItem[];
  total: number;
  totalPages: number;
};

export type CatalogContentHtml = PageContentHtml;

function firstSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function buildCompactNavTitle(title: string, isAll: boolean): string {
  if (isAll) return "All";
  return title.replace(/^Roblox\s+/i, "");
}

function hasActiveAvatarFilters(filters: AvatarCatalogResolvedSearch): boolean {
  return (
    filters.search.length > 0 ||
    filters.sort !== "featured" ||
    filters.sale !== "all" ||
    filters.creator !== "all"
  );
}

function buildChildHref(parent: AvatarCatalogConfig, child: AvatarCatalogChild): string {
  const topLevel = resolveAvatarCatalogTopLevelConfig(child.code);
  if (parent.code === AVATAR_CATALOG_MASTER_CODE && topLevel) {
    return topLevel.basePath;
  }
  return `${parent.basePath}/${child.slug}`;
}

function buildAllNavTitle(parent: AvatarCatalogConfig): string {
  if (parent.code === AVATAR_CATALOG_MASTER_CODE) return "All Items and Bundles";
  return `All ${parent.title}`;
}

function resolveAvatarCatalogPrimaryNavParent(route: AvatarCatalogRouteState): AvatarCatalogConfig {
  return resolveAvatarCatalogTopLevelConfig(AVATAR_CATALOG_MASTER_CODE) ?? route.topLevelConfig;
}

function resolveAvatarCatalogPrimaryActiveCode(route: AvatarCatalogRouteState): string {
  if (route.config.code === AVATAR_CATALOG_MASTER_CODE) return AVATAR_CATALOG_MASTER_CODE;
  if (route.topLevelConfig.parentCode === AVATAR_CATALOG_MASTER_CODE) return route.topLevelConfig.code;
  return route.config.code;
}

function resolveAvatarCatalogSecondaryNavParent(route: AvatarCatalogRouteState): AvatarCatalogConfig | null {
  if (route.config.code === AVATAR_CATALOG_MASTER_CODE) return null;
  if (route.topLevelConfig.parentCode !== AVATAR_CATALOG_MASTER_CODE) return null;
  if (!route.topLevelConfig.children?.length) return null;
  return route.topLevelConfig;
}

function buildAvatarCatalogBreadcrumbItems(route: AvatarCatalogRouteState, pageTitle: string): PageBreadcrumbItem[] {
  const items: PageBreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" }
  ];

  if (
    route.config.code !== AVATAR_CATALOG_MASTER_CODE &&
    (route.config.parentCode === AVATAR_CATALOG_MASTER_CODE ||
      route.topLevelConfig.parentCode === AVATAR_CATALOG_MASTER_CODE)
  ) {
    const master = resolveAvatarCatalogTopLevelConfig(AVATAR_CATALOG_MASTER_CODE);
    items.push({
      label: master?.title ?? AVATAR_CATALOG_MASTER_TITLE,
      href: master?.basePath ?? "/catalog/roblox-items-and-bundles"
    });
  }

  if (
    route.config.parentCode &&
    route.config.parentTitle &&
    route.config.parentCode !== AVATAR_CATALOG_MASTER_CODE
  ) {
    items.push({ label: route.config.parentTitle, href: route.topLevelConfig.basePath });
  }

  items.push({ label: pageTitle, href: null });
  return items;
}

function parsePositivePage(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const page = Number(value);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : null;
}

export function resolveAvatarCatalogRoute(prefix: string, segments: string[] = []): AvatarCatalogRouteState | null {
  const topLevelConfig = resolveAvatarCatalogTopLevelConfig(prefix);
  if (!topLevelConfig) return null;

  if (topLevelConfig.code === AVATAR_CATALOG_MASTER_CODE && segments.length > 0) {
    const [familySlug, ...familySegments] = segments;
    const familyConfig = resolveAvatarCatalogTopLevelConfig(familySlug);
    if (familyConfig?.parentCode === AVATAR_CATALOG_MASTER_CODE) {
      return resolveAvatarCatalogRoute(familyConfig.code, familySegments);
    }
  }

  if (!segments.length) {
    return { config: topLevelConfig, topLevelConfig, page: 1 };
  }

  if (segments.length === 2 && segments[0] === "page") {
    const page = parsePositivePage(segments[1]);
    return page ? { config: topLevelConfig, topLevelConfig, page } : null;
  }

  const [childSlug, maybePage, maybePageNumber] = segments;
  const childConfig = resolveAvatarCatalogConfig(prefix, childSlug);
  if (!childConfig) return null;

  if (segments.length === 1) {
    return { config: childConfig, topLevelConfig, page: 1 };
  }

  if (segments.length === 3 && maybePage === "page") {
    const page = parsePositivePage(maybePageNumber);
    return page ? { config: childConfig, topLevelConfig, page } : null;
  }

  return null;
}

export async function resolveAvatarCatalogSearch(
  searchParams: AvatarCatalogSearchParamsInput
): Promise<AvatarCatalogResolvedSearch> {
  const params = searchParams ? await searchParams : {};
  return {
    search: normalizeAvatarCatalogSearch(firstSearchParam(params.q)),
    sort: normalizeAvatarCatalogSort(firstSearchParam(params.sort)),
    sale: normalizeAvatarCatalogSale(firstSearchParam(params.sale)),
    creator: normalizeAvatarCatalogCreator(firstSearchParam(params.creator))
  };
}

export async function buildAvatarCatalogContentHtml(
  catalog: CatalogPageContent | null
): Promise<CatalogContentHtml | null> {
  return buildPageContentHtml(catalog);
}

export async function loadAvatarCatalogPageData(
  config: AvatarCatalogConfig,
  page: number,
  filters: AvatarCatalogResolvedSearch
): Promise<AvatarCatalogPageData> {
  try {
    const { items, total } = await listAvatarCatalogItems(config, page, AVATAR_CATALOG_PAGE_SIZE, filters);
    const totalPages = Math.max(1, Math.ceil(total / AVATAR_CATALOG_PAGE_SIZE));
    return { items, total, totalPages };
  } catch (error) {
    console.error("Failed to load avatar catalog page data", error);
    return { items: [], total: 0, totalPages: 1 };
  }
}

async function loadAvatarCatalogNavCounts(parent: AvatarCatalogConfig): Promise<Map<string, number>> {
  const navTargets: Array<Pick<AvatarCatalogConfig, "code" | "scope">> = [
    { code: parent.code, scope: parent.scope },
    ...(parent.children ?? []).map((child) => ({ code: child.code, scope: child.scope }))
  ];
  if (!navTargets.length) return new Map();

  const entries = await Promise.all(
    navTargets.map(async (target) => {
      try {
        return [target.code, await getAvatarCatalogCount({ code: target.code, scope: target.scope })] as const;
      } catch (error) {
        console.error(`Failed to load avatar catalog count for ${target.code}`, error);
        return [target.code, 0] as const;
      }
    })
  );
  return new Map(entries);
}

function buildAvatarCatalogItemListSchema({
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
  items: AvatarCatalogItem[];
  total: number;
  startIndex: number;
}) {
  const itemListElement = items.map((item, index) => {
    const schemaItem: {
      "@type": "Thing";
      name: string;
      url: string;
      image?: string;
      identifier: {
        "@type": "PropertyValue";
        propertyID: string;
        value: number;
      };
    } = {
      "@type": "Thing",
      name: item.name ?? `Roblox item ${item.asset_id}`,
      url: item.roblox_url,
      identifier: {
        "@type": "PropertyValue",
        propertyID: item.item_type === "Bundle" ? "Roblox Bundle ID" : "Roblox Item ID",
        value: item.item_type === "Bundle" ? Math.abs(Math.trunc(item.asset_id)) : Math.trunc(item.asset_id)
      }
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

function AvatarCatalogNav({
  parent,
  activeCode,
  navCounts
}: {
  parent: AvatarCatalogConfig;
  activeCode: string;
  navCounts: Map<string, number>;
}) {
  const children = parent.children ?? [];
  if (!children.length) return null;
  const navItems = [
    {
      code: parent.code,
      title: buildAllNavTitle(parent),
      href: parent.basePath
    },
    ...children.map((child) => ({
      code: child.code,
      title: child.title,
      href: buildChildHref(parent, child)
    }))
  ];

  return (
    <nav aria-label="Items and bundles categories" className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max gap-2">
        {navItems.map((item) => {
          const isActive = item.code === activeCode;
          const count = navCounts.get(item.code) ?? 0;
          const label = buildCompactNavTitle(item.title, item.code === parent.code);
          const classes = `inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition ${
            isActive
              ? "border-accent/60 bg-accent/10 text-foreground"
              : "border-border/70 bg-surface/60 text-muted hover:border-accent/55 hover:text-foreground"
          }`;
          const content = (
            <>
              <span>{label}</span>
              <span className="text-xs tabular-nums text-muted">{formatCompactCount(count)}</span>
            </>
          );

          if (isActive) {
            return (
              <span key={item.code} className={classes} aria-current="page" aria-label={`${item.title}, ${formatCount(count)} items`}>
                {content}
              </span>
            );
          }

          return (
            <Link key={item.code} href={item.href} className={classes} aria-label={`${item.title}, ${formatCount(count)} items`}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function AvatarCatalogSubnav({
  parent,
  activeCode
}: {
  parent: AvatarCatalogConfig | null;
  activeCode: string;
}) {
  const children = parent?.children ?? [];
  if (!parent || !children.length) return null;

  const navItems = [
    {
      code: parent.code,
      title: buildAllNavTitle(parent),
      href: parent.basePath
    },
    ...children.map((child) => ({
      code: child.code,
      title: child.title,
      href: buildChildHref(parent, child)
    }))
  ];

  return (
    <nav aria-label={`${parent.title} categories`} className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max gap-2">
        {navItems.map((item) => {
          const isActive = item.code === activeCode;
          const label = buildCompactNavTitle(item.title, item.code === parent.code);
          return (
            <Link
              key={item.code}
              href={item.href}
              className={`inline-flex h-9 items-center whitespace-nowrap rounded-md border px-3 text-sm font-medium transition ${
                isActive
                  ? "border-accent/60 bg-accent/10 text-foreground"
                  : "border-border/70 bg-background/60 text-muted hover:border-accent/55 hover:text-foreground"
              }`}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.title}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function AvatarCatalogFilterForm({
  basePath,
  filters
}: {
  basePath: string;
  filters: AvatarCatalogResolvedSearch;
}) {
  const hasFilters = hasActiveAvatarFilters(filters);
  const advancedFilterCount = Number(filters.sale !== "all") + Number(filters.creator !== "all");

  return (
    <form action={basePath} method="get" className="flex flex-col gap-3 md:flex-row md:items-end">
      <div className="min-w-0 flex-1 space-y-2">
        <label htmlFor="avatar-catalog-search" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Search
        </label>
        <input
          id="avatar-catalog-search"
          name="q"
          type="search"
          defaultValue={filters.search}
          placeholder="Search name, creator, or Roblox ID"
          className="w-full rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      <div className="w-full space-y-2 md:w-52">
        <label htmlFor="avatar-catalog-sort" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Sort
        </label>
        <select
          id="avatar-catalog-sort"
          name="sort"
          defaultValue={filters.sort}
          className="w-full rounded-md border border-border/60 bg-surface/60 px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          {AVATAR_CATALOG_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <details className="group relative md:self-end">
        <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-border/70 bg-surface/60 px-3 text-sm font-medium text-foreground transition hover:border-accent/55 marker:hidden">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted" aria-hidden />
            Filters
            {advancedFilterCount ? (
              <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent">
                {advancedFilterCount}
              </span>
            ) : null}
          </span>
          <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="z-20 mt-2 grid gap-3 rounded-md border border-border/80 bg-popover p-3 text-popover-foreground shadow-xl md:absolute md:right-0 md:w-72">
          <div className="space-y-2">
            <label htmlFor="avatar-catalog-sale" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Sale
            </label>
            <select
              id="avatar-catalog-sale"
              name="sale"
              defaultValue={filters.sale}
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {AVATAR_CATALOG_SALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="avatar-catalog-creator" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Creator
            </label>
            <select
              id="avatar-catalog-creator"
              name="creator"
              defaultValue={filters.creator}
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              {AVATAR_CATALOG_CREATOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <div className="flex items-center gap-3 md:self-end">
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-white transition hover:bg-accent-dark dark:bg-accent-dark dark:hover:bg-accent"
        >
          Apply
        </button>
        {hasFilters ? (
          <Link href={basePath} className="inline-flex h-10 items-center justify-center text-sm font-semibold text-muted transition hover:text-accent">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function AvatarCatalogGrid({
  items,
  pageTitle,
  hasFilters
}: {
  items: AvatarCatalogItem[];
  pageTitle: string;
  hasFilters: boolean;
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-surface/60 p-8 text-center">
        <p className="text-base font-semibold text-foreground">
          {hasFilters ? "No matching IDs" : "No IDs available yet"}
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
          {hasFilters
            ? "Try a different search, sale state, creator filter, or sort option."
            : `${pageTitle} entries are not available in this view yet.`}
        </p>
      </div>
    );
  }

  return (
    <>
      {items.map((item) => (
        <div key={`${item.item_type}-${item.asset_id}`} data-journey-item className="h-full">
          <RobloxCatalogItemCard item={item} />
        </div>
      ))}
    </>
  );
}

export async function generateAvatarCatalogMetadata({
  prefix,
  segments,
  searchParams
}: {
  prefix: string;
  segments?: string[];
  searchParams?: AvatarCatalogSearchParamsInput;
}): Promise<Metadata> {
  const route = resolveAvatarCatalogRoute(prefix, segments ?? []);
  if (!route) {
    return {
      title: `Roblox Catalog | ${SITE_NAME}`
    };
  }

  const [catalog, count, filters] = await Promise.all([
    getCatalogPageContentByCodes([route.config.code]),
    getAvatarCatalogCount(route.config).catch(() => 0),
    resolveAvatarCatalogSearch(searchParams)
  ]);
  const shouldNoIndex = route.page > 1 || hasActiveAvatarFilters(filters);
  const canonicalPath = route.page > 1 ? `${route.config.basePath}/page/${route.page}` : route.config.basePath;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const baseTitle = resolveSeoTitle(getAvatarCatalogSeoTitle(route.config, count)) ?? route.config.title;
  const title = route.page > 1 ? `${baseTitle} - Page ${route.page}` : baseTitle;
  const description = getAvatarCatalogSeoDescription(route.config);
  const image = catalog?.thumb_url || `${SITE_URL}/Bloxodes.png`;

  return {
    title,
    description,
    alternates: buildAlternates(canonicalUrl),
    robots: shouldNoIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      url: canonicalUrl,
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

export async function renderAvatarCatalogPage({
  route,
  filters
}: {
  route: AvatarCatalogRouteState;
  filters: AvatarCatalogResolvedSearch;
}) {
  const primaryNavParent = resolveAvatarCatalogPrimaryNavParent(route);
  const secondaryNavParent = resolveAvatarCatalogSecondaryNavParent(route);
  const primaryActiveCode = resolveAvatarCatalogPrimaryActiveCode(route);
  const hasFilters = hasActiveAvatarFilters(filters);
  const [{ items, total, totalPages }, catalog, navCounts] = await Promise.all([
    loadAvatarCatalogPageData(route.config, route.page, filters),
    getCatalogPageContentByCodes([route.config.code]),
    loadAvatarCatalogNavCounts(primaryNavParent)
  ]);
  const contentHtml = await buildAvatarCatalogContentHtml(catalog);
  const pageHeading = getAvatarCatalogPageHeading(route.config);
  const structuredDataTitle = route.page > 1 ? `${pageHeading} - Page ${route.page}` : pageHeading;
  const description = getAvatarCatalogSeoDescription(route.config);
  const publishedDate = contentHtml?.publishedAt ? new Date(contentHtml.publishedAt) : null;
  const publishedIso = publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : null;
  const updatedDate = contentHtml?.updatedAt ? new Date(contentHtml.updatedAt) : null;
  const updatedIso = updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toISOString() : null;
  const showHero = route.page === 1;
  const canonicalPath = route.page > 1 ? `${route.config.basePath}/page/${route.page}` : route.config.basePath;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const startIndex = (route.page - 1) * AVATAR_CATALOG_PAGE_SIZE;
  const queryString = buildAvatarCatalogQueryString(filters);
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const howHtml = contentHtml?.howHtml?.trim() ? contentHtml.howHtml : "";
  const faqHtml = contentHtml?.faqHtml ?? [];
  const hasDetails = Boolean(descriptionHtml.length) || Boolean(howHtml) || Boolean(faqHtml.length);
  const breadcrumbItems = buildAvatarCatalogBreadcrumbItems(route, pageHeading);

  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: canonicalPath.replace(/^\//, ""),
      title: structuredDataTitle,
      description,
      image: `${SITE_URL}/Bloxodes.png`,
      author: null,
      publishedAt: publishedIso,
      updatedAt: updatedIso
    })
  );
  const listSchema = buildAvatarCatalogItemListSchema({
    title: structuredDataTitle,
    description,
    url: canonicalUrl,
    items,
    total,
    startIndex
  });
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd(
      breadcrumbItems.map((item) => ({
        name: item.label,
        url: item.href ? `${SITE_URL.replace(/\/$/, "")}${item.href}` : canonicalUrl
      }))
    )
  );
  const introNodes = introHtml ? renderPageContentNodes(introHtml, "avatar-catalog-intro") : null;
  const descriptionNodes = descriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `avatar-catalog-description-${entry.key}`)
  );
  const howNodes = howHtml ? renderPageContentNodes(howHtml, "avatar-catalog-how") : null;
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `avatar-catalog-faq-${idx}`)
  }));
  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb items={breadcrumbItems} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{pageHeading}</h1>
        <UpdatedTimestamp value={updatedDate} />
        {route.page > 1 ? <p className="text-sm text-muted">Page {route.page} of {totalPages}</p> : null}
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space journey-content-stream journey-content-stream--catalog-items">
        {showHero ? (
          <p>
            Search {route.config.title.replace(/\s+on Roblox$/i, "")} by name, creator, or Roblox ID. Every result includes a copy-ready
            {" "}Item ID or Bundle ID and a direct link to its official Roblox listing.
          </p>
        ) : null}
        {introNodes && showHero ? introNodes : null}

        <CatalogAdSlot />

        <AvatarCatalogNav parent={primaryNavParent} activeCode={primaryActiveCode} navCounts={navCounts} />

        <AvatarCatalogSubnav parent={secondaryNavParent} activeCode={route.config.code} />

        <AvatarCatalogFilterForm basePath={route.config.basePath} filters={filters} />
        <AvatarCatalogGrid items={items} pageTitle={pageHeading} hasFilters={hasFilters} />
        <PagePagination
          basePath={route.config.basePath}
          currentPage={route.page}
          totalPages={totalPages}
          query={queryString || undefined}
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

      {showHero && contentHtml?.id ? (
        <div className="mt-10">
          <CommentsSection entityType="catalog" entityId={contentHtml.id} />
        </div>
      ) : null}
      {showHero ? <MoreCatalogs excludeCode={resolveAvatarCatalogPrimaryActiveCode(route)} /> : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
