import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, BookOpen, Flame, Key, LayoutGrid, ListChecks, Newspaper, Puzzle, Wrench } from "lucide-react";
import { listCodePagesWithActiveCounts } from "@/lib/db";
import { listPublishedQuizzes, loadQuizData } from "@/lib/quizzes";
import { buildServerQuizAttempt } from "@/lib/quiz-attempts";
import { listPublishedTools } from "@/lib/tools";
import { getStatsHome } from "@/lib/stats";
import { getContentCounts } from "@/lib/content-counts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { listPublishedTopLevelCatalogPages } from "@/lib/catalog";
import { resolveCatalogCardMeta } from "@/lib/catalog-card-meta";
import { listPublishedWikiPages, type WikiListEntry } from "@/lib/wiki";
import { EventsPageCard } from "@/components/EventsPageCard";
import { WikiCard } from "@/components/WikiCard";
import { CatalogCard } from "@/components/CatalogCard";
import { ToolCard } from "@/components/ToolCard";
import { CardImage } from "@/components/CardImage";
import { FeaturedQuizCard } from "@/components/home/FeaturedQuizCard";
import { StatsChartPanel } from "@/app/(site)/stats/components/StatsChartPanel";
import { buildEventsCards } from "./events/page-data";

export const revalidate = 3600;

const PAGE_TITLE = `${SITE_NAME} | Roblox stats, wikis, codes, events, quizzes & checklists`;
const PAGE_DESCRIPTION = SITE_DESCRIPTION;
const CATALOG_TONES = ["indigo", "amber", "emerald"] as const;

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
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
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

export default async function HomePage() {
  const [statsHome, codeGames, wikiPages, eventsPayload, quizzes, tools, catalogPages, counts] = await Promise.all([
    getStatsHome(),
    listCodePagesWithActiveCounts(),
    listPublishedWikiPages(),
    buildEventsCards(6),
    listPublishedQuizzes(),
    listPublishedTools(),
    listPublishedTopLevelCatalogPages(),
    getContentCounts()
  ]);

  const totalActiveCodes = codeGames.reduce((sum, game) => sum + (game.active_count ?? 0), 0);
  const topGames = statsHome.topGames.slice(0, 5);

  // Wiki coverage for trending games.
  const wikiByUniverse = new Map<number, WikiListEntry>();
  for (const page of wikiPages) {
    if (typeof page.universe_id === "number" && page.slug) wikiByUniverse.set(page.universe_id, page);
  }
  const wikiImage = (page: WikiListEntry) => pickThumbnail(page.thumbnail_urls) ?? page.cover_image ?? page.icon_url ?? null;

  // Rising games we cover → wiki cards.
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

  // Spotlight: top-by-players games we cover (distinct from the rising wikis).
  const spotlightGames = topGames
    .map((game) => ({ game, wiki: wikiByUniverse.get(game.universeId) }))
    .filter((entry): entry is { game: (typeof topGames)[number]; wiki: WikiListEntry } => Boolean(entry.wiki))
    .slice(0, 2);

  // General catalog cards.
  const catalogCards = await Promise.all(
    catalogPages.slice(0, 3).map(async (page, index) => {
      const meta = await resolveCatalogCardMeta(page.code);
      return {
        id: page.code,
        href: `/catalog/${page.code}`,
        title: meta.shortLabel ?? page.title,
        count: meta.count,
        iconKey: meta.icon,
        tone: CATALOG_TONES[index % CATALOG_TONES.length]
      };
    })
  );

  // Quiz of the day.
  const quizPick = quizzes[0] ?? null;
  const quizData = quizPick ? await loadQuizData(quizPick.code) : null;
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

  // Events + all games.
  const liveEvents = eventsPayload.cards.filter((c) => c.status === "current" || c.status === "upcoming");
  const events = (liveEvents.length ? liveEvents : eventsPayload.cards).slice(0, 2);
  const allGames = [...codeGames].sort((a, b) => a.name.localeCompare(b.name));
  const toolCards = tools.slice(0, 3);

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

  return (
    <div className="space-y-12 -mt-6 md:-mt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />

      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent/80">Roblox · live</p>
        <h1 className="max-w-4xl text-3xl font-bold leading-tight text-foreground md:text-4xl">
          Roblox hub for live stats, wikis, active codes, events, quizzes and gameplay checklists
        </h1>
        <p className="max-w-2xl text-sm text-muted md:text-base">
          Real-time player counts, game wikis, working codes, event countdowns, quizzes and progress checklists — all in one
          place.
        </p>
      </header>

      {/* TOP ROW — leaderboard · catalogs · spotlight */}
      <section className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Flame className="h-4 w-4 text-amber-500" aria-hidden /> Top games right now
          </div>
          <ul className="space-y-2">
            {topGames.map((game, index) => (
              <li key={game.universeId}>
                <Link href={`/stats/games/${game.slug}`} className="flex items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-surface-muted/50">
                  <span className="w-4 text-center text-xs font-semibold text-muted">{index + 1}</span>
                  <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                    <CardImage src={game.iconUrl} alt={game.displayName} />
                  </span>
                  <span className="flex-1 truncate text-sm text-foreground">{game.displayName}</span>
                  <span className="text-xs font-medium text-muted">{abbreviateCount(game.playing)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/stats/games" className="mt-3 inline-block text-xs font-semibold text-muted hover:text-accent">
            Full leaderboard →
          </Link>
        </div>

        <div className="space-y-3">
          {catalogCards.map(({ id, ...card }) => (
            <CatalogCard key={id} {...card} />
          ))}
          <Link href="/catalog" className="inline-block text-xs font-semibold text-muted hover:text-accent">
            All catalogs →
          </Link>
        </div>

        <div className="space-y-3">
          {spotlightGames.map(({ game, wiki }) => (
            <Link
              key={game.universeId}
              href={`/wiki/${wiki.slug}`}
              className="group relative flex min-h-[7.5rem] flex-col justify-end overflow-hidden rounded-xl border border-border/60 bg-surface-muted p-4"
            >
              <span className="absolute inset-0">
                <CardImage src={wikiImage(wiki)} alt={game.displayName} className="opacity-45 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-55" />
              </span>
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" aria-hidden />
              <span className="relative">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Spotlight</span>
                <span className="block text-base font-semibold text-white">{game.displayName}</span>
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-white/80">
                  {abbreviateCount(game.playing)} playing · wiki →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* TRENDING WIKIS */}
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

      {/* EVENTS (left) + ALL GAMES (right) */}
      <section className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:items-start">
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

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-foreground">Every game we cover</h2>
            <Link href="/codes" className="text-sm font-semibold text-accent hover:underline">
              All codes
            </Link>
          </div>
          <ul className="columns-2 gap-x-6 sm:columns-3">
            {allGames.map((game) => (
              <li key={game.id} className="mb-1.5 break-inside-avoid">
                <Link href={`/codes/${game.slug}`} className="block truncate text-sm text-foreground/80 transition-colors hover:text-accent">
                  {game.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* BROWSE everything + tools */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Browse everything on Bloxodes</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {browse.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-3 py-3 transition-colors hover:border-border">
                <Icon className="h-5 w-5 text-accent" aria-hidden />
                <span className="text-sm font-semibold text-foreground">{item.label}</span>
                <span className="ml-auto text-xs text-muted">{item.count.toLocaleString("en-US")}</span>
              </Link>
            );
          })}
        </div>
        {toolCards.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {toolCards.map((tool) => (
              <ToolCard key={tool.id ?? tool.code} tool={tool} />
            ))}
          </div>
        ) : null}
      </section>

      {/* PLATFORM CCU CHART — full width, same component as /stats */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Platform player activity</h2>
        <StatsChartPanel
          title="Platform CCU trend"
          subtitle="Tracked Roblox games, last 24 hours"
          chart={statsHome.platformTrend}
          defaultMetric="players"
          compact={false}
          area
        />
      </section>
    </div>
  );
}
