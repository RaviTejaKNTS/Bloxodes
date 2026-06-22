import Link from "next/link";
import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PagePagination } from "@/components/PagePagination";
import { breadcrumbJsonLd, SITE_NAME, SITE_URL, webPageJsonLd, buildAlternates } from "@/lib/seo";
import {
  BASE_PATH,
  MusicBreadcrumb,
  MusicCatalogNav,
  TrendingMusicList,
  buildMusicItemListSchema,
  getMusicChartConfig,
  loadMusicChartPageData,
  type MusicChartKey,
  type SearchParamsInput
} from "./page-data";

const PAGE_SIZE = 24;
type ChartRange = Exclude<MusicChartKey, "trending">;
const CHART_RANGES: ChartRange[] = ["weekly", "monthly", "yearly"];

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function resolveChartRange(searchParams: SearchParamsInput): Promise<ChartRange> {
  const params = searchParams ? await searchParams : {};
  const raw = firstParam(params.range)?.toLowerCase();
  return CHART_RANGES.includes(raw as ChartRange) ? (raw as ChartRange) : "weekly";
}

function periodLabel(range: ChartRange, latest: Date | null): string {
  if (!latest) return range === "weekly" ? "Latest week" : range === "monthly" ? "Latest month" : "Latest year";
  if (range === "weekly") {
    return `Week of ${latest.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  if (range === "monthly") {
    return latest.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return latest.toLocaleDateString("en-US", { year: "numeric" });
}

function chartPath(range: ChartRange, pageNumber = 1) {
  const pagePath = pageNumber > 1 ? `${BASE_PATH}/charts/page/${pageNumber}` : `${BASE_PATH}/charts`;
  return `${pagePath}?range=${range}`;
}

export function buildMusicChartsMetadata(pageNumber?: number): Metadata {
  const title = pageNumber && pageNumber > 1
    ? `Roblox music ID charts - Page ${pageNumber} | ${SITE_NAME}`
    : `Roblox music ID charts | ${SITE_NAME}`;
  const path = pageNumber && pageNumber > 1 ? `${BASE_PATH}/charts/page/${pageNumber}` : `${BASE_PATH}/charts`;

  return {
    title,
    description: "Switch between weekly, monthly, and yearly Roblox Creator Store music charts.",
    robots: { index: false, follow: true },
    alternates: buildAlternates(path)
  };
}

export async function MusicChartsPage({
  pageNumber = 1,
  searchParams
}: {
  pageNumber?: number;
  searchParams?: SearchParamsInput;
}) {
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const range = await resolveChartRange(searchParams);
  const config = getMusicChartConfig(range);
  const { songs, total, totalPages } = await loadMusicChartPageData(range, pageNumber);
  if (pageNumber > totalPages) {
    notFound();
  }

  const latest = songs.reduce<Date | null>((latestDate, song) => {
    if (!song.last_seen_at) return latestDate;
    const candidate = new Date(song.last_seen_at);
    if (!Number.isFinite(candidate.getTime())) return latestDate;
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;
  const period = periodLabel(range, latest);
  const canonicalPath = pageNumber > 1 ? `${BASE_PATH}/charts/page/${pageNumber}` : `${BASE_PATH}/charts`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}?range=${range}`;
  const pageTitle = pageNumber > 1 ? `${config.title} - Page ${pageNumber}` : config.title;
  const updatedIso = latest?.toISOString() ?? null;
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox music IDs", href: BASE_PATH },
    { label: "Charts", href: pageNumber > 1 ? `${BASE_PATH}/charts?range=${range}` : null },
    ...(pageNumber > 1 ? [{ label: `Page ${pageNumber}`, href: null }] : [])
  ];
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: "Charts", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/charts?range=${range}` },
      ...(pageNumber > 1 ? [{ name: `Page ${pageNumber}`, url: canonicalUrl }] : [])
    ])
  );
  const listSchema = buildMusicItemListSchema({
    title: pageTitle,
    description: config.description,
    url: canonicalUrl,
    songs,
    total,
    startIndex: (pageNumber - 1) * PAGE_SIZE
  });
  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: `${canonicalPath.replace(/^\//, "")}?range=${range}`,
      title: pageTitle,
      description: config.description,
      image: `${SITE_URL}/og-image.png`,
      author: null,
      publishedAt: updatedIso,
      updatedAt: updatedIso
    })
  );

  return (
    <div className="space-y-10">
      <header className={pageNumber > 1 ? "space-y-2" : "space-y-4"}>
        <MusicBreadcrumb items={breadcrumbNavItems} />
        <h1 className={pageNumber > 1 ? "text-3xl font-semibold text-foreground" : "text-4xl font-semibold leading-tight text-foreground md:text-5xl"}>
          Roblox music ID charts
        </h1>
        {pageNumber === 1 ? (
          <p className="max-w-2xl text-base text-muted md:text-lg">
            Switch between weekly, monthly, and yearly Creator Store music charts.
          </p>
        ) : null}
        <IndexPageStats
          items={[
            { label: `${total.toLocaleString("en-US")} ${config.statLabel}`, icon: "music", tone: "accent" },
            { label: period, icon: "events" },
            ...(refreshedLabel ? [{ label: `Updated ${refreshedLabel}`, icon: "clock" as const }] : [])
          ]}
        />
      </header>

      <CatalogAdSlot />

      <MusicCatalogNav active="charts" />

      <nav className="flex flex-wrap gap-2" aria-label="Music chart range">
        {CHART_RANGES.map((item) => {
          const itemConfig = getMusicChartConfig(item);
          const active = item === range;
          return (
            <Link
              key={item}
              href={chartPath(item)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center rounded-md border px-4 py-2 text-sm font-semibold transition ${active
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-border/70 bg-surface text-muted hover:border-accent/50 hover:text-foreground"
                }`}
            >
              {itemConfig.breadcrumbLabel}
            </Link>
          );
        })}
      </nav>

      <TrendingMusicList songs={songs} startIndex={(pageNumber - 1) * PAGE_SIZE} />

      <PagePagination
        basePath={`${BASE_PATH}/charts`}
        currentPage={pageNumber}
        totalPages={totalPages}
        query={`range=${range}`}
      />

      <CatalogAdSlot />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
