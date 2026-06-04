import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Clock3,
  ExternalLink,
  Gamepad2,
  Heart,
  IdCard,
  Layers,
  Play,
  Search,
  Star,
  Trophy,
  Users
} from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocalRefreshTime } from "@/app/(site)/stats/components/LocalRefreshTime";
import { StatsChartPanel } from "@/app/(site)/stats/components/StatsChartPanel";
import { StatsRankChartPanel } from "@/app/(site)/stats/components/StatsRankChartPanel";
import {
  STATS_SORT_OPTIONS,
  type StatsGame,
  type StatsGameDetailData,
  type StatsGamesPageData,
  type StatsHomeData,
  type StatsRelatedLink,
  robloxGameUrl
} from "@/lib/stats";
import { formatCompactNumber, formatDelta, formatDeltaPercent, formatFullNumber, formatPercent } from "@/lib/stats-format";
import { cn } from "@/lib/utils";

export function StatsPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-[1800px] -translate-x-1/2 xl:w-[calc(100vw-18rem)]">
      {children}
    </div>
  );
}

function gameImage(game: Pick<StatsGame, "iconUrl" | "name">, size = 44, loading: "eager" | "lazy" = "lazy") {
  if (!game.iconUrl) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-sm font-semibold text-muted" style={{ width: size, height: size }}>
        {game.name.charAt(0)}
      </span>
    );
  }
  return (
    <Image
      src={game.iconUrl}
      alt={`${game.name} icon`}
      width={size}
      height={size}
      loading={loading}
      className="shrink-0 rounded-md border border-border/70 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function DeltaPill({ value, percent }: { value?: number | null; percent?: number | null }) {
  const positive = typeof value === "number" && value > 0;
  const negative = typeof value === "number" && value < 0;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Activity;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
        positive && "bg-emerald-500/10 text-emerald-500",
        negative && "bg-rose-500/10 text-rose-500",
        !positive && !negative && "bg-secondary text-muted"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {percent != null ? formatDeltaPercent(percent) : formatDelta(value)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: ReactNode;
  detail?: string | null;
  icon: typeof Users;
}) {
  return (
    <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
          <Icon className="h-4 w-4 text-accent" aria-hidden />
        </div>
        <p className="mt-3 text-2xl font-semibold leading-none text-foreground">{value}</p>
        {detail ? <p className="mt-2 text-xs font-medium text-muted">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

function formatStatsDate(value?: string | null) {
  if (!value) return "Not tracked";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeStatsDate(value?: string | null) {
  if (!value) return "Not tracked";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs)) return "Not tracked";
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days}d ago`;
  return formatStatsDate(value);
}

function HeaderStat({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: ReactNode;
  icon: typeof Users;
}) {
  return (
    <div className="flex min-w-[96px] shrink-0 flex-col items-center justify-center gap-0.5 border-r border-white/10 px-4 py-1 last:border-r-0">
      <p className="whitespace-nowrap text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p>
      <div className="flex max-w-[150px] items-center justify-center gap-1 text-center text-[13px] font-semibold text-white">
        <Icon className="h-3 w-3 shrink-0 text-white/60" aria-hidden />
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function CompactGameRow({ game, rank, metric }: { game: StatsGame; rank?: number | null; metric?: "playing" | "trend" | "visits" }) {
  const primary = metric === "visits" ? formatCompactNumber(game.visits) : formatCompactNumber(game.playing);
  return (
    <Link
      href={`/stats/games/${game.slug}`}
      className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background/35 px-3 py-3 transition hover:border-accent/70 hover:bg-background/65"
    >
      <span className="w-7 shrink-0 text-center text-xs font-bold text-muted">#{rank ?? game.rank ?? "-"}</span>
      {gameImage(game, 40)}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground group-hover:text-accent">{game.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          {game.genre ? <span>{game.genre}</span> : null}
          {game.ratingPercent != null ? <span>{formatPercent(game.ratingPercent)} rating</span> : null}
        </span>
      </span>
      <span className="text-right">
        <span className="block text-sm font-semibold text-foreground">{metric === "trend" ? game.trendScore : primary}</span>
        <span className="mt-1 block"><DeltaPill value={game.growth24h} percent={game.growth24hPercent} /></span>
      </span>
    </Link>
  );
}

function GameListPanel({ title, games, metric }: { title: string; games: StatsGame[]; metric?: "playing" | "trend" | "visits" }) {
  return (
    <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
      <CardHeader className="border-b border-border/60 p-4">
        <CardTitle className="m-0 text-base font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        {games.length ? games.map((game, index) => <CompactGameRow key={game.universeId} game={game} rank={index + 1} metric={metric} />) : (
          <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted">Not enough hourly movement yet.</div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatsHomeView({ data }: { data: StatsHomeData }) {
  return (
    <div className="stats-surface space-y-6">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Roblox Stats</p>
          <h1 className="mb-0 mt-2 text-3xl font-semibold leading-tight text-foreground md:text-4xl">Live Roblox game stats</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-muted">
            Public Roblox game data tracked by Bloxodes, refreshed regularly for players, creators, and researchers.
          </p>
        </div>
        <form action="/stats/games" className="flex w-full max-w-xl gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input name="q" type="search" placeholder="Search games" className="h-10 rounded-md bg-surface pl-9" />
          </div>
          <Button asChild className="rounded-md">
            <Link href="/stats/games">View all</Link>
          </Button>
        </form>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Top live players"
          value={formatCompactNumber(data.totals.livePlayers)}
          detail={`Top ${formatFullNumber(data.totals.featuredGames)} games by current players`}
          icon={Users}
        />
        <MetricCard label="Tracked games" value={formatFullNumber(data.totals.trackedGames)} detail="Public stats index" icon={Gamepad2} />
        <MetricCard
          label="Top visits"
          value={formatCompactNumber(data.totals.totalVisits)}
          detail={`Top ${formatFullNumber(data.mostVisited.length)} games by visits`}
          icon={Trophy}
        />
        <MetricCard label="Last refresh" value={<LocalRefreshTime value={data.totals.lastUpdatedAt} showZoneDetail />} icon={CalendarDays} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GameListPanel title="Top games right now" games={data.topGames} metric="playing" />
        <GameListPanel title="Fastest risers" games={data.risers} metric="trend" />
      </div>

      <StatsChartPanel title="Platform CCU trend" subtitle="Top tracked games, last 24 hours" chart={data.platformTrend} defaultMetric="players" compact={false} area />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
          <CardHeader className="border-b border-border/60 p-4">
            <CardTitle className="m-0 text-base font-semibold text-foreground">Trending genres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {data.genres.map((genre) => (
              <Link key={genre.slug} href={`/stats/games?genre=${encodeURIComponent(genre.genre)}`} className="block rounded-lg border border-border/60 bg-background/35 p-3 transition hover:border-accent/70">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{genre.genre}</p>
                    <p className="text-xs text-muted">{genre.games} tracked games</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{formatCompactNumber(genre.playing)}</p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/50">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(5, genre.playing / Math.max(1, data.genres[0]?.playing ?? 1) * 100))}%` }} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <GameListPanel title="Most visited games" games={data.mostVisited.slice(0, 8)} metric="visits" />
      </div>
    </div>
  );
}

export function StatsGamesView({ data }: { data: StatsGamesPageData }) {
  const activeGenre = data.filters.genre && data.filters.genre !== "all" ? data.filters.genre : null;
  const title = activeGenre ? `${activeGenre} Roblox game stats` : "Roblox game stats table";
  const description = activeGenre
    ? `Sort ${activeGenre} Roblox games by current players, growth, visits, rating, and tracked peaks.`
    : "Sort public Roblox games by current players, growth, visits, rating, and tracked peaks.";
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Stats", href: "/stats" },
    { label: "Games", href: activeGenre ? "/stats/games" : null },
    ...(activeGenre ? [{ label: activeGenre, href: null }] : [])
  ];
  return (
    <div className="stats-surface space-y-5">
      <header className="space-y-3">
        <PageBreadcrumb items={breadcrumbItems} className="text-xs uppercase tracking-[0.22em] text-muted" />
        <h1 className="mb-0 text-3xl font-semibold leading-tight text-foreground md:text-4xl">{title}</h1>
        <p className="text-sm font-medium text-muted">{description}</p>
      </header>

      <form action="/stats/games" className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_220px_180px_160px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" type="search" defaultValue={data.filters.q} placeholder="Search name or creator" className="h-11 rounded-md border-border/80 bg-surface/60 pl-9 shadow-none" />
        </div>
        <Select name="genre" defaultValue={data.filters.genre || "all"}>
          <SelectTrigger className="h-11 rounded-md border-border/80 bg-surface/60 shadow-none">
            <SelectValue placeholder="Genre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genres</SelectItem>
            {data.genres.map((genre) => <SelectItem key={genre} value={genre}>{genre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select name="sort" defaultValue={data.filters.sort}>
          <SelectTrigger className="h-11 rounded-md border-border/80 bg-surface/60 shadow-none">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {STATS_SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input name="minPlayers" type="number" min="0" defaultValue={data.filters.minPlayers ?? ""} placeholder="Min players" className="h-11 rounded-md border-border/80 bg-surface/60 shadow-none" />
        <Button type="submit" className="h-11 rounded-md px-5">Apply</Button>
      </form>

      <Card className="overflow-hidden rounded-lg border-border/70 bg-surface/80 shadow-none">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-14">Rank</TableHead>
                <TableHead>Game</TableHead>
                <TableHead className="text-right">CCU</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead className="text-right">7d</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Trend</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.games.map((game, index) => (
                <TableRow key={game.universeId} className="border-border/60 hover:bg-background/40">
                  <TableCell className="font-mono text-xs text-muted">#{game.rank ?? (data.page - 1) * 50 + index + 1}</TableCell>
                  <TableCell>
                    <Link href={`/stats/games/${game.slug}`} className="flex items-center gap-3">
                      {gameImage(game, 38)}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground hover:text-accent">{game.name}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                          {game.genre ? <span>{game.genre}</span> : null}
                          {game.creatorName ? <span>{game.creatorName}</span> : null}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCompactNumber(game.playing)}</TableCell>
                  <TableCell className="text-right"><DeltaPill value={game.growth24h} percent={game.growth24hPercent} /></TableCell>
                  <TableCell className="text-right"><DeltaPill value={game.growth7d} percent={game.growth7dPercent} /></TableCell>
                  <TableCell className="text-right">{formatCompactNumber(game.visits)}</TableCell>
                  <TableCell className="text-right">{formatPercent(game.ratingPercent)}</TableCell>
                  <TableCell className="text-right"><Badge variant="outline" className="rounded-md">{game.trendScore}</Badge></TableCell>
                  <TableCell className="text-right text-xs text-muted">{formatRelativeStatsDate(game.updatedAtApi)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2 p-3 md:hidden">
          {data.games.map((game, index) => <CompactGameRow key={game.universeId} game={game} rank={game.rank ?? index + 1} />)}
        </div>
      </Card>

      {data.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-md" aria-disabled={data.page <= 1}>
              <Link href={statsPageHref(data, Math.max(1, data.page - 1))}>Previous</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-md" aria-disabled={data.page >= data.totalPages}>
              <Link href={statsPageHref(data, Math.min(data.totalPages, data.page + 1))}>Next</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function statsPageHref(data: StatsGamesPageData, page: number) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (data.filters.q) params.set("q", data.filters.q);
  if (data.filters.genre && data.filters.genre !== "all") params.set("genre", data.filters.genre);
  if (data.filters.sort !== "playing") params.set("sort", data.filters.sort);
  if (data.filters.minPlayers) params.set("minPlayers", String(data.filters.minPlayers));
  const query = params.toString();
  return query ? `/stats/games?${query}` : "/stats/games";
}

function RelatedLinks({ links }: { links: StatsRelatedLink[] }) {
  if (!links.length) {
    return <p className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted">No linked Bloxodes pages yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Button
          key={`${link.type}-${link.href}`}
          asChild
          variant="outline"
          size="sm"
          className="h-auto min-h-8 max-w-full justify-start whitespace-normal rounded-md py-1.5 text-left leading-snug"
        >
          <Link href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}>
            {link.label}
            {link.href.startsWith("http") ? <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden /> : null}
          </Link>
        </Button>
      ))}
    </div>
  );
}

export function StatsGameDetailView({ data }: { data: StatsGameDetailData }) {
  const { game } = data;
  const wikiLink = data.relatedLinks.find((link) => link.type === "wiki");
  const globalRank = data.initialRankChart.summaries.find((summary) => summary.key === "global")?.currentRank ?? game.rank;
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Stats", href: "/stats" },
    { label: "Games", href: "/stats/games" },
    ...(game.genre ? [{ label: game.genre, href: `/stats/games?genre=${encodeURIComponent(game.genre)}` }] : []),
    ...(game.subgenre ? [{ label: game.subgenre, href: null }] : [])
  ];
  return (
    <div className="stats-surface space-y-5">
      <header className="relative left-1/2 -mt-6 w-screen -translate-x-1/2 overflow-hidden border-b border-border/60 bg-surface pt-6 shadow-none md:-mt-8 md:pt-8 xl:-mt-10 xl:w-[calc(100vw-15.5rem)] xl:pt-10">
        {game.thumbnailUrls[0] || game.iconUrl ? (
          <div className="absolute inset-0">
            <Image src={game.thumbnailUrls[0] ?? game.iconUrl ?? ""} alt="" fill sizes="100vw" className="object-cover opacity-50 blur-[1px] saturate-75" priority />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(6_8_12)_0%,rgba(6,8,12,0.94)_28%,rgba(6,8,12,0.74)_62%,rgb(6_8_12)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent" />

        <div className="relative mx-auto max-w-[1800px] px-4 pb-4 pt-0 md:px-6">
          <PageBreadcrumb items={breadcrumbItems} className="mb-4 text-[11px] uppercase tracking-[0.16em] text-white/50" />
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {gameImage(game, 52, "eager")}
              <div className="min-w-0">
                <h1 className="mb-0 truncate text-2xl font-semibold leading-tight text-white md:text-4xl">{game.name}</h1>
                <p className="mt-0.5 truncate text-xs font-semibold text-white/55 md:text-sm">{game.creatorName ? game.creatorName : "Creator not tracked"}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {wikiLink ? (
                <Button asChild variant="outline" size="sm" className="h-8 rounded-md border-white/15 bg-white/8 px-3 text-white shadow-none hover:bg-white/15">
                  <Link href={wikiLink.href}>
                    Wiki
                    <BookOpen className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              ) : null}
              <Button asChild size="sm" className="h-8 rounded-md px-3">
                <Link href={robloxGameUrl(game)} target="_blank" rel="noopener noreferrer">
                  Play
                  <Play className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>

          <div className="-mx-4 mt-3 overflow-x-auto px-4 md:-mx-6 md:px-6">
            <div className="flex min-w-max items-center justify-center xl:min-w-0">
              <HeaderStat label="Global rank" value={globalRank ? `#${formatFullNumber(globalRank)}` : "Not tracked"} icon={Trophy} />
              <HeaderStat label="24h peak" value={formatCompactNumber(game.peak24h)} icon={ArrowUpRight} />
              <HeaderStat label="Visits" value={formatCompactNumber(game.visits)} icon={Play} />
              <HeaderStat label="Favorites" value={formatCompactNumber(game.favorites)} icon={Heart} />
              <HeaderStat label="Rating" value={formatPercent(game.ratingPercent)} icon={Star} />
              <HeaderStat label="Updated" value={formatRelativeStatsDate(game.updatedAtApi)} icon={Clock3} />
              <HeaderStat label="Created" value={formatStatsDate(game.createdAtApi)} icon={CalendarDays} />
              <HeaderStat label="Genre" value={game.genre ?? "Not tracked"} icon={Layers} />
              <HeaderStat label="Subgenre" value={game.subgenre ?? "Not tracked"} icon={Layers} />
              <HeaderStat label="Maturity" value={game.ageRating ?? "Not tracked"} icon={IdCard} />
            </div>
          </div>
        </div>
      </header>

      <StatsChartPanel
        title={`${game.name} chart`}
        universeId={game.universeId}
        initialChart={data.initialChart}
        defaultMetric="players"
      />

      <StatsRankChartPanel
        title={`${game.name} rank history`}
        universeId={game.universeId}
        initialChart={data.initialRankChart}
      />

      <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
        <CardHeader className="border-b border-border/60 p-4">
          <CardTitle className="m-0 text-base font-semibold text-foreground">Bloxodes pages for this game</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <RelatedLinks links={[...data.relatedLinks, ...data.includedInLists]} />
        </CardContent>
      </Card>

      {data.similarGames.length || data.sameCreator.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.similarGames.length ? <GameListPanel title="Similar games" games={data.similarGames} /> : null}
          {data.sameCreator.length ? <GameListPanel title="Same creator" games={data.sameCreator} /> : null}
        </div>
      ) : null}
    </div>
  );
}
