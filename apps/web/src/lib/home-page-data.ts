import "server-only";
import { formatDistanceToNowStrict } from "date-fns";
import { supabaseAdmin } from "@/lib/supabase";
import {
  listCodesForCodePage,
  listPublishedArticles,
  listPublishedChecklists,
  type CodePageWithCounts
} from "@/lib/db";
import { listPublishedQuizzes, loadQuizData, type QuizListEntry } from "@/lib/quizzes";
import { buildServerQuizAttempt } from "@/lib/quiz-attempts";
import { listPublishedTools } from "@/lib/tools";
import { getStatsHome } from "@/lib/stats";
import { getContentCounts } from "@/lib/content-counts";
import { listPublishedWikiPages, type WikiListEntry } from "@/lib/wiki";
import { listPublishedPuzzlePages } from "@/lib/puzzles";
import { listPublishedTopLevelCatalogPages } from "@/lib/catalog";
import { resolveCatalogCardMeta, type CatalogIconKey } from "@/lib/catalog-card-meta";
import { getMinecraftWikiPageBySlug, resolveMinecraftWikiCoverImage } from "@/lib/minecraft";
import { AVATAR_CATALOG_MASTER_CODE, AVATAR_CATALOG_MASTER_TITLE } from "@/lib/roblox-avatar-catalog";
import { GTA_LINKS, MINECRAFT_LINKS, RED_DEAD_LINKS } from "@/components/hubs/HubsSidebar";
import { buildEventsCards } from "@/app/(site)/events/page-data";
import { puzzleCardName } from "@/app/(site)/puzzles/page-data";

type EventCard = Awaited<ReturnType<typeof buildEventsCards>>["cards"][number];

export type HomeLink = { href: string; label: string };

export type HomeEvent = {
  slug: string;
  gameName: string;
  eventName: string | null;
  timeLabel: string | null;
  status: "current" | "upcoming" | "past";
  image: string | null;
};

export type HomeCode = {
  code: string;
  reward: string | null;
  gameName: string;
  href: string;
  icon: string | null;
  firstSeenAt: string;
};

export type HomeGamePanel = {
  universeId: number;
  name: string;
  icon: string | null;
  cover: string | null;
  playing: number | null;
  rating: number | null;
  codes: { href: string; activeCount: number; latest: string[] } | null;
  wiki: HomeLink | null;
  checklist: (HomeLink & { tasks: number | null }) | null;
  event: (HomeLink & { status: HomeEvent["status"]; timeLabel: string | null }) | null;
  quiz: HomeLink | null;
  tool: (HomeLink & { count: number }) | null;
};

export type HomeShelfGame = { universeId: number; name: string; href: string; image: string | null; links: HomeLink[] };

export type HomeGuide = { slug: string; title: string; gameName: string | null; image: string | null };

export type HomeWiki = { slug: string; title: string; image: string | null; updatedLabel: string | null };

export type HomeChecklist = { slug: string; title: string; gameName: string; icon: string | null; tasks: number | null };

export type HomeQuiz = {
  code: string;
  gameName: string;
  icon: string | null;
  questionCount: number;
  question: { id: string; question: string; options: { id: string; text: string }[]; correctOptionId: string };
};

export type HomeCatalogCard = { href: string; title: string; count: number | null; iconKey: CatalogIconKey | null };

export type HomeFranchise = { href: string; name: string; image: string | null; links: HomeLink[]; hubLabel: string };

export type HomePuzzle = { href: string; name: string; icon: string | null };

export type HomeDirectoryGroup = { title: string; icon: "codes" | "catalog" | "stats" | "tools" | "wiki" | "map"; links: HomeLink[]; more: HomeLink };

const CATALOG_PICKS = [
  "roblox-music-ids",
  "free-roblox-items",
  AVATAR_CATALOG_MASTER_CODE,
  "roblox-promo-codes",
  "roblox-decal-ids",
  "roblox-color-codes"
];

async function load<T>(label: string, loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.error(`Home data loader failed: ${label}`, error);
    throw error;
  }
}

export function pickThumbnail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const picked = pickThumbnail(entry);
      if (picked) return picked;
    }
  }
  if (typeof value === "object" && "url" in value) {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string" && url.trim()) return url;
  }
  return null;
}

function gameNameFromWiki(page: Pick<WikiListEntry, "title">): string {
  return page.title.replace(/\s+wiki$/i, "").trim();
}

function wikiCover(page: WikiListEntry): string | null {
  return pickThumbnail(page.thumbnail_urls) ?? page.cover_image ?? page.icon_url ?? null;
}

function ago(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return `${formatDistanceToNowStrict(time)} ago`;
}

function eventStatus(card: EventCard): HomeEvent["status"] | null {
  return card.status === "none" ? null : card.status;
}

function toHomeEvent(card: EventCard): HomeEvent | null {
  const status = eventStatus(card);
  if (!status) return null;
  return {
    slug: card.slug,
    gameName: card.universeName ?? card.title,
    eventName: card.eventName,
    timeLabel: card.eventTimeLabel,
    status,
    image: card.coverImage ?? card.fallbackIcon ?? null
  };
}

function timeOf(value: string | null | undefined, fallback: number): number {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? fallback : time;
}

const CODE_PAGE_FIELDS = "id,name,slug,cover_image,created_at,updated_at,universe_id,active_code_count,latest_code_first_seen_at,content_updated_at";

type CodePageRow = Omit<CodePageWithCounts, "active_count"> & { active_code_count: number | null };

function toCodePage(row: CodePageRow): CodePageWithCounts {
  return {
    ...row,
    active_count: row.active_code_count ?? 0,
    latest_code_first_seen_at: row.latest_code_first_seen_at ?? null,
    content_updated_at: row.content_updated_at ?? row.updated_at ?? null
  };
}

/** Code pages for the given games. The full code page list is longer than one API page, so ask by game. */
async function loadCodePagesForUniverses(universeIds: number[]): Promise<CodePageWithCounts[]> {
  if (!universeIds.length) return [];
  const { data, error } = await supabaseAdmin()
    .from("code_pages_index_view")
    .select(CODE_PAGE_FIELDS)
    .eq("is_published", true)
    .in("universe_id", universeIds);
  if (error) throw error;
  return ((data ?? []) as CodePageRow[]).map(toCodePage);
}

async function loadRecentCodePages(limit: number): Promise<CodePageWithCounts[]> {
  const { data, error } = await supabaseAdmin()
    .from("code_pages_index_view")
    .select(CODE_PAGE_FIELDS)
    .eq("is_published", true)
    .gt("active_code_count", 0)
    .not("latest_code_first_seen_at", "is", null)
    .order("latest_code_first_seen_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as CodePageRow[]).map(toCodePage);
}

async function loadUniverseIcons(ids: Array<number | null>): Promise<Map<number, string>> {
  const universeIds = ids.filter((id): id is number => typeof id === "number");
  if (!universeIds.length) return new Map();
  const { data, error } = await supabaseAdmin().from("roblox_universes").select("universe_id, icon_url").in("universe_id", universeIds);
  if (error) throw error;
  return new Map(
    (data ?? [])
      .filter((row): row is { universe_id: number; icon_url: string } => typeof row.icon_url === "string" && Boolean(row.icon_url))
      .map((row) => [row.universe_id, row.icon_url])
  );
}

async function latestActiveCodes(page: CodePageWithCounts, limit: number) {
  const codes = await listCodesForCodePage(page.id);
  return codes
    .filter((code) => code.status === "active" && code.code)
    .sort((a, b) => timeOf(b.first_seen_at, 0) - timeOf(a.first_seen_at, 0))
    .slice(0, limit);
}

export async function loadHomePageData() {
  const [statsHome, recentCodePages, wikiPages, eventsPayload, quizzes, tools, counts, articles, checklists, puzzles, catalogPages, minecraft] =
    await Promise.all([
      load("stats home", () => getStatsHome()),
      load("recent code pages", () => loadRecentCodePages(8)),
      load("wiki pages", () => listPublishedWikiPages()),
      load("events", () => buildEventsCards()),
      load("quizzes", () => listPublishedQuizzes()),
      load("tools", () => listPublishedTools()),
      load("content counts", () => getContentCounts()),
      load("articles", () => listPublishedArticles(7)),
      load("checklists", () => listPublishedChecklists(200)),
      load("puzzles", () => listPublishedPuzzlePages()),
      load("catalog pages", () => listPublishedTopLevelCatalogPages()),
      load("minecraft hub", () => getMinecraftWikiPageBySlug("minecraft-java"))
    ]);

  // Lookups by Roblox universe, used to join every page type to its game.
  const wikiByUniverse = new Map<number, WikiListEntry>();
  for (const page of wikiPages) {
    if (typeof page.universe_id === "number" && !wikiByUniverse.has(page.universe_id)) wikiByUniverse.set(page.universe_id, page);
  }
  const codePages = await load("code pages", () => loadCodePagesForUniverses([...wikiByUniverse.keys()]));
  const codesByUniverse = new Map<number, CodePageWithCounts>();
  for (const page of codePages) {
    if (typeof page.universe_id !== "number") continue;
    const existing = codesByUniverse.get(page.universe_id);
    if (!existing || page.active_count > existing.active_count) codesByUniverse.set(page.universe_id, page);
  }
  const checklistByUniverse = new Map<number, (typeof checklists)[number]>();
  for (const row of checklists) {
    if (typeof row.universe_id === "number" && !checklistByUniverse.has(row.universe_id)) checklistByUniverse.set(row.universe_id, row);
  }
  const quizByUniverse = new Map<number, QuizListEntry>();
  for (const quiz of quizzes) {
    if (typeof quiz.universe_id === "number" && !quizByUniverse.has(quiz.universe_id)) quizByUniverse.set(quiz.universe_id, quiz);
  }
  const toolsByUniverse = new Map<number, typeof tools>();
  for (const tool of tools) {
    if (typeof tool.universe_id !== "number") continue;
    toolsByUniverse.set(tool.universe_id, [...(toolsByUniverse.get(tool.universe_id) ?? []), tool]);
  }
  const eventByUniverse = new Map<number, EventCard>();
  for (const card of eventsPayload.cards) {
    if (typeof card.universeId === "number" && eventStatus(card) && !eventByUniverse.has(card.universeId)) eventByUniverse.set(card.universeId, card);
  }
  const statsByUniverse = new Map(statsHome.topGames.map((game) => [game.universeId, game]));
  const checklistTasks = (row: (typeof checklists)[number]) =>
    typeof row.leaf_item_count === "number" ? row.leaf_item_count : typeof row.item_count === "number" ? row.item_count : null;

  // Games we cover (they have a wiki), most played first.
  const coveredByPlaying = [...wikiPages]
    .filter((page): page is WikiListEntry & { universe_id: number } => typeof page.universe_id === "number")
    .sort((a, b) => (statsByUniverse.get(b.universe_id)?.playing ?? b.playing ?? 0) - (statsByUniverse.get(a.universe_id)?.playing ?? a.playing ?? 0));
  // A game earns a tab when it has codes plus at least two more page types, so no panel is a lone wiki link.
  const pageTypeCount = (universeId: number) =>
    1 +
    [codesByUniverse, checklistByUniverse, quizByUniverse, toolsByUniverse, eventByUniverse].filter((lookup) => lookup.has(universeId)).length;
  const switcherWikis = coveredByPlaying
    .filter((wiki) => codesByUniverse.has(wiki.universe_id) && pageTypeCount(wiki.universe_id) >= 3)
    .slice(0, 8);
  const gamePanels: HomeGamePanel[] = await Promise.all(
    switcherWikis.map(async (wiki) => {
      const universeId = wiki.universe_id;
      const stats = statsByUniverse.get(universeId);
      const codePage = codesByUniverse.get(universeId);
      const checklist = checklistByUniverse.get(universeId);
      const quiz = quizByUniverse.get(universeId);
      const event = eventByUniverse.get(universeId);
      const gameTools = toolsByUniverse.get(universeId) ?? [];
      const latest = codePage ? await load("game codes", () => latestActiveCodes(codePage, 3)) : [];
      return {
        universeId,
        name: stats?.displayName || gameNameFromWiki(wiki),
        icon: stats?.iconUrl ?? wiki.icon_url ?? null,
        cover: stats?.thumbnailUrls[0] ?? wikiCover(wiki),
        playing: stats?.playing ?? wiki.playing ?? null,
        rating: stats?.ratingPercent ?? null,
        codes: codePage ? { href: `/codes/${codePage.slug}`, activeCount: codePage.active_count, latest: latest.map((code) => code.code) } : null,
        wiki: { href: `/wiki/${wiki.slug}`, label: wiki.title },
        checklist: checklist ? { href: `/checklists/${checklist.slug}`, label: checklist.title, tasks: checklistTasks(checklist) } : null,
        event:
          event && eventStatus(event)
            ? { href: `/events/${event.slug}`, label: event.eventName ?? event.title, status: eventStatus(event)!, timeLabel: event.eventTimeLabel }
            : null,
        quiz: quiz ? { href: `/quizzes/${quiz.code}`, label: `${stats?.displayName || gameNameFromWiki(wiki)} quiz` } : null,
        tool: gameTools.length ? { href: `/tools/${gameTools[0].code}`, label: gameTools[0].title, count: gameTools.length } : null
      };
    })
  );
  const switcherIds = new Set(gamePanels.map((game) => game.universeId));

  // New codes: newest active code from the code pages that most recently gained one, one per game.
  const codeIcons = await load("code page icons", () => loadUniverseIcons(recentCodePages.map((page) => page.universe_id)));
  const newCodes: HomeCode[] = (
    await Promise.all(
      recentCodePages.map(async (page) => {
        const [code] = await load("latest codes", () => latestActiveCodes(page, 1));
        if (!code) return null;
        const universeId = page.universe_id ?? -1;
        const wiki = wikiByUniverse.get(universeId);
        return {
          code: code.code,
          reward: code.rewards_text,
          gameName: page.name.replace(/\s+codes$/i, ""),
          href: `/codes/${page.slug}`,
          icon: codeIcons.get(universeId) ?? statsByUniverse.get(universeId)?.iconUrl ?? wiki?.icon_url ?? page.cover_image ?? null,
          firstSeenAt: code.first_seen_at
        } satisfies HomeCode;
      })
    )
  ).filter((code): code is HomeCode => Boolean(code));

  // Events: live, starting soon and just ended.
  const now = Date.now();
  const events = eventsPayload.cards.map(toHomeEvent).filter((event): event is HomeEvent => Boolean(event));
  const eventCards = new Map(eventsPayload.cards.map((card) => [card.slug, card]));
  const startOf = (event: HomeEvent) => timeOf(eventCards.get(event.slug)?.eventStartUtc, now);
  const endOf = (event: HomeEvent) => timeOf(eventCards.get(event.slug)?.eventEndUtc, now);
  const eventGroups = {
    current: events.filter((event) => event.status === "current").sort((a, b) => endOf(a) - endOf(b)).slice(0, 2),
    upcoming: events.filter((event) => event.status === "upcoming").sort((a, b) => startOf(a) - startOf(b)).slice(0, 2),
    past: events.filter((event) => event.status === "past").sort((a, b) => endOf(b) - endOf(a)).slice(0, 2)
  };

  // Games with the most on Bloxodes: wikis ranked by how many page types they have.
  const shelfGames: HomeShelfGame[] = coveredByPlaying
    .filter((wiki) => !switcherIds.has(wiki.universe_id))
    .map((wiki) => {
      const universeId = wiki.universe_id;
      const codePage = codesByUniverse.get(universeId);
      const quiz = quizByUniverse.get(universeId);
      const checklist = checklistByUniverse.get(universeId);
      const event = eventByUniverse.get(universeId);
      const gameTools = toolsByUniverse.get(universeId) ?? [];
      const links: HomeLink[] = [
        codePage ? { href: `/codes/${codePage.slug}`, label: "Codes" } : null,
        { href: `/wiki/${wiki.slug}`, label: "Wiki" },
        quiz ? { href: `/quizzes/${quiz.code}`, label: "Quiz" } : null,
        checklist ? { href: `/checklists/${checklist.slug}`, label: "Checklist" } : null,
        event ? { href: `/events/${event.slug}`, label: "Events" } : null,
        gameTools.length ? { href: `/tools/${gameTools[0].code}`, label: "Tools" } : null
      ].filter((link): link is HomeLink => Boolean(link));
      return { universeId, name: gameNameFromWiki(wiki), href: `/wiki/${wiki.slug}`, image: wikiCover(wiki), links };
    })
    .sort((a, b) => b.links.length - a.links.length)
    .slice(0, 6);

  const guides: HomeGuide[] = articles.map((article) => ({
    slug: article.slug,
    title: article.title,
    gameName: article.universe?.display_name ?? article.universe?.name ?? null,
    image: article.cover_image
  }));

  const recentWikis: HomeWiki[] = wikiPages.slice(0, 6).map((page) => ({
    slug: page.slug,
    title: page.title,
    image: wikiCover(page),
    updatedLabel: ago(page.content_updated_at ?? page.updated_at)
  }));

  // Checklists for the most played games first.
  const playingOf = (universeId: number | null | undefined) =>
    typeof universeId === "number" ? (statsByUniverse.get(universeId)?.playing ?? wikiByUniverse.get(universeId)?.playing ?? 0) : 0;
  const homeChecklists: HomeChecklist[] = [...checklists]
    .sort((a, b) => playingOf(b.universe_id) - playingOf(a.universe_id))
    .slice(0, 5)
    .map((row) => ({
      slug: row.slug,
      title: row.title,
      gameName: row.universe?.display_name ?? row.universe?.name ?? row.title,
      icon: row.universe?.icon_url ?? pickThumbnail(row.universe?.thumbnail_urls),
      tasks: checklistTasks(row)
    }));

  // Quiz of the day: rotate through the quizzes by date.
  const dayIndex = Math.floor(now / 86_400_000);
  const quizPick = quizzes.length ? quizzes[dayIndex % quizzes.length] : null;
  const quizData = quizPick ? await load("featured quiz", () => loadQuizData(quizPick.code)) : null;
  const quizAttempt = quizData && quizPick ? buildServerQuizAttempt(quizData, quizPick.code) : [];
  const firstQuestion = quizAttempt[0] ?? null;
  const quiz: HomeQuiz | null =
    quizPick && firstQuestion
      ? {
          code: quizPick.code,
          gameName: quizPick.universe?.display_name ?? quizPick.universe?.name ?? "Roblox",
          icon: quizPick.universe?.icon_url ?? pickThumbnail(quizPick.universe?.thumbnail_urls),
          questionCount: quizAttempt.length,
          question: {
            id: firstQuestion.id,
            question: firstQuestion.question,
            options: firstQuestion.options.map((option) => ({ id: option.id, text: option.text })),
            correctOptionId: firstQuestion.correctOptionId
          }
        }
      : null;
  const moreQuizzes: Array<HomeLink & { icon: string | null }> = quizzes
    .filter((entry) => entry.code !== quizPick?.code)
    .sort((a, b) => playingOf(b.universe_id) - playingOf(a.universe_id))
    .slice(0, 6)
    .map((entry) => ({
      href: `/quizzes/${entry.code}`,
      label: entry.universe?.display_name ?? entry.universe?.name ?? entry.title,
      icon: entry.universe?.icon_url ?? pickThumbnail(entry.universe?.thumbnail_urls)
    }));

  const catalogByCode = new Map(catalogPages.map((page) => [page.code, page]));
  const catalogCards: HomeCatalogCard[] = (
    await Promise.all(
      CATALOG_PICKS.filter((code) => catalogByCode.has(code)).map(async (code) => {
        const meta = await load("catalog card", () => resolveCatalogCardMeta(code));
        const page = catalogByCode.get(code)!;
        return {
          href: `/catalog/${code}`,
          title: meta.shortLabel ?? (code === AVATAR_CATALOG_MASTER_CODE ? AVATAR_CATALOG_MASTER_TITLE : page.title),
          count: meta.count,
          iconKey: meta.icon
        };
      })
    )
  );

  const franchiseList: Array<HomeFranchise | null> = [
    { href: "/gta", name: "Grand Theft Auto", image: "/images/games/gta.webp", links: GTA_LINKS.slice(0, 3).map(toLink), hubLabel: "GTA hub" },
    { href: "/red-dead", name: "Red Dead", image: "/images/games/red-dead.webp", links: RED_DEAD_LINKS.slice(0, 3).map(toLink), hubLabel: "Red Dead hub" },
    minecraft
      ? {
          href: "/minecraft",
          name: "Minecraft",
          image: resolveMinecraftWikiCoverImage(minecraft),
          links: MINECRAFT_LINKS.slice(2, 5).map(toLink),
          hubLabel: "Minecraft hub"
        }
      : null
  ];
  const franchises = franchiseList.filter((entry): entry is HomeFranchise => Boolean(entry));

  const homePuzzles: HomePuzzle[] = puzzles.slice(0, 6).map((page) => ({
    href: `/puzzles/${page.slug}`,
    name: puzzleCardName(page),
    icon: page.icon_url ?? null
  }));
  const latestPuzzleDate = puzzles.map((page) => page.latest_answer_date).filter((value): value is string => Boolean(value)).sort().pop() ?? null;

  const riser = statsHome.risers[0] ?? null;
  const nextEvent = eventGroups.upcoming[0] ?? eventGroups.current[0] ?? null;
  const liveEvent = eventGroups.current[0] ?? null;

  const generalTools = tools.filter((tool) => typeof tool.universe_id !== "number");
  const topWikis = coveredByPlaying.slice(0, 4);
  const directory: HomeDirectoryGroup[] = [
    {
      title: "Codes",
      icon: "codes",
      links: gamePanels.filter((game) => game.codes).slice(0, 4).map((game) => ({ href: game.codes!.href, label: `${game.name} codes` })),
      more: { href: "/codes", label: `All ${counts.codes.toLocaleString("en-US")} games` }
    },
    {
      title: "Catalog",
      icon: "catalog",
      links: catalogCards.slice(0, 4).map((card) => ({ href: card.href, label: card.title })),
      more: { href: "/catalog", label: "All catalog pages" }
    },
    {
      title: "Stats",
      icon: "stats",
      links: [
        { href: "/stats/games", label: "Game rankings" },
        { href: "/stats/items", label: "Item stats" },
        { href: "/stats/creators", label: "Creator stats" },
        { href: "/stats/reports", label: "Monthly reports" }
      ],
      more: { href: "/stats", label: "Live Roblox stats" }
    },
    {
      title: "Tools",
      icon: "tools",
      links: (generalTools.length ? generalTools : tools).slice(0, 4).map((tool) => ({ href: `/tools/${tool.code}`, label: tool.title })),
      more: { href: "/tools", label: "All tools" }
    },
    {
      title: "Wikis",
      icon: "wiki",
      links: topWikis.map((wiki) => ({ href: `/wiki/${wiki.slug}`, label: wiki.title })),
      more: { href: "/wiki", label: `All ${counts.wiki.toLocaleString("en-US")} wikis` }
    },
    { title: "GTA", icon: "map", links: GTA_LINKS.slice(0, 4).map(toLink), more: { href: "/gta", label: "GTA hub" } },
    { title: "Red Dead", icon: "wiki", links: RED_DEAD_LINKS.slice(0, 4).map(toLink), more: { href: "/red-dead", label: "Red Dead hub" } },
    { title: "Minecraft", icon: "wiki", links: MINECRAFT_LINKS.slice(2, 6).map(toLink), more: { href: "/minecraft", label: "Minecraft hub" } }
  ];

  return {
    counts,
    totals: statsHome.totals,
    topGames: statsHome.topGames.slice(0, 3),
    platformPoints: statsHome.platformChart.points.map((point) => point.players).filter((value): value is number => typeof value === "number"),
    today: {
      code: newCodes[0] ?? null,
      event: nextEvent,
      guide: guides[0] ?? null,
      riser: riser
        ? { name: riser.displayName || riser.name, href: `/stats/games/${riser.slug}`, growthPercent: riser.growth24hPercent, playing: riser.playing }
        : null,
      puzzles: homePuzzles.slice(0, 3).map((puzzle) => puzzle.name),
      puzzleDate: latestPuzzleDate
    },
    checklistTotals: Object.fromEntries(checklists.map((row) => [row.slug, checklistTasks(row) ?? 0])),
    gamePanels,
    newCodes,
    eventGroups,
    liveEventName: liveEvent?.gameName ?? null,
    catalogCards,
    guides,
    recentWikis,
    shelfGames,
    quiz,
    moreQuizzes,
    checklists: homeChecklists,
    franchises,
    puzzles: homePuzzles,
    directory
  };
}

function toLink(link: { href: string; title: string }): HomeLink {
  return { href: link.href, label: link.title };
}

export type HomePageData = Awaited<ReturnType<typeof loadHomePageData>>;
