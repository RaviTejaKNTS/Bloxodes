import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
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
  type MusicChartKey
} from "./page-data";

const PAGE_SIZE = 24;

export function buildMusicChartMetadata(key: MusicChartKey, pageNumber?: number): Metadata {
  const config = getMusicChartConfig(key);
  const title = pageNumber && pageNumber > 1
    ? `${config.title} - Page ${pageNumber} | ${SITE_NAME}`
    : `${config.title} | ${SITE_NAME}`;
  const path = pageNumber && pageNumber > 1 ? `${config.path}/page/${pageNumber}` : config.path;

  return {
    title,
    description: config.description,
    robots: { index: false, follow: true },
    alternates: buildAlternates(path)
  };
}

export async function MusicChartPage({ chart, pageNumber = 1 }: { chart: MusicChartKey; pageNumber?: number }) {
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const config = getMusicChartConfig(chart);
  const { songs, total, totalPages } = await loadMusicChartPageData(chart, pageNumber);
  if (pageNumber > totalPages) {
    notFound();
  }

  const latest = songs.reduce<Date | null>((latestDate, song) => {
    if (!song.last_seen_at) return latestDate;
    const candidate = new Date(song.last_seen_at);
    if (!latestDate || candidate > latestDate) return candidate;
    return latestDate;
  }, null);
  const refreshedLabel = latest ? formatDistanceToNow(latest, { addSuffix: true }) : null;
  const canonicalPath = pageNumber > 1 ? `${config.path}/page/${pageNumber}` : config.path;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const pageTitle = pageNumber > 1 ? `${config.title} - Page ${pageNumber}` : config.title;
  const updatedIso = latest?.toISOString() ?? null;
  const breadcrumbNavItems = [
    { label: "Home", href: "/" },
    { label: "Catalog", href: "/catalog" },
    { label: "Roblox music IDs", href: BASE_PATH },
    { label: config.breadcrumbLabel, href: pageNumber > 1 ? config.path : null },
    ...(pageNumber > 1 ? [{ label: `Page ${pageNumber}`, href: null }] : [])
  ];
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox music IDs", url: `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}` },
      { name: config.breadcrumbLabel, url: `${SITE_URL.replace(/\/$/, "")}${config.path}` },
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
      slug: canonicalPath.replace(/^\//, ""),
      title: pageTitle,
      description: config.description,
      image: `${SITE_URL}/og-image.png`,
      author: null,
      publishedAt: null,
      updatedAt: updatedIso
    })
  );

  return (
    <div className="space-y-10">
      <header className={pageNumber > 1 ? "space-y-2" : "space-y-4"}>
        <MusicBreadcrumb items={breadcrumbNavItems} />
        <h1 className={pageNumber > 1 ? "text-3xl font-semibold text-foreground" : "text-4xl font-semibold leading-tight text-foreground md:text-5xl"}>
          {config.heading}
        </h1>
        {pageNumber === 1 ? (
          <p className="max-w-2xl text-base text-muted md:text-lg">{config.description}</p>
        ) : null}
        <IndexPageStats
          items={[
            { label: `${total.toLocaleString("en-US")} ${config.statLabel}`, icon: "music", tone: "accent" },
            ...(refreshedLabel ? [{ label: `Updated ${refreshedLabel}`, icon: "clock" as const }] : []),
            { label: pageNumber > 1 ? `Page ${pageNumber} of ${totalPages}` : "24 per page" }
          ]}
        />
      </header>

      <MusicCatalogNav active={config.activeNav} />

      <TrendingMusicList songs={songs} startIndex={(pageNumber - 1) * PAGE_SIZE} />

      <PagePagination basePath={config.path} currentPage={pageNumber} totalPages={totalPages} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
