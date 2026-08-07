import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import { ContentFaq } from "@/components/ContentFaq";
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
  const isIndexableTrendingPage = key === "trending" && (!pageNumber || pageNumber === 1);
  const title = pageNumber && pageNumber > 1
    ? `${config.title} - Page ${pageNumber} | ${SITE_NAME}`
    : `${config.title} | ${SITE_NAME}`;
  const path = pageNumber && pageNumber > 1 ? `${config.path}/page/${pageNumber}` : config.path;

  return {
    title,
    description: config.description,
    robots: { index: isIndexableTrendingPage, follow: true },
    alternates: buildAlternates(path)
  };
}

export async function MusicChartPage({ chart, pageNumber = 1 }: { chart: MusicChartKey; pageNumber?: number }) {
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    notFound();
  }

  const config = getMusicChartConfig(chart);
  const showTrendingGuide = chart === "trending" && pageNumber === 1;
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
      image: `${SITE_URL}/Bloxodes.png`,
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

      {showTrendingGuide ? (
        <p className="max-w-3xl text-base leading-7 text-muted md:text-lg">
          Trending Roblox music IDs are songs currently placed in Roblox&apos;s daily top-song feed. Use the rankings to find popular audio quickly, compare titles and artists, and copy an asset ID for a game that supports Radios, Boomboxes, Jukeboxes, or custom music.
        </p>
      ) : null}

      <MusicCatalogNav active={config.activeNav} />

      {showTrendingGuide ? (
        <section className="space-y-3 border-y border-border/60 py-6">
          <h2 className="text-2xl font-semibold leading-snug text-foreground">
            How trending Roblox music IDs are ranked
          </h2>
          <p className="max-w-3xl leading-7 text-muted">
            The order comes from Roblox&apos;s daily top-song data. A lower rank number means the audio appears higher in that feed. Bloxodes keeps the Roblox asset ID, song title, artist, duration, and current rank together so you can compare songs without opening every asset separately.
          </p>
          <p className="max-w-3xl leading-7 text-muted">
            Rankings can move whenever Roblox refreshes its music data. A song may rise because more players are finding it, then fall as other tracks become more popular. The list shows discovery trends across Roblox. It does not guarantee that every experience allows the audio in its radio, Boombox, or custom sound field.
          </p>
        </section>
      ) : null}

      <TrendingMusicList songs={songs} startIndex={(pageNumber - 1) * PAGE_SIZE} />

      <PagePagination basePath={config.path} currentPage={pageNumber} totalPages={totalPages} />

      {showTrendingGuide ? (
        <div className="space-y-8 border-t border-border/60 pt-8">
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold leading-snug text-foreground">
              How to use a trending Roblox music ID
            </h2>
            <p className="max-w-3xl leading-7 text-muted">
              Copy the number shown beside the song, then paste it into a Roblox experience that accepts audio asset IDs. The exact control depends on the game. It may be called Radio, Boombox, Jukebox, Music ID, or Custom Audio. Some controls are free, while others require a game pass or an in-game item.
            </p>
            <p className="max-w-3xl leading-7 text-muted">
              If the game rejects the number, check that you copied only the digits. The experience may also restrict which audio assets it can play. Try another ranked song before assuming the input itself is broken.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold leading-snug text-foreground">
              Why a trending Roblox music ID can stop playing
            </h2>
            <p className="max-w-3xl leading-7 text-muted">
              Roblox audio availability can change after moderation, privacy, ownership, or licensing updates. Game developers can also disable their music controls or limit them to approved audio. A ranking proves that Roblox reported the song in its music feed, but it cannot override the rules of the experience where you try to play it.
            </p>
          </section>

          <ContentFaq
            title="Trending Roblox Music IDs FAQ"
            items={[
              {
                id: "trending-refresh",
                question: "How often do the trending music rankings change?",
                answer: <p>The source is checked daily. Positions may change whenever Roblox publishes a different order or adds and removes songs from its top-song feed.</p>
              },
              {
                id: "trending-working",
                question: "Does a trending music ID work in every Roblox game?",
                answer: <p>No. The game must provide an audio input and have permission to use that asset. Some experiences allow broad music choices, while others use a private approved list.</p>
              },
              {
                id: "trending-copy",
                question: "What part of the music ID should I copy?",
                answer: <p>Copy the numeric Roblox asset ID only. Do not include the song title, rank symbol, spaces, or the Roblox website address.</p>
              }
            ]}
          />
        </div>
      ) : null}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
