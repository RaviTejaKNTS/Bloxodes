import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Key,
  LayoutGrid,
  ListChecks,
  Music,
  Newspaper,
  Puzzle,
  TrendingUp,
  Wrench
} from "lucide-react";
import { listCodePagesWithActiveCounts } from "@/lib/db";
import { listPublishedQuizzes, loadQuizData } from "@/lib/quizzes";
import { buildServerQuizAttempt } from "@/lib/quiz-attempts";
import { listPublishedTools } from "@/lib/tools";
import { getStatsHome } from "@/lib/stats";
import { getGameSidebarData } from "@/lib/game-sidebar";
import { getContentCounts } from "@/lib/content-counts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { resolveCatalogCardMeta } from "@/lib/catalog-card-meta";
import { listPublishedWikiPages, type WikiListEntry } from "@/lib/wiki";
import { EventsPageCard } from "@/components/EventsPageCard";
import { WikiCard } from "@/components/WikiCard";
import { ToolCard } from "@/components/ToolCard";
import { CardImage } from "@/components/CardImage";
import { FeaturedQuizCard } from "@/components/home/FeaturedQuizCard";
import { StatsChartPanel } from "@/app/(site)/stats/components/StatsChartPanel";
import { buildEventsCards } from "./events/page-data";

export const revalidate = 3600;

const PAGE_TITLE = `${SITE_NAME} | Roblox stats, wikis, codes, events, quizzes & checklists`;
const PAGE_DESCRIPTION = SITE_DESCRIPTION;

type HomeHubLink = { href: string; icon: typeof Key; label: string };

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: ["Roblox codes", "Roblox guides", "Roblox stats", "Bloxodes", "Roblox tools", "Roblox wiki"],
  alternates: buildAlternates(SITE_URL),
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: `${SITE_URL}/Bloxodes.png`, width: 1200, height: 675, alt: PAGE_TITLE }]
  },
  twitter: { card: "summary_large_image", title: PAGE_TITLE, description: PAGE_DESCRIPTION, images: [`${SITE_URL}/Bloxodes.png`] }
};

function abbreviateCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const strip = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${strip(value / 1000)}K`;
  if (value < 1_000_000_000) return `${strip(value / 1_000_000)}M`;
  return `${strip(value / 1_000_000_000)}B`;
}

function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picked = pickThumbnail(entry);
      if (picked) return picked;
    }
  }
  if (value && typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string" && url.trim()) return url;
  }
  return null;
}

async function loadHomeData<T>(label: string, loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.error(`Home data loader failed: ${label}`, error);
    throw error;
  }
}

export default async function HomePage() {
  const [statsHome, codeGames, wikiPages, eventsPayload, quizzes, tools, counts, musicMeta] = await Promise.all([
    loadHomeData("stats home", () => getStatsHome()),
    loadHomeData("code pages", () => listCodePagesWithActiveCounts()),
    loadHomeData("wiki pages", () => listPublishedWikiPages()),
    loadHomeData("events", () => buildEventsCards(6)),
    loadHomeData("quizzes", () => listPublishedQuizzes()),
    loadHomeData("tools", () => listPublishedTools()),
    loadHomeData("content counts", () => getContentCounts()),
    loadHomeData("music catalog metadata", () => resolveCatalogCardMeta("roblox-music-ids"))
  ]);

  const topGames = statsHome.topGames.slice(0, 5);

  const wikiByUniverse = new Map<number, WikiListEntry>();
  for (const page of wikiPages) {
    if (typeof page.universe_id === "number" && page.slug) wikiByUniverse.set(page.universe_id, page);
  }
  const wikiImage = (page: WikiListEntry) => pickThumbnail(page.thumbnail_urls) ?? page.cover_image ?? page.icon_url ?? null;

  // Trending games we cover → wiki cards.
  const trendingWikis: WikiListEntry[] = [];
  for (const game of statsHome.risers) {
    const entry = typeof game.universeId === "number" ? wikiByUniverse.get(game.universeId) : undefined;
    if (entry && !trendingWikis.includes(entry)) trendingWikis.push(entry);
    if (trendingWikis.length >= 4) break;
  }
  if (trendingWikis.length < 4) {
    for (const page of wikiPages) {
      if (!trendingWikis.includes(page)) trendingWikis.push(page);
      if (trendingWikis.length >= 4) break;
    }
  }

  // Hero spotlight = top two games (by players) we cover.
  const spotlightGames = topGames
    .map((game) => ({ game, wiki: wikiByUniverse.get(game.universeId) }))
    .filter((entry): entry is { game: (typeof topGames)[number]; wiki: WikiListEntry } => Boolean(entry.wiki))
    .slice(0, 2);
  const spotlightUniverseIds = new Set(spotlightGames.map((s) => s.game.universeId));

  // Quiz of the day.
  const quizPick = quizzes[0] ?? null;
  const quizData = quizPick ? await loadHomeData("featured quiz", () => loadQuizData(quizPick.code)) : null;
  const firstQuestion = quizData ? buildServerQuizAttempt(quizData, quizPick!.code)[0] : null;
  const quizOfDay =
    quizPick && firstQuestion
      ? {
          code: quizPick.code,
          gameName: quizPick.universe?.display_name ?? quizPick.universe?.name ?? "Roblox",
          imageUrl: pickThumbnail(quizPick.universe?.thumbnail_urls) ?? quizPick.universe?.icon_url ?? null,
          question: {
            id: firstQuestion.id,
            question: firstQuestion.question,
            options: firstQuestion.options.map((o) => ({ id: o.id, text: o.text })),
            correctOptionId: firstQuestion.correctOptionId
          }
        }
      : null;

  const liveEvents = eventsPayload.cards.filter((c) => c.status === "current" || c.status === "upcoming");
  const events = (liveEvents.length ? liveEvents : eventsPayload.cards).slice(0, 2);

  // Game hub: prefer a trending covered game, but keep the section visible on thinner local datasets.
  const hubCandidatePool = [...statsHome.risers, ...topGames, ...statsHome.mostVisited, ...statsHome.recentGames];
  const hubCandidate =
    hubCandidatePool.find(
      (game) => typeof game.universeId === "number" && wikiByUniverse.has(game.universeId) && !spotlightUniverseIds.has(game.universeId)
    ) ?? hubCandidatePool.find((game) => typeof game.universeId === "number" && wikiByUniverse.has(game.universeId));
  const hubWikiFallback = hubCandidate
    ? null
    : wikiPages.find((page): page is WikiListEntry & { universe_id: number } => typeof page.universe_id === "number");
  const hubGame = hubCandidate
    ? { universeId: hubCandidate.universeId, name: hubCandidate.displayName || hubCandidate.name, playing: hubCandidate.playing }
    : hubWikiFallback
      ? { universeId: hubWikiFallback.universe_id, name: hubWikiFallback.title.replace(/\s+Wiki$/i, ""), playing: null }
    : null;
  const hubWikiOnly = hubGame ? null : (trendingWikis[0] ?? wikiPages[0] ?? null);
  const hubData = hubGame
    ? await loadHomeData("game sidebar", () => getGameSidebarData(hubGame.universeId))
    : null;
  const hubLinks = hubData
    ? [
        hubData.wiki ? { href: `/wiki/${hubData.wiki.slug}`, icon: BookOpen, label: "Wiki" } : null,
        hubData.codes ? { href: `/codes/${hubData.codes.slug}`, icon: Key, label: `Codes · ${hubData.codes.activeCount}` } : null,
        hubData.checklist ? { href: `/checklists/${hubData.checklist.slug}`, icon: ListChecks, label: `Checklist · ${hubData.checklist.itemsCount}` } : null,
        hubData.quiz ? { href: `/quizzes/${hubData.quiz.code}`, icon: Puzzle, label: "Quiz" } : null,
        hubData.tools.length ? { href: `/tools/${hubData.tools[0].code}`, icon: Wrench, label: `Tools · ${hubData.tools.length}` } : null,
        hubData.event ? { href: `/events/${hubData.event.slug}`, icon: CalendarClock, label: "Events" } : null,
        hubData.catalogs.length ? { href: hubData.catalogs[0].href, icon: LayoutGrid, label: hubData.catalogs[0].title } : null,
        hubData.articles.length ? { href: `/articles/${hubData.articles[0].slug}`, icon: Newspaper, label: `Articles · ${hubData.articles.length}` } : null
      ].filter((v): v is HomeHubLink => Boolean(v))
    : hubWikiOnly
      ? [{ href: `/wiki/${hubWikiOnly.slug}`, icon: BookOpen, label: "Wiki" }]
    : [];
  const hubDisplayName = hubGame?.name ?? hubWikiOnly?.title.replace(/\s+Wiki$/i, "") ?? null;
  const hubPlaying = hubGame?.playing ?? null;

  const toolCards = tools.slice(0, 3);
  const musicCount = typeof musicMeta.count === "number" ? musicMeta.count.toLocaleString("en-US") : null;

  const browse = [
    { href: "/codes", label: "Codes", icon: Key, count: counts.codes },
    { href: "/wiki", label: "Wiki", icon: BookOpen, count: counts.wiki },
    { href: "/stats", label: "Stats", icon: BarChart3, count: statsHome.totals.trackedGames },
    { href: "/tools", label: "Tools", icon: Wrench, count: counts.tools },
    { href: "/catalog", label: "Catalog", icon: LayoutGrid, count: counts.catalogs },
    { href: "/checklists", label: "Checklists", icon: ListChecks, count: counts.checklists },
    { href: "/quizzes", label: "Quizzes", icon: Puzzle, count: counts.quizzes },
    { href: "/articles", label: "Articles", icon: Newspaper, count: counts.articles }
  ];

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: SITE_URL,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    hasPart: [
      {
        "@type": "ItemList",
        name: "Trending Roblox game wikis",
        itemListElement: trendingWikis.map((page, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: page.title,
          url: `${SITE_URL}/wiki/${page.slug}`
        }))
      }
    ]
  });

  const cardClass = "rounded-lg border border-border/70 bg-surface/80 p-4 shadow-none";

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <h1 className="max-w-4xl text-2xl font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
          Roblox hub for live stats, wikis, active codes, events, quizzes and gameplay checklists
        </h1>
        <p className="max-w-2xl text-sm text-muted md:text-base">
          Real-time player counts, game wikis, working codes, event countdowns, quizzes and progress checklists, all in one
          place.
        </p>
      </header>

      {/* TOP ROW — trending leaderboard · music catalog · spotlight */}
      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
        <div className="flex min-w-0 flex-col rounded-xl border border-border/70 bg-card p-4 sm:col-span-2 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-accent" aria-hidden /> Trending now
          </div>
          <ul className="flex-1 space-y-1">
            {topGames.map((game, index) => (
              <li key={game.universeId}>
                <Link
                  href={`/stats/games/${game.slug}`}
                  className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-muted/60"
                >
                  <span className="w-4 text-center text-xs font-semibold text-muted">{index + 1}</span>
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                    <CardImage src={game.iconUrl} alt={game.displayName} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{game.displayName}</span>
                    <span className="block text-xs text-muted">{abbreviateCount(game.playing)} playing</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/stats/games" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">
            Full leaderboard →
          </Link>
        </div>

        <Link
          href="/catalog/roblox-music-ids"
          className="group relative flex min-h-[9rem] min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-5 text-center text-white sm:min-h-full sm:p-6"
        >
          <Music className="absolute -bottom-5 -right-4 h-24 w-24 text-white/15 transition duration-500 group-hover:scale-105 sm:h-32 sm:w-32" aria-hidden />
          <span className="relative">
            {musicCount ? <span className="block text-3xl font-bold tracking-tight sm:text-4xl">{musicCount}</span> : null}
            <span className="mt-1 block text-sm font-medium text-white/85">Roblox Music IDs</span>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white/90">Browse all music codes →</span>
          </span>
        </Link>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 lg:gap-4">
          {spotlightGames.map(({ game, wiki }) => (
            <Link
              key={game.universeId}
              href={`/wiki/${wiki.slug}`}
              className="group relative flex min-h-[7rem] min-w-0 flex-col justify-end overflow-hidden rounded-xl border border-border/60 bg-surface-muted p-3.5 sm:min-h-[8rem] sm:p-4"
            >
              <span className="absolute inset-0">
                <CardImage src={wikiImage(wiki)} alt={game.displayName} className="opacity-45 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-55" />
              </span>
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" aria-hidden />
              <span className="relative">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Spotlight</span>
                <span className="block text-base font-semibold text-white">{game.displayName}</span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/80">{abbreviateCount(game.playing)} playing · wiki →</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* QUIZ — full width, image left */}
      {quizOfDay ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-foreground">Quiz of the day</h2>
            <span className="text-xs text-muted">{quizOfDay.gameName}</span>
          </div>
          <FeaturedQuizCard code={quizOfDay.code} gameName={quizOfDay.gameName} imageUrl={quizOfDay.imageUrl} question={quizOfDay.question} />
        </section>
      ) : null}

      {/* EVERYTHING FOR ONE GAME — above the happening-now band */}
      {hubDisplayName && hubLinks.length ? (
        <section className="space-y-4">
          <div className={cardClass}>
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-foreground">Everything for {hubDisplayName}</h2>
              </div>
              {hubPlaying != null ? <p className="text-xs font-medium text-muted">{abbreviateCount(hubPlaying)} playing</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {hubLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    className="group flex min-w-0 items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2.5 text-xs font-semibold text-foreground transition hover:border-accent/70 hover:bg-background/65 hover:text-accent"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted transition group-hover:text-accent" aria-hidden />
                    <span className="truncate">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* HAPPENING NOW + BROWSE EVERYTHING */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1.6fr] lg:items-stretch">
        {events.length ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Happening now</h2>
            <div className="space-y-3">
              {events.map(({ id, ...card }) => (
                <EventsPageCard key={id} {...card} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-foreground">Browse everything on Bloxodes</h2>
          <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-4">
            {browse.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex flex-col justify-between gap-2 rounded-lg border border-border/70 bg-card p-3 transition-colors hover:border-border">
                  <Icon className="h-5 w-5 text-accent" aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                    <span className="block text-xs text-muted">{item.count.toLocaleString("en-US")}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          {toolCards.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {toolCards.map((tool) => (
                <ToolCard key={tool.id ?? tool.code} tool={tool} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* TRENDING WIKIS — above the platform stats chart */}
      {trendingWikis.length ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-foreground">Wikis for trending Roblox games</h2>
            <Link href="/wiki" className="text-sm font-semibold text-accent hover:underline">
              All wikis
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trendingWikis.map((page) => (
              <WikiCard key={page.id} page={page} />
            ))}
          </div>
        </section>
      ) : null}

      {/* PLATFORM CCU CHART */}
      <section>
        <StatsChartPanel
          title="Platform CCU trend"
          subtitle="Tracked Roblox games"
          initialChart={statsHome.platformChart}
          chartEndpoint="/api/stats/platform/chart"
          defaultMetric="players"
          defaultRange="14d"
          autoDailyForMultiDayRange
          compact={false}
          area
        />
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </div>
  );
}
