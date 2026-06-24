import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Flame,
  Key,
  LayoutGrid,
  ListChecks,
  Newspaper,
  Puzzle,
  Wrench
} from "lucide-react";
import { listCodePagesWithActiveCounts, listPublishedArticles, listPublishedChecklists } from "@/lib/db";
import { listPublishedQuizzes, loadQuizData } from "@/lib/quizzes";
import { buildServerQuizAttempt } from "@/lib/quiz-attempts";
import { listPublishedTools } from "@/lib/tools";
import { getStatsHome } from "@/lib/stats";
import { getGameSidebarData } from "@/lib/game-sidebar";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { listPublishedTopLevelCatalogPages } from "@/lib/catalog";
import { listPublishedWikiPages } from "@/lib/wiki";
import { EventsPageCard } from "@/components/EventsPageCard";
import { CardImage } from "@/components/CardImage";
import { PlatformCcuChart } from "@/components/home/PlatformCcuChart";
import { FeaturedQuizCard } from "@/components/home/FeaturedQuizCard";
import { buildEventsCards } from "./events/page-data";

export const revalidate = 3600;

const PAGE_TITLE = `${SITE_NAME} | Roblox codes, guides, tools, and live game stats`;
const PAGE_DESCRIPTION = SITE_DESCRIPTION;

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
  const [statsHome, codeGames, wikiPages, eventsPayload, quizzes, tools, catalogPages, articles, checklistRows] =
    await Promise.all([
      getStatsHome(),
      listCodePagesWithActiveCounts(),
      listPublishedWikiPages(),
      buildEventsCards(6),
      listPublishedQuizzes(),
      listPublishedTools(),
      listPublishedTopLevelCatalogPages(),
      listPublishedArticles(8),
      listPublishedChecklists(40)
    ]);

  const totalActiveCodes = codeGames.reduce((sum, game) => sum + (game.active_count ?? 0), 0);

  // Wiki coverage map → only surface trending games we actually cover.
  const wikiByUniverse = new Map<number, { slug: string; title: string; image: string | null }>();
  for (const page of wikiPages) {
    if (typeof page.universe_id === "number" && page.slug) {
      wikiByUniverse.set(page.universe_id, {
        slug: page.slug,
        title: page.title,
        image: pickThumbnail(page.thumbnail_urls) ?? page.cover_image ?? page.icon_url ?? null
      });
    }
  }

  const risingGames = statsHome.risers
    .filter((game) => typeof game.universeId === "number" && wikiByUniverse.has(game.universeId))
    .map((game) => {
      const wiki = wikiByUniverse.get(game.universeId)!;
      return {
        universeId: game.universeId,
        name: game.displayName || game.name,
        wikiSlug: wiki.slug,
        image: wiki.image ?? game.iconUrl ?? null,
        playing: game.playing,
        growth: typeof game.growth24hPercent === "number" ? Math.round(game.growth24hPercent) : null
      };
    });

  const risingTop = risingGames.slice(0, 3);
  const topGames = statsHome.topGames.slice(0, 5);

  // Events: prefer live/upcoming.
  const liveEvents = eventsPayload.cards.filter((c) => c.status === "current" || c.status === "upcoming");
  const events = (liveEvents.length ? liveEvents : eventsPayload.cards).slice(0, 2);

  // Quiz of the day = newest published quiz with a playable question.
  const quizPick = quizzes[0] ?? null;
  const quizData = quizPick ? await loadQuizData(quizPick.code) : null;
  const firstQuestion = quizData ? buildServerQuizAttempt(quizData, quizPick!.code)[0] : null;
  const quizOfDay =
    quizPick && firstQuestion
      ? {
          code: quizPick.code,
          gameName: quizPick.universe?.display_name ?? quizPick.universe?.name ?? "Roblox",
          question: {
            id: firstQuestion.id,
            question: firstQuestion.question,
            options: firstQuestion.options.map((o) => ({ id: o.id, text: o.text })),
            correctOptionId: firstQuestion.correctOptionId
          }
        }
      : null;

  // Spotlight: top covered rising game (full hub) + a different one (compact).
  const spotlightA = risingGames[0] ?? null;
  const spotlightB = risingGames[1] ?? null;
  const spotlightData = spotlightA ? await getGameSidebarData(spotlightA.universeId) : null;

  const browse = [
    { href: "/codes", label: "Codes", icon: Key, count: codeGames.length },
    { href: "/wiki", label: "Wiki", icon: BookOpen, count: wikiPages.length },
    { href: "/stats", label: "Stats", icon: BarChart3, count: statsHome.totals.trackedGames },
    { href: "/tools", label: "Tools", icon: Wrench, count: tools.length },
    { href: "/catalog", label: "Catalog", icon: LayoutGrid, count: catalogPages.length },
    { href: "/checklists", label: "Checklists", icon: ListChecks, count: checklistRows.length },
    { href: "/quizzes", label: "Quizzes", icon: Puzzle, count: quizzes.length },
    { href: "/articles", label: "Articles", icon: Newspaper, count: articles.length }
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
        name: "Trending Roblox games",
        itemListElement: risingTop.map((game, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: game.name,
          url: `${SITE_URL}/wiki/${game.wikiSlug}`
        }))
      }
    ]
  });

  const spotlightLinks = spotlightData
    ? [
        spotlightData.codes
          ? { href: `/codes/${spotlightData.codes.slug}`, icon: Key, label: `Codes · ${spotlightData.codes.activeCount}`, tone: "codes" }
          : null,
        spotlightData.wiki ? { href: `/wiki/${spotlightData.wiki.slug}`, icon: BookOpen, label: "Wiki", tone: "wiki" } : null,
        spotlightData.checklist
          ? { href: `/checklists/${spotlightData.checklist.slug}`, icon: ListChecks, label: `Checklist · ${spotlightData.checklist.itemsCount}`, tone: "checklist" }
          : null,
        spotlightData.quiz ? { href: `/quizzes/${spotlightData.quiz.code}`, icon: Puzzle, label: "Quiz", tone: "quiz" } : null,
        spotlightData.tools.length
          ? { href: `/tools/${spotlightData.tools[0].code}`, icon: Wrench, label: `Tools · ${spotlightData.tools.length}`, tone: "tool" }
          : null,
        spotlightData.event ? { href: `/events/${spotlightData.event.slug}`, icon: CalendarClock, label: "Events", tone: "events" } : null,
        spotlightData.catalogs.length
          ? { href: spotlightData.catalogs[0].href, icon: LayoutGrid, label: spotlightData.catalogs[0].title, tone: "catalog" }
          : null,
        spotlightData.articles.length
          ? { href: `/articles/${spotlightData.articles[0].slug}`, icon: Newspaper, label: `Articles · ${spotlightData.articles.length}`, tone: "article" }
          : null
      ].filter(Boolean as unknown as <T>(v: T | null) => v is T)
    : [];

  const toneClass: Record<string, string> = {
    codes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    wiki: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    checklist: "bg-teal-500/10 text-teal-600 dark:text-teal-300",
    quiz: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    tool: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    events: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    catalog: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
    article: "bg-pink-500/10 text-pink-600 dark:text-pink-300"
  };

  return (
    <div className="space-y-12 -mt-6 md:-mt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />

      {/* HERO — platform pulse + top games leaderboard */}
      <section className="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:items-stretch">
        <div className="flex flex-col gap-4">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent/80">Roblox · live</p>
            <h1 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">The live Roblox database</h1>
            <p className="max-w-xl text-sm text-muted md:text-base">
              Codes, guides, tools, and real-time player stats for every Roblox game worth playing.
            </p>
          </header>

          <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl border border-border/60 bg-accent/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground/80">Players across tracked games · last 24h</span>
              <Link href="/stats" className="text-xs font-semibold text-accent hover:underline">
                Full stats →
              </Link>
            </div>
            <PlatformCcuChart points={statsHome.platformTrend} className="h-20 w-full" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-surface-muted/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted">Players now</p>
              <p className="text-xl font-semibold text-foreground">{abbreviateCount(statsHome.totals.livePlayers)}</p>
            </div>
            <div className="rounded-lg bg-surface-muted/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted">Active codes</p>
              <p className="text-xl font-semibold text-foreground">{totalActiveCodes.toLocaleString("en-US")}</p>
            </div>
            <div className="rounded-lg bg-surface-muted/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted">Games tracked</p>
              <p className="text-xl font-semibold text-foreground">{statsHome.totals.trackedGames.toLocaleString("en-US")}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Flame className="h-4 w-4 text-amber-500" aria-hidden />
            Top games right now
          </div>
          <ul className="space-y-2">
            {topGames.map((game, index) => (
              <li key={game.universeId}>
                <Link
                  href={`/stats/games/${game.slug}`}
                  className="flex items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-surface-muted/50"
                >
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
      </section>

      {/* RISING / WIKI — above events + quiz */}
      {risingTop.length ? (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-foreground">Rising fast</h2>
            <Link href="/wiki" className="text-sm font-semibold text-accent hover:underline">
              All game wikis
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {risingTop.map((game) => (
              <Link
                key={game.universeId}
                href={`/wiki/${game.wikiSlug}`}
                className="group overflow-hidden rounded-lg border border-border/70 bg-card transition-colors hover:border-border"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted">
                  <CardImage src={game.image} alt={game.name} className="transition duration-500 group-hover:scale-[1.03]" />
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">{game.name}</p>
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3 w-3 text-amber-500" aria-hidden /> {abbreviateCount(game.playing)}
                    </span>
                    {game.growth != null ? <span className="text-emerald-500">+{game.growth}%</span> : null}
                    <span className="ml-auto text-accent">Wiki →</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* EVENTS (left) + QUIZ (right) */}
      <section className="grid gap-5 lg:grid-cols-[1fr_1.5fr] lg:items-start">
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

        {quizOfDay ? (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold text-foreground">Quiz of the day</h2>
              <span className="text-xs text-muted">{quizOfDay.gameName}</span>
            </div>
            <FeaturedQuizCard code={quizOfDay.code} gameName={quizOfDay.gameName} question={quizOfDay.question} />
          </div>
        ) : null}
      </section>

      {/* SPOTLIGHT bento — a covered trending game's full hub + a second game */}
      {spotlightA && spotlightLinks.length ? (
        <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-stretch">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                <CardImage src={spotlightA.image} alt={spotlightA.name} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Everything for {spotlightA.name}</p>
                <p className="text-xs text-muted">
                  {abbreviateCount(spotlightA.playing)} playing{spotlightA.growth != null ? ` · +${spotlightA.growth}%` : ""}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {spotlightLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium ${toneClass[link.tone] ?? "bg-surface-muted text-foreground"}`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {spotlightB ? (
            <Link
              href={`/wiki/${spotlightB.wikiSlug}`}
              className="group relative flex flex-col justify-end overflow-hidden rounded-xl border border-border/60 bg-surface-muted p-4 min-h-[10rem]"
            >
              <span className="absolute inset-0">
                <CardImage src={spotlightB.image} alt={spotlightB.name} className="opacity-40 transition duration-700 group-hover:scale-[1.04] group-hover:opacity-50" />
              </span>
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" aria-hidden />
              <span className="relative">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Spotlight</span>
                <span className="block text-lg font-semibold text-white">{spotlightB.name}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-white/90">Open the wiki →</span>
              </span>
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* BROWSE everything */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Browse everything</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {browse.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-3 py-3 transition-colors hover:border-border"
              >
                <Icon className="h-5 w-5 text-accent" aria-hidden />
                <span className="text-sm font-semibold text-foreground">{item.label}</span>
                <span className="ml-auto text-xs text-muted">{item.count.toLocaleString("en-US")}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
