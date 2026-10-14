import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Calculator,
  CalendarDays,
  HelpCircle,
  LayoutGrid,
  ListChecks,
  Map as MapIcon,
  Newspaper,
  Puzzle,
  Search,
  Ticket,
  TrendingUp,
  type LucideIcon
} from "lucide-react";
import { CardImage } from "@/components/CardImage";
import { CatalogCard } from "@/components/CatalogCard";
import { CopyCodeButton } from "@/components/CopyCodeButton";
import { FeaturedQuizCard } from "@/components/home/FeaturedQuizCard";
import { HomeChecklistProgress } from "@/components/home/HomeChecklistProgress";
import { formatCompactNumber } from "@/lib/stats-format";
import { cn } from "@/lib/utils";
import type { HomeEvent, HomePageData } from "@/lib/home-page-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CATALOG_TONES = ["indigo", "amber", "emerald"] as const;

export const homeCardClass = "rounded-lg border border-border/70 bg-card";

function formatDay(value: string | null): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}` : null;
}

function count(value: number) {
  return value.toLocaleString("en-US");
}

export function SectionHead({ title, href, label, aside }: { title: string; href?: string; label?: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="mb-0 text-xl font-semibold leading-tight text-foreground">{title}</h2>
      {href && label ? (
        <Link href={href} className="shrink-0 text-sm font-semibold text-accent hover:underline">
          {label}
        </Link>
      ) : (
        aside
      )}
    </div>
  );
}

function Thumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-lg bg-surface-muted", className ?? "h-10 w-10")}>
      <CardImage src={src} alt="" />
    </span>
  );
}

export function EventTag({ status }: { status: HomeEvent["status"] }) {
  const label = status === "current" ? "Live now" : status === "upcoming" ? "Starting soon" : "Just ended";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold",
        status === "current" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        status === "upcoming" && "bg-accent/10 text-accent",
        status === "past" && "bg-surface-muted text-muted"
      )}
    >
      {status === "current" ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {label}
    </span>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points
    .map((value, index) => `${((index / (points.length - 1)) * 360).toFixed(1)},${(52 - ((value - min) / range) * 44).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 360 60" preserveAspectRatio="none" className="h-14 w-full" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points={coords} className="text-accent" />
      <line x1="0" y1="59.5" x2="360" y2="59.5" stroke="currentColor" className="text-border" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A2: headline, search and the live player count. */
export function HomeHero({ data }: { data: HomePageData }) {
  const { counts, totals, topGames, platformPoints } = data;
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-center lg:gap-10">
      <div className="min-w-0">
        <h1 className="mb-0 text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl xl:text-[2.75rem]">
          Everything for the Roblox games you play
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted md:text-[1.05rem]">
          {count(counts.codes)} code pages, {count(counts.wiki)} game wikis, {count(counts.articles)} guides and live stats for{" "}
          {count(totals.trackedGames)} Roblox games.
        </p>
        <button
          type="button"
          data-search-trigger
          aria-haspopup="dialog"
          className="mt-6 flex h-12 w-full max-w-xl items-center gap-3 rounded-xl border border-border bg-card px-4 text-left text-base text-muted transition-colors hover:border-accent/60"
        >
          <Search className="h-[18px] w-[18px] shrink-0" aria-hidden />
          Search games, codes and guides
        </button>
      </div>
      <div className={cn(homeCardClass, "p-4 sm:p-5")}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            Live
          </span>
          <Link href="/stats" className="text-sm font-semibold text-accent hover:underline">
            Live stats
          </Link>
        </div>
        <p className="mt-2 text-4xl font-bold tracking-tight text-foreground">{formatCompactNumber(totals.livePlayers)}</p>
        <p className="text-sm text-muted">playing Roblox games right now</p>
        <div className="mt-3">
          <Sparkline points={platformPoints} />
          <p className="mt-1 text-xs text-muted">Last 14 days</p>
        </div>
        <ol className="mt-2 divide-y divide-border/60">
          {topGames.map((game, index) => (
            <li key={game.universeId}>
              <Link href={`/stats/games/${game.slug}`} className="flex items-center gap-2.5 py-2 hover:text-accent">
                <span className="w-3.5 text-xs text-muted">{index + 1}</span>
                <Thumb src={game.iconUrl} className="h-7 w-7 rounded-md" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{game.displayName}</span>
                <span className="text-sm font-semibold">{formatCompactNumber(game.playing)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StripCell({ href, icon: Icon, kicker, title, sub, mono }: {
  href: string;
  icon: LucideIcon;
  kicker: string;
  title: string;
  sub: ReactNode;
  mono?: boolean;
}) {
  return (
    <Link href={href} className="block min-w-[15rem] shrink-0 snap-start px-4 py-3.5 transition-colors hover:bg-secondary/60 lg:min-w-0">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-accent">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {kicker}
      </span>
      <span className={cn("mt-1.5 block truncate text-[0.95rem] font-semibold text-foreground", mono && "font-mono")}>{title}</span>
      <span className="mt-0.5 block truncate text-sm text-muted">{sub}</span>
    </Link>
  );
}

/** A4: one row with the newest thing from each section. */
export function HomeTodayStrip({ data }: { data: HomePageData }) {
  const { code, event, guide, riser, puzzles, puzzleDate } = data.today;
  const day = formatDay(puzzleDate);
  return (
    <section
      aria-label="Today on Bloxodes"
      className={cn(homeCardClass, "flex snap-x divide-x divide-border/70 overflow-x-auto lg:grid lg:grid-cols-5 lg:overflow-visible")}
    >
      {code ? (
        <StripCell href={code.href} icon={Ticket} kicker="Latest code" title={code.code} mono sub={`${code.gameName}${code.reward ? ` · ${code.reward}` : ""}`} />
      ) : null}
      {event ? (
        <StripCell
          href={`/events/${event.slug}`}
          icon={CalendarDays}
          kicker={event.timeLabel ?? (event.status === "current" ? "Live now" : "Starting soon")}
          title={event.gameName}
          sub={event.eventName ?? "Countdown and rewards"}
        />
      ) : null}
      {guide ? <StripCell href={`/articles/${guide.slug}`} icon={Newspaper} kicker="New guide" title={guide.title} sub={guide.gameName ?? "Roblox"} /> : null}
      {riser ? (
        <StripCell
          href={riser.href}
          icon={TrendingUp}
          kicker="Fastest riser"
          title={riser.name}
          sub={
            <>
              {typeof riser.growthPercent === "number" ? (
                <span className="text-emerald-600 dark:text-emerald-400">+{riser.growthPercent.toFixed(1)}%</span>
              ) : null}{" "}
              · {formatCompactNumber(riser.playing)} playing
            </>
          }
        />
      ) : null}
      {puzzles.length ? (
        <StripCell
          href="/puzzles"
          icon={Puzzle}
          kicker="Today's puzzles"
          title={`${puzzles[0]} hints${day ? ` for ${day}` : ""}`}
          sub={puzzles.length > 1 ? `Plus ${puzzles.slice(1).join(" and ")}` : "Daily word games"}
        />
      ) : null}
    </section>
  );
}

/** C1: newest code per game, copyable in place. */
export function HomeNewCodes({ data, className }: { data: HomePageData; className?: string }) {
  if (!data.newCodes.length) return null;
  return (
    <section className={cn("flex flex-col", className)}>
      <SectionHead title="New codes" href="/codes" label="All codes" />
      <ul className={cn(homeCardClass, "flex-1 divide-y divide-border/60")}>
        {data.newCodes.map((code, index) => (
          <li
            key={code.href}
            className={cn(
              "grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_13rem]",
              index >= 5 && "hidden sm:grid"
            )}
          >
            <Thumb src={code.icon} />
            <div className="min-w-0">
              <Link href={code.href} className="block truncate font-semibold text-foreground hover:text-accent">
                {code.gameName}
              </Link>
              <p className="truncate text-sm text-muted">{code.reward ?? "Free rewards"}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <CopyCodeButton
                code={code.code}
                variant="bar"
                label={`Copy ${code.gameName} code ${code.code}`}
                analytics={{ event: "copy_code", params: { code: code.code, source: "home_new_codes" } }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** C4: live, starting soon and just ended. */
export function HomeEvents({ data, className }: { data: HomePageData; className?: string }) {
  const groups = (["current", "upcoming", "past"] as const).filter((status) => data.eventGroups[status].length);
  if (!groups.length) return null;
  return (
    <section className={cn("flex flex-col", className)}>
      <SectionHead title="Roblox events" href="/events" label="Event calendar" />
      <div className={cn(homeCardClass, "flex-1 divide-y divide-border/60")}>
        {groups.map((status) => (
          <div key={status} className="px-4 py-3">
            <EventTag status={status} />
            <ul className="mt-1">
              {data.eventGroups[status].map((event) => (
                <li key={event.slug}>
                  <Link href={`/events/${event.slug}`} className="group flex items-center gap-3 py-2">
                    <Thumb src={event.image} className="h-[3.25rem] w-24 rounded-md" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground group-hover:text-accent">{event.gameName}</span>
                      <span className="block truncate text-sm text-muted">
                        {[event.eventName, event.timeLabel].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** A5: one tile per section. */
export function HomeSectionTiles({ data }: { data: HomePageData }) {
  const { counts } = data;
  const tiles: Array<{ href: string; label: string; sub: string; icon: LucideIcon }> = [
    { href: "/codes", label: "Codes", sub: `${count(counts.codes)} games`, icon: Ticket },
    { href: "/articles", label: "Guides", sub: `${count(counts.articles)} articles`, icon: Newspaper },
    { href: "/wiki", label: "Wikis", sub: `${count(counts.wiki)} games`, icon: BookOpen },
    { href: "/stats", label: "Stats", sub: `${count(data.totals.trackedGames)} games`, icon: BarChart3 },
    { href: "/catalog", label: "Catalog", sub: "Music, decals, items", icon: LayoutGrid },
    { href: "/events", label: "Events", sub: data.liveEventName ? `${data.liveEventName} live now` : `${count(counts.events)} games`, icon: CalendarDays },
    { href: "/quizzes", label: "Quizzes", sub: `${count(counts.quizzes)} games`, icon: HelpCircle },
    { href: "/checklists", label: "Checklists", sub: `${count(counts.checklists)} checklists`, icon: ListChecks },
    { href: "/tools", label: "Tools", sub: `${count(counts.tools)} tools`, icon: Calculator },
    { href: "/puzzles", label: "Puzzles", sub: "Daily word games", icon: Puzzle }
  ];
  return (
    <section>
      <SectionHead title="Browse Bloxodes" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(({ href, label, sub, icon: Icon }) => (
          <Link key={href} href={href} className={cn(homeCardClass, "flex flex-col gap-2.5 p-3.5 transition-colors hover:border-accent/60")}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold text-foreground">{label}</span>
              <span className="block truncate text-sm text-muted">{sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Popular catalog pages, using the catalog index cards. */
export function HomeCatalog({ data }: { data: HomePageData }) {
  if (!data.catalogCards.length) return null;
  return (
    <section>
      <SectionHead title="Popular catalog pages" href="/catalog" label="All catalog pages" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {data.catalogCards.map((card, index) => (
          <CatalogCard key={card.href} href={card.href} title={card.title} count={card.count} iconKey={card.iconKey} tone={CATALOG_TONES[index % CATALOG_TONES.length]} />
        ))}
      </div>
    </section>
  );
}

function GuideRow({ guide }: { guide: HomePageData["guides"][number] }) {
  return (
    <Link href={`/articles/${guide.slug}`} className="group flex gap-3.5 py-3 first:pt-0 last:pb-0">
      <Thumb src={guide.image} className="aspect-video h-auto w-28 rounded-md sm:w-32" />
      <span className="min-w-0">
        {guide.gameName ? <span className="block truncate text-xs text-muted">{guide.gameName}</span> : null}
        <span className="line-clamp-2 font-semibold leading-snug text-foreground group-hover:text-accent">{guide.title}</span>
      </span>
    </Link>
  );
}

/** C3: one lead guide with the next six beside it. */
export function HomeGuides({ data }: { data: HomePageData }) {
  const [lead, ...rest] = data.guides;
  if (!lead) return null;
  const columns = [rest.slice(0, 3), rest.slice(3, 6)].filter((column) => column.length);
  return (
    <section>
      <SectionHead title="Latest guides" href="/articles" label={`All ${count(data.counts.articles)} guides`} />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Link href={`/articles/${lead.slug}`} className="group block">
          <span className="relative block aspect-video overflow-hidden rounded-lg bg-surface-muted">
            <CardImage src={lead.image} alt={lead.title} />
          </span>
          {lead.gameName ? <span className="mt-3 block text-sm text-muted">{lead.gameName}</span> : null}
          <span className="mt-0.5 block text-xl font-bold leading-snug tracking-tight text-foreground group-hover:text-accent sm:text-2xl">{lead.title}</span>
        </Link>
        {columns.map((column, index) => (
          <div key={index} className={cn("divide-y divide-border/60", index > 0 && "hidden xl:block")}>
            {column.map((guide) => (
              <GuideRow key={guide.slug} guide={guide} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/** C11: wikis with the newest edits. */
export function HomeRecentWikis({ data, className }: { data: HomePageData; className?: string }) {
  if (!data.recentWikis.length) return null;
  return (
    <section className={cn("flex flex-col", className)}>
      <SectionHead title="Recently updated wikis" href="/wiki" label={`All ${count(data.counts.wiki)} wikis`} />
      <ul className={cn(homeCardClass, "flex-1 divide-y divide-border/60")}>
        {data.recentWikis.map((wiki) => (
          <li key={wiki.slug}>
            <Link href={`/wiki/${wiki.slug}`} className="group flex items-center gap-3.5 px-4 py-3">
              <Thumb src={wiki.image} className="h-[3.25rem] w-24 rounded-md" />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-foreground group-hover:text-accent">{wiki.title}</span>
                {wiki.updatedLabel ? <span className="block text-sm text-muted">Updated {wiki.updatedLabel}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** B4: covered games with links to each of their page types. */
export function HomeGameShelf({ data, className }: { data: HomePageData; className?: string }) {
  if (!data.shelfGames.length) return null;
  return (
    <section className={className}>
      <SectionHead title="Games with the most on Bloxodes" href="/wiki" label="All games" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        {data.shelfGames.map((game) => (
          <div key={game.universeId} className="min-w-0">
            <Link href={game.href} className="group block">
              <span className="relative block aspect-video overflow-hidden rounded-lg bg-surface-muted">
                <CardImage src={game.image} alt={game.name} />
              </span>
              <span className="mt-2 block truncate font-semibold text-foreground group-hover:text-accent">{game.name}</span>
            </Link>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-[0.8rem] text-muted">
              {game.links.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-accent">
                  {link.label}
                </Link>
              ))}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** B5: GTA, Red Dead and Minecraft. */
export function HomeFranchises({ data, className }: { data: HomePageData; className?: string }) {
  if (!data.franchises.length) return null;
  return (
    <section className={className}>
      <SectionHead title="Beyond Roblox" href="/games" label="All games" />
      <div className="grid gap-4 sm:grid-cols-3">
        {data.franchises.map((franchise) => (
          <div key={franchise.href} className={cn(homeCardClass, "overflow-hidden")}>
            <Link href={franchise.href} className="group block">
              <span className="relative block aspect-video bg-surface-muted">
                <CardImage src={franchise.image} alt={franchise.name} />
              </span>
              <span className="block px-4 pt-3 text-lg font-bold text-foreground group-hover:text-accent">{franchise.name}</span>
            </Link>
            <ul className="divide-y divide-border/60 px-4 pb-2 pt-1 text-sm">
              {franchise.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="block truncate py-2 text-muted hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** C10: today's puzzle answer pages. */
export function HomePuzzles({ data, className }: { data: HomePageData; className?: string }) {
  if (!data.puzzles.length) return null;
  const day = formatDay(data.today.puzzleDate);
  return (
    <section className={cn("flex flex-col", className)}>
      <SectionHead title="Today's puzzle hints" aside={day ? <span className="shrink-0 text-sm text-muted">{day}</span> : null} />
      <div className={cn(homeCardClass, "grid flex-1 grid-cols-3 content-center p-2")}>
        {data.puzzles.map((puzzle) => (
          <Link key={puzzle.href} href={puzzle.href} className="flex flex-col items-center gap-2 rounded-md px-1 py-4 text-center text-sm font-semibold text-foreground transition-colors hover:bg-secondary/60">
            <Thumb src={puzzle.icon} className="h-12 w-12 rounded-xl" />
            <span className="line-clamp-1">{puzzle.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** C5: the first question of one quiz, playable in place. */
export function HomeQuiz({ data, className }: { data: HomePageData; className?: string }) {
  if (!data.quiz) return null;
  return (
    <section className={cn("flex flex-col", className)}>
      <SectionHead title="Quiz of the day" href="/quizzes" label="All quizzes" />
      <div className="flex-1">
        <FeaturedQuizCard quiz={data.quiz} more={data.moreQuizzes} />
      </div>
    </section>
  );
}

/** C6: checklists for the most played games, with saved progress. */
export function HomeChecklists({ data, className }: { data: HomePageData; className?: string }) {
  if (!data.checklists.length) return null;
  return (
    <section className={cn("flex flex-col", className)}>
      <SectionHead title="100% checklists" href="/checklists" label="All checklists" />
      <ul className={cn(homeCardClass, "flex-1 divide-y divide-border/60")}>
        {data.checklists.map((checklist) => (
          <li key={checklist.slug}>
            <Link href={`/checklists/${checklist.slug}`} className="group flex items-center gap-3.5 px-4 py-3">
              <Thumb src={checklist.icon} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-foreground group-hover:text-accent">{checklist.gameName}</span>
                <HomeChecklistProgress slug={checklist.slug} total={checklist.tasks} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const DIRECTORY_ICONS = { codes: Ticket, catalog: LayoutGrid, stats: BarChart3, tools: Calculator, wiki: BookOpen, map: MapIcon } as const;

/** A6: plain links into every section. */
export function HomeDirectory({ data }: { data: HomePageData }) {
  return (
    <section>
      <SectionHead title="More on Bloxodes" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        {data.directory.map((group) => {
          const Icon = DIRECTORY_ICONS[group.icon];
          return (
            <div key={group.title} className="min-w-0">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <Icon className="h-4 w-4 text-accent" aria-hidden />
                {group.title}
              </p>
              <ul className="mt-2.5 space-y-2 text-sm">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="block truncate text-muted hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href={group.more.href} className="font-semibold text-accent hover:underline">
                    {group.more.label}
                  </Link>
                </li>
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
