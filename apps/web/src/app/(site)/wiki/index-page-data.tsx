import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { SiRoblox } from "react-icons/si";
import { ArrowUpRight, Search } from "lucide-react";
import { WikiCard } from "@/components/WikiCard";
import { PagePagination } from "@/components/PagePagination";
import { WikiCollectionCta } from "@/components/wiki/WikiCollectionCta";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { buildWikiCollectionPath } from "@/lib/wiki-collections";
import { loadWikiOverview, type WikiOverview, type WikiIndexPageData } from "@/lib/wiki-index";
import { WIKI_PAGE_SIZE, wikiIndexQuery } from "@/lib/wiki-index-options";
import { formatUpdatedLabel } from "@/lib/updated-label";
import { StatsChartPanel } from "../stats/components/StatsChartPanel";
import { WikiReference, wikiTopics, WIKI_INDEX_DESCRIPTION, WIKI_INDEX_TITLE } from "./index-content";

export { loadWikiIndexPageData } from "@/lib/wiki-index";
export type { WikiIndexPageData } from "@/lib/wiki-index";
export { WIKI_PAGE_SIZE } from "@/lib/wiki-index-options";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const sectionTitle = "text-2xl font-semibold leading-tight text-foreground md:text-3xl";
const quietLink = "rounded-sm underline decoration-border underline-offset-4 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

function RobloxFacts() {
  return <Card className="rounded-lg border-border/60 bg-surface/40 shadow-none">
    <CardContent className="space-y-5 p-5">
      <div className="flex items-center gap-3"><SiRoblox className="h-10 w-10 shrink-0 text-foreground" aria-hidden /><h2 className="text-xl font-semibold text-foreground">Roblox</h2></div>
      <dl className="divide-y divide-border/60 text-sm">
        {[
          ["Type", "Gaming and creation platform"], ["Operator", "Roblox Corporation"], ["Public launch", "2006"],
          ["Creation app", "Roblox Studio"], ["Scripting language", "Luau"], ["Virtual currency", "Robux"]
        ].map(([label, value]) => <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2.5"><dt className="text-muted">{label}</dt><dd className="font-medium text-foreground">{value}</dd></div>)}
      </dl>
      <Button asChild variant="outline" className="w-full"><a href="https://www.roblox.com/">Play on Roblox <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden /></a></Button>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted"><a href="https://about.roblox.com/" className={quietLink}>Official website</a><a href="https://create.roblox.com/docs/studio" className={quietLink}>Creator Hub</a><a href="#creators-and-history" className={quietLink}>History</a></div>
    </CardContent>
  </Card>;
}

function TopicNavigation() {
  return <nav aria-label="Explore Roblox topics" className="grid grid-cols-2 gap-x-5 gap-y-5 sm:gap-x-7 xl:grid-cols-3">
    {wikiTopics.map(({ id, title, icon: Icon, links }) => <div key={id} className="space-y-2">
      <a href={`#${id}`} className="flex items-center gap-2 font-semibold text-foreground hover:text-accent"><Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />{title}</a>
      <ul className="space-y-1.5 text-sm leading-6 text-muted">{links.map(({ label, href }) => <li key={label}><Link href={href} className="rounded-sm transition hover:text-accent hover:underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">{label}</Link></li>)}</ul>
    </div>)}
  </nav>;
}

async function WikiActivity({ overview, allPages }: { overview: Promise<WikiOverview>; allPages: WikiIndexPageData["allPages"] }) {
  const { activity } = await overview;
  if (!activity) return <section aria-labelledby="roblox-activity" className="space-y-3"><h2 id="roblox-activity" className={sectionTitle}>Roblox player activity</h2><p className="text-muted">Activity data is temporarily unavailable. <Link href="/stats/roblox-platform" className={quietLink}>Open platform stats</Link></p></section>;
  const hasTrackedGames = activity.totals.trackedGames > 0;
  const hasTotals = activity.totalsComplete === true && hasTrackedGames && Boolean(activity.totals.lastUpdatedAt);
  return <section aria-labelledby="roblox-activity" className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div className="space-y-2"><h2 id="roblox-activity" className={`scroll-mt-24 ${sectionTitle}`}>Roblox player activity</h2><p className="text-sm text-muted">Players across games tracked by Bloxodes. These are concurrent-player observations, not daily active users.</p></div><Link href="/stats/roblox-platform" className={`text-sm text-muted ${quietLink}`}>Full platform stats</Link></div>
    {hasTrackedGames ? <dl className="flex flex-wrap gap-x-10 gap-y-4 border-y border-border/60 py-4">
      {hasTotals ? <div><dt className="text-sm text-muted">Players in tracked games</dt><dd className="mt-1 text-2xl font-semibold text-foreground">{compact.format(activity.totals.livePlayers)}</dd></div> : null}
      <div><dt className="text-sm text-muted">Games tracked</dt><dd className="mt-1 text-2xl font-semibold text-foreground">{activity.totals.trackedGames.toLocaleString("en-US")}</dd></div>
      {hasTotals && activity.totals.lastUpdatedAt ? <div><dt className="text-sm text-muted">Stats refreshed</dt><dd className="mt-1 text-base text-foreground">{formatUpdatedLabel(activity.totals.lastUpdatedAt)}</dd></div> : null}
    </dl> : <p className="text-sm text-muted">No recent player observations are available in this data source.</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
      <StatsChartPanel title="Players over time" subtitle="Concurrent players across tracked Roblox games" initialChart={activity.chart} chartEndpoint="/api/stats/platform/chart" defaultMetric="players" defaultRange="1d" compact area />
      <div className="min-w-0 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Most-played games</h3>
        {activity.topGames.length ? <ol className="divide-y divide-border/60">{activity.topGames.slice(0, 5).map((game, index) => {
          const wiki = allPages.find((page) => page.universe_id === game.universeId);
          return <li key={game.universeId}><Link href={wiki ? `/wiki/${wiki.slug}` : `/stats/games/${game.slug}`} className="group flex items-center gap-3 py-3">
            <span className="w-4 shrink-0 text-sm text-muted">{index + 1}</span>
            {game.iconUrl ? <Image src={game.iconUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-md object-cover" /> : null}
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground group-hover:text-accent">{game.displayName || game.name}</span><span className="text-xs text-muted">{wiki ? "Game wiki" : "Game stats"}</span></span>
            <span className="shrink-0 text-sm text-foreground">{game.playing == null ? "—" : compact.format(game.playing)}</span>
          </Link></li>;
        })}</ol> : <p className="text-sm text-muted">Game rankings are not available yet.</p>}
      </div>
    </div>
    {activity.genres.length ? <div className="space-y-3"><h3 className="text-lg font-semibold text-foreground">Players by genre</h3><div className="grid gap-x-7 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{activity.genres.slice(0, 6).map((genre) => <Link key={genre.slug} href={`/stats/games?genre=${encodeURIComponent(genre.genre)}`} className="group block space-y-2">
      <div className="flex justify-between gap-3 text-sm"><span className="font-medium text-foreground group-hover:text-accent">{genre.genre}</span><span className="text-muted">{compact.format(genre.playing)} players</span></div>
      <div className="h-1.5 rounded-full bg-border/50" aria-hidden><div className="h-full rounded-full bg-accent/75" style={{ width: `${Math.min(100, Math.max(0, genre.playing / Math.max(1, ...activity.genres.map((item) => item.playing)) * 100))}%` }} /></div>
    </Link>)}</div></div> : null}
  </section>;
}

function Directory({ data }: { data: WikiIndexPageData }) {
  const { pages, total, totalPages, currentPage, options, genres } = data;
  const query = wikiIndexQuery(options);
  const selectClass = "h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  return <section aria-labelledby="game-wikis" className="space-y-5">
    <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="game-wikis" className={`scroll-mt-24 ${sectionTitle}`}>Roblox game wikis</h2><p className="text-sm text-muted">{total.toLocaleString("en-US")} {query ? "matching " : ""}game{total === 1 ? "" : "s"}</p></div>
    <form key={query} action="/wiki#game-wikis" method="get" role="search" aria-label="Find a game wiki" className="grid grid-cols-2 items-end gap-3 xl:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.65fr)_minmax(9rem,0.6fr)_auto]">
      <label className="col-span-2 space-y-2 text-sm font-medium text-foreground xl:col-span-1">Game name<Input name="q" type="search" maxLength={100} defaultValue={options.q} placeholder="Search game wikis" className="h-10 border-border/70 bg-background" /></label>
      <label className="space-y-2 text-sm font-medium text-foreground">Genre<select name="genre" defaultValue={options.genre} className={selectClass}><option value="">All genres</option>{options.genre && !genres.includes(options.genre) ? <option value={options.genre}>{options.genre}</option> : null}{genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}</select></label>
      <label className="space-y-2 text-sm font-medium text-foreground">Sort by<select name="sort" defaultValue={options.sort} className={selectClass}><option value="updated">Recently updated</option><option value="name">Game name A–Z</option><option value="players">Current players</option></select></label>
      <Button type="submit" className="col-span-2 h-10 xl:col-span-1"><Search className="mr-2 h-4 w-4" aria-hidden />Find games</Button>
    </form>
    {query ? <p className="text-sm text-muted"><Link href="/wiki#game-wikis" className={quietLink}>Clear search and filters</Link></p> : null}
    <div id="article-body" className="journey-content-stream journey-content-stream--index">
      {pages.length ? pages.map((page) => <div key={page.id} data-journey-item><WikiCard page={page} /></div>) : <p className="rounded-lg border border-dashed border-border/70 p-6 text-muted">{query ? "No game wikis match these filters. Try another name or choose all genres." : "No game wikis have been published yet."}</p>}
      <PagePagination basePath="/wiki" currentPage={currentPage} totalPages={totalPages} query={query ? `${query}#game-wikis` : ""} />
    </div>
  </section>;
}

async function WikiCollections({ overview }: { overview: Promise<WikiOverview> }) {
  const { collections } = await overview;
  return <section aria-labelledby="game-collections" className="space-y-5">
    <h2 id="game-collections" className={`scroll-mt-24 ${sectionTitle}`}>Game collections</h2>
    <p className="max-w-3xl text-base leading-relaxed text-muted">Equipment, characters, materials, and collectibles belong to each game’s own systems. Open a collection to compare its items and requirements.</p>
    {collections.length ? <div className="grid gap-4 md:grid-cols-2">{collections.map(({ page, images }) => <WikiCollectionCta key={page.code} href={buildWikiCollectionPath(page.wiki_slug, page.collection_slug)} title={page.title} imageUrls={images} />)}</div> : <p className="text-sm text-muted">Available item collections are linked from individual game wikis.</p>}
  </section>;
}

async function WikiUpdates({ overview, allPages }: { overview: Promise<WikiOverview>; allPages: WikiIndexPageData["allPages"] }) {
  const { events, eventsAvailable } = await overview;
  const recent = [...allPages].sort((a, b) => (Date.parse(b.content_updated_at ?? b.updated_at ?? "") || 0) - (Date.parse(a.content_updated_at ?? a.updated_at ?? "") || 0)).slice(0, 5);
  return <aside className="min-w-0 space-y-8">
    <section aria-labelledby="roblox-events" className="space-y-4"><h2 id="roblox-events" className="scroll-mt-24 text-xl font-semibold text-foreground">Events in covered games</h2>
      {events.length ? <ol className="space-y-5 border-l border-border pl-4">{events.map((event) => <li key={event.event_id} className="space-y-1"><p className="text-xs text-muted">{Date.parse(event.start_utc) <= Date.now() ? "Live · Ends " : "Starts "}<time dateTime={Date.parse(event.start_utc) <= Date.now() ? event.end_utc : event.start_utc}>{new Date(Date.parse(event.start_utc) <= Date.now() ? event.end_utc : event.start_utc).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</time> (UTC)</p><Link href={`/wiki/${event.wiki.slug}#events`} className="block text-sm font-semibold text-foreground hover:text-accent">{event.display_title || event.title || "Game event"}</Link><p className="text-xs text-muted">{event.wiki.title.replace(/\s+wiki$/i, "")}</p></li>)}</ol> : eventsAvailable ? <p className="text-sm leading-6 text-muted">No scheduled live or upcoming events are listed for these game wikis.</p> : null}
      {!eventsAvailable ? <p className="text-sm text-muted">The event feed is temporarily unavailable.</p> : null}
      <Link href="/events" className={`inline-block text-sm text-muted ${quietLink}`}>Event guides</Link>
    </section>
    <section aria-labelledby="recent-wiki-updates" className="space-y-4 border-t border-border/60 pt-6"><h2 id="recent-wiki-updates" className="text-xl font-semibold text-foreground">Recently updated wikis</h2><ul className="space-y-4">{recent.map((page) => <li key={page.id}><Link href={`/wiki/${page.slug}`} className="block text-sm font-semibold text-foreground hover:text-accent">{page.title}</Link><p className="mt-1 text-xs text-muted">{formatUpdatedLabel(page.content_updated_at ?? page.updated_at ?? null)}</p></li>)}</ul></section>
    <section className="space-y-3 border-t border-border/60 pt-6"><h2 className="text-xl font-semibold text-foreground">More Roblox references</h2><ul className="space-y-3 text-sm text-muted">{[{ label: "Dictionary and slang", href: "/catalog/roblox-dictionary" }, { label: "Errors and fixes", href: "/catalog/roblox-errors-and-fixes" }, { label: "Music IDs", href: "/catalog/roblox-music-ids" }, { label: "Tools and calculators", href: "/tools" }, { label: "Roblox Support", href: "https://www.roblox.com/support" }].map((link) => <li key={link.href}><Link href={link.href} className={quietLink}>{link.label}</Link></li>)}</ul></section>
  </aside>;
}

export function renderWikiIndexPage(data: WikiIndexPageData) {
  const { pages, currentPage, options, allPages } = data;
  const query = wikiIndexQuery(options);
  const showOverview = currentPage === 1 && !query;
  const canonicalPath = currentPage === 1 ? "/wiki" : `/wiki/page/${currentPage}`;
  const overview = showOverview ? loadWikiOverview(allPages) : null;
  return <div className="space-y-10">
    {showOverview ? (
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">Roblox Wiki</h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted md:text-lg">
          Explore Roblox game wikis, item collections, and gameplay systems.
          Find a game below for its equipment, progression, and mechanics.
        </p>
        <nav aria-label="On this page" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <a href="#game-collections" className={quietLink}>Item collections</a>
          <a href="#roblox-activity" className={quietLink}>Player activity</a>
          <a href="#roblox-reference" className={quietLink}>Roblox reference</a>
        </nav>
      </header>
    ) : <header className="space-y-3"><Link href="/wiki" className={`text-sm text-muted ${quietLink}`}>Roblox Wiki</Link><h1 className="text-3xl font-semibold text-foreground">{query ? "Find a Roblox game wiki" : "Roblox game wikis"}</h1><p className="text-sm text-muted">Page {currentPage} of {data.totalPages}</p></header>}
    <div className="min-w-0 space-y-10">
      <Directory data={data} />
      {overview ? <>
        <Suspense fallback={null}><WikiCollections overview={overview} /></Suspense>
        <Suspense fallback={<p className="text-sm text-muted" role="status">Loading Roblox activity…</p>}>
          <WikiActivity overview={overview} allPages={allPages} />
        </Suspense>
        <section aria-labelledby="roblox-reference" className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 id="roblox-reference" className={`scroll-mt-24 ${sectionTitle}`}>Explore Roblox</h2>
              <p className="max-w-3xl text-base leading-relaxed text-muted md:text-lg">
                Roblox is a gaming and creation platform built around worlds made by its community.
                Its games span roleplay, RPGs, simulators, survival, combat, and more—each with its own rules, equipment, and progression.
              </p>
              <p className="max-w-3xl text-base leading-relaxed text-muted">
                Explore the games, items, and systems of Roblox, from servers and avatars to badges and game passes.
              </p>
            </div>
            <TopicNavigation />
          </div>
          <RobloxFacts />
        </section>
        <div className="grid items-start gap-9 xl:grid-cols-[minmax(0,1fr)_20rem]"><WikiReference /><Suspense fallback={null}><WikiUpdates overview={overview} allPages={allPages} /></Suspense></div>
        <p className="border-t border-border/60 pt-5 text-sm text-muted">Bloxodes is an independent Roblox reference. Platform explanations cite Roblox documentation; live figures describe games tracked by Bloxodes.</p>
      </> : null}
    </div>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org", "@type": "CollectionPage", name: currentPage === 1 ? WIKI_INDEX_TITLE : `Roblox Game Wikis - Page ${currentPage}`,
      description: WIKI_INDEX_DESCRIPTION, url: `${SITE_URL}${canonicalPath}`, inLanguage: "en-US",
      about: { "@type": "SoftwareApplication", name: "Roblox", applicationCategory: "GameApplication", url: "https://www.roblox.com/" },
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
      mainEntity: { "@type": "ItemList", itemListElement: pages.map((page, index) => ({ "@type": "ListItem", position: (currentPage - 1) * WIKI_PAGE_SIZE + index + 1, name: page.title, url: `${SITE_URL}/wiki/${page.slug}` })) }
    }).replace(/</g, "\\u003c") }} />
  </div>;
}
