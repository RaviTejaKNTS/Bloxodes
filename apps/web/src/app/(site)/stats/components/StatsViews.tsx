import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
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
import { StatsGamesAutoSubmit } from "@/app/(site)/stats/components/StatsGamesAutoSubmit";
import { StatsChartPanel } from "@/app/(site)/stats/components/StatsChartPanel";
import { StatsRankChartPanel } from "@/app/(site)/stats/components/StatsRankChartPanel";
import {
  DEFAULT_STATS_GAME_COLUMNS,
  STATS_GAME_COLUMN_OPTIONS,
  STATS_SORT_OPTIONS,
  type StatsGame,
  type StatsGameColumnKey,
  type StatsGameDetailData,
  type StatsGamesPageData,
  type StatsHomeData,
  type StatsRelatedLink,
  type StatsSortKey,
  type StatsSubgenreOption,
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
  icon: Icon,
  href
}: {
  label: string;
  value: ReactNode;
  detail?: string | null;
  icon: typeof Users;
  href?: string;
}) {
  const card = (
    <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none transition hover:border-accent/70 hover:bg-surface">
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

  if (href) {
    return (
      <Link href={href} className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" aria-label={label}>
        {card}
      </Link>
    );
  }

  return card;
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

function GameListPanel({
  title,
  subtitle,
  games,
  metric,
  href
}: {
  title: string;
  subtitle?: string;
  games: StatsGame[];
  metric?: "playing" | "trend" | "visits";
  href?: string;
}) {
  return (
    <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 p-4">
        <div className="min-w-0">
          <CardTitle className="m-0 text-base font-semibold text-foreground">{title}</CardTitle>
          {subtitle ? <p className="mt-1 text-xs font-medium text-muted">{subtitle}</p> : null}
        </div>
        {href ? (
          <Button asChild variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-md border-border/70 bg-background/80 text-muted shadow-none hover:border-accent/70 hover:text-accent">
            <Link href={href} aria-label={`View full ${title.toLowerCase()} list`}>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        {games.length ? games.map((game, index) => <CompactGameRow key={game.universeId} game={game} rank={index + 1} metric={metric} />) : (
          <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted">Not enough hourly movement yet.</div>
        )}
      </CardContent>
    </Card>
  );
}

function selectedSummary(selected: string[], fallback: string) {
  if (!selected.length) return fallback;
  if (selected.length === 1) return selected[0];
  return `${selected.length} selected`;
}

function MultiCheckboxPanel({
  label,
  name,
  summary,
  options,
  selected,
  emptyLabel
}: {
  label: string;
  name: string;
  summary: string;
  options: Array<{ value: string; label: string; detail?: string | null }>;
  selected: string[];
  emptyLabel: string;
}) {
  const selectedSet = new Set(selected);
  const stateKey = `${name}:${selected.join("\u0001")}`;
  return (
    <div key={stateKey} className="min-w-0 space-y-1">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</label>
      <details className="group relative">
        <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-border/80 bg-surface/60 px-3 text-sm font-medium text-foreground shadow-none transition hover:border-border hover:bg-surface marker:hidden">
          <span className="truncate">{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" aria-hidden />
        </summary>
        <div className="absolute z-30 mt-2 max-h-80 w-full min-w-[260px] overflow-y-auto rounded-md border border-border/80 bg-popover p-2 text-popover-foreground shadow-xl">
          {options.length ? options.map((option) => (
            <label key={`${name}-${option.value}-${option.detail ?? ""}`} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-secondary/70">
              <input
                type="checkbox"
                name={name}
                value={option.value}
                defaultChecked={selectedSet.has(option.value)}
                className="mt-0.5 h-4 w-4 rounded border-border bg-background accent-current"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{option.label}</span>
                {option.detail ? <span className="mt-0.5 block truncate text-xs text-muted">{option.detail}</span> : null}
              </span>
            </label>
          )) : (
            <p className="px-2 py-3 text-sm text-muted">{emptyLabel}</p>
          )}
        </div>
      </details>
    </div>
  );
}

function columnsEqual(left: StatsGameColumnKey[], right: StatsGameColumnKey[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function columnHeaderLabel(column: StatsGameColumnKey) {
  if (column === "playing") return "CCU";
  if (column === "growth24h") return "24h";
  if (column === "growth7d") return "7d";
  if (column === "likes") return "Upvotes";
  if (column === "dislikes") return "Downvotes";
  if (column === "peak24h") return "24h peak";
  if (column === "peak7d") return "7d peak";
  if (column === "statsRefresh") return "Refresh";
  return STATS_GAME_COLUMN_OPTIONS.find((option) => option.value === column)?.label ?? column;
}

function isRightAlignedColumn(column: StatsGameColumnKey) {
  return !["rank", "genre", "subgenre", "creator", "ageRating", "created", "updated", "statsRefresh"].includes(column);
}

function sortForStatsColumn(column: StatsGameColumnKey): StatsSortKey | null {
  switch (column) {
    case "rank":
    case "playing":
      return "playing";
    case "growth24h":
      return "growth_24h";
    case "growth7d":
      return "growth_7d";
    case "visits":
      return "visits";
    case "favorites":
      return "favorites";
    case "rating":
      return "rating";
    case "peak24h":
    case "peak7d":
      return "peak";
    case "created":
      return "created";
    case "updated":
    case "statsRefresh":
      return "updated";
    default:
      return null;
  }
}

function SortableTableHead({
  data,
  column,
  label = columnHeaderLabel(column),
  className
}: {
  data: StatsGamesPageData;
  column: StatsGameColumnKey;
  label?: string;
  className?: string;
}) {
  const sort = sortForStatsColumn(column);
  const active = sort === data.filters.sort;
  if (!sort) {
    return <TableHead className={className}>{label}</TableHead>;
  }
  return (
    <TableHead className={className}>
      <Link
        href={statsPageHref(data, 1, { sort })}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm text-muted transition hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          isRightAlignedColumn(column) && "justify-end",
          active && "text-foreground"
        )}
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        {active ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : null}
      </Link>
    </TableHead>
  );
}

function renderStatsColumnValue(game: StatsGame, column: StatsGameColumnKey) {
  switch (column) {
    case "rank":
      return `#${game.rank ?? "-"}`;
    case "playing":
      return formatCompactNumber(game.playing);
    case "growth24h":
      return <DeltaPill value={game.growth24h} percent={game.growth24hPercent} />;
    case "growth7d":
      return <DeltaPill value={game.growth7d} percent={game.growth7dPercent} />;
    case "visits":
      return formatCompactNumber(game.visits);
    case "favorites":
      return formatCompactNumber(game.favorites);
    case "rating":
      return formatPercent(game.ratingPercent);
    case "likes":
      return formatCompactNumber(game.likes);
    case "dislikes":
      return formatCompactNumber(game.dislikes);
    case "genre":
      return game.genre ?? "Not tracked";
    case "subgenre":
      return game.subgenre ?? "Not tracked";
    case "creator":
      return game.creatorName ?? "Not tracked";
    case "ageRating":
      return game.ageRating ?? "Not tracked";
    case "peak24h":
      return formatCompactNumber(game.peak24h);
    case "peak7d":
      return formatCompactNumber(game.peak7d);
    case "created":
      return formatStatsDate(game.createdAtApi);
    case "updated":
      return formatRelativeStatsDate(game.updatedAtApi);
    case "statsRefresh":
      return formatRelativeStatsDate(game.lastStatsRefreshedAt ?? game.lastPlayingRefreshedAt);
    default:
      return null;
  }
}

function StatsGameCardRow({ game, columns }: { game: StatsGame; columns: StatsGameColumnKey[] }) {
  const selected = new Set(columns);
  const detailColumns = columns.filter((column) => !["rank", "playing", "growth24h"].includes(column));
  return (
    <Link
      href={`/stats/games/${game.slug}`}
      className="group block rounded-lg border border-border/60 bg-background/35 px-3 py-3 transition hover:border-accent/70 hover:bg-background/65"
    >
      <div className="flex items-center gap-3">
        {selected.has("rank") ? <span className="w-7 shrink-0 text-center text-xs font-bold text-muted">#{game.rank ?? "-"}</span> : null}
        {gameImage(game, 40)}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground group-hover:text-accent">{game.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            {game.genre ? <span>{game.genre}</span> : null}
            {game.ratingPercent != null ? <span>{formatPercent(game.ratingPercent)} rating</span> : null}
          </span>
        </span>
        <span className="shrink-0 text-right">
          {selected.has("playing") ? <span className="block text-sm font-semibold text-foreground">{formatCompactNumber(game.playing)}</span> : null}
          {selected.has("growth24h") ? <span className="mt-1 block"><DeltaPill value={game.growth24h} percent={game.growth24hPercent} /></span> : null}
        </span>
      </div>
      {detailColumns.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3 text-xs sm:grid-cols-3">
          {detailColumns.map((column) => (
            <span key={column} className="min-w-0">
              <span className="block truncate font-medium uppercase tracking-[0.08em] text-muted">{columnHeaderLabel(column)}</span>
              <span className="mt-1 block truncate font-semibold text-foreground">{renderStatsColumnValue(game, column)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </Link>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Platform CCU"
          value={formatCompactNumber(data.totals.livePlayers)}
          detail={`Across ${formatFullNumber(data.totals.trackedGames)} tracked games`}
          icon={Users}
          href="#platform-ccu-trend"
        />
        <MetricCard label="Tracked games" value={formatFullNumber(data.totals.trackedGames)} detail="Public stats index" icon={Gamepad2} href="/stats/games" />
        <MetricCard
          label="Platform visits"
          value={formatCompactNumber(data.totals.totalVisits)}
          detail={`Across ${formatFullNumber(data.totals.trackedGames)} tracked games`}
          icon={Trophy}
          href="/stats/games?sort=visits"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GameListPanel title="Top games right now" subtitle="Ranked by latest current players; pill shows 24h movement." games={data.topGames} metric="playing" href="/stats/games" />
        <GameListPanel title="Fastest risers" subtitle="Ranked by 24h momentum across active games with meaningful gains." games={data.risers} metric="playing" href="/stats/games?sort=growth_24h" />
      </div>

      <div id="platform-ccu-trend" className="scroll-mt-24">
        <StatsChartPanel title="Platform CCU trend" subtitle="Tracked Roblox games, last 24 hours" chart={data.platformTrend} defaultMetric="players" compact={false} area />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
          <CardHeader className="border-b border-border/60 p-4">
            <CardTitle className="m-0 text-base font-semibold text-foreground">Trending genres</CardTitle>
            <p className="mt-1 text-xs font-medium text-muted">Ranked by current players across top tracked games.</p>
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
        <GameListPanel title="Most visited games" games={data.mostVisited.slice(0, 8)} metric="visits" href="/stats/games?sort=visits" />
      </div>
    </div>
  );
}

export function StatsGamesView({ data }: { data: StatsGamesPageData }) {
  const activeGenres = data.filters.genres;
  const activeSubgenres = data.filters.subgenres;
  const activeGenre = activeGenres.length === 1 ? activeGenres[0] : null;
  const title = activeGenre ? `${activeGenre} Roblox game stats` : "Roblox game stats table";
  const description = activeGenre
    ? `Sort ${activeGenre} Roblox games by current players, growth, visits, rating, and tracked peaks.`
    : "Sort public Roblox games by current players, growth, visits, rating, and tracked peaks.";
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Stats", href: "/stats" },
    { label: "Games", href: activeGenres.length ? "/stats/games" : null },
    ...(activeGenre ? [{ label: activeGenre, href: null }] : activeGenres.length ? [{ label: `${activeGenres.length} genres`, href: null }] : [])
  ];
  const activeGenreSet = new Set(activeGenres);
  const showSubgenreFilter = activeGenres.length > 0;
  const subgenreOptions = showSubgenreFilter
    ? data.subgenres.filter((option) => activeGenreSet.has(option.genre) || activeSubgenres.includes(option.subgenre))
    : [];
  const subgenreChoices = subgenreOptions.map((option: StatsSubgenreOption) => ({
    value: option.subgenre,
    label: option.subgenre,
    detail: `${option.genre} • ${formatCompactNumber(option.playing)} players`
  }));
  const genreChoices = data.genres.map((genre) => ({ value: genre, label: genre }));
  const columnChoices = STATS_GAME_COLUMN_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
  const visibleColumns = STATS_GAME_COLUMN_OPTIONS
    .map((option) => option.value)
    .filter((column) => data.filters.columns.includes(column));
  const dataColumns = visibleColumns.filter((column) => column !== "rank");
  const usesDefaultColumns = columnsEqual(data.filters.columns, DEFAULT_STATS_GAME_COLUMNS);
  const formStateKey = [
    data.filters.q,
    data.filters.sort,
    data.filters.minPlayers ?? "",
    activeGenres.join("\u0001"),
    activeSubgenres.join("\u0001"),
    data.filters.columns.join("\u0001")
  ].join("\u0002");
  return (
    <form key={formStateKey} action="/stats/games" className="stats-surface space-y-5" data-stats-games-form>
      <StatsGamesAutoSubmit />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <PageBreadcrumb items={breadcrumbItems} className="text-xs uppercase tracking-[0.22em] text-muted" />
          <div>
            <h1 className="mb-0 text-3xl font-semibold leading-tight text-foreground md:text-4xl">{title}</h1>
            <p className="mt-2 text-sm font-medium text-muted">{description}</p>
          </div>
        </div>
        <div className="flex w-full max-w-xl gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input id="stats-game-search" name="q" type="search" defaultValue={data.filters.q} placeholder="Search games" className="h-10 rounded-md border-0 bg-surface pl-9 shadow-none" />
          </div>
          <Button type="submit" className="h-10 rounded-md px-4">Search</Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-2 md:grid-cols-[minmax(150px,1fr)_minmax(170px,1fr)_minmax(150px,0.9fr)]">
          <MultiCheckboxPanel
            label="Genre"
            name="genre"
            summary={selectedSummary(activeGenres, "All genres")}
            options={genreChoices}
            selected={activeGenres}
            emptyLabel="No genres available."
          />
          {showSubgenreFilter ? (
            <MultiCheckboxPanel
              label="Subgenre"
              name="subgenre"
              summary={selectedSummary(activeSubgenres, activeGenres.length === 1 ? `${activeGenres[0]} subgenres` : "Selected genre subgenres")}
              options={subgenreChoices}
              selected={activeSubgenres}
              emptyLabel="No subgenres in selected genres."
            />
          ) : null}
          <div className="space-y-1 md:hidden">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Sort by</label>
            <Select name="sort" defaultValue={data.filters.sort}>
              <SelectTrigger className="h-10 rounded-md border-border/80 bg-surface/60 shadow-none hover:border-border hover:bg-surface">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {STATS_SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <MultiCheckboxPanel
            label="Columns"
            name="column"
            summary={usesDefaultColumns ? "Default columns" : `${data.filters.columns.length} columns`}
            options={columnChoices}
            selected={data.filters.columns}
            emptyLabel="No columns available."
          />
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild type="button" variant="ghost" className="h-10 rounded-md px-4">
            <Link href="/stats/games" data-stats-games-reset>Reset</Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-lg border-border/70 bg-surface/80 shadow-none">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {visibleColumns.includes("rank") ? <SortableTableHead data={data} column="rank" className="w-14" /> : null}
                <TableHead>Game</TableHead>
                {dataColumns.map((column) => (
                  <SortableTableHead key={column} data={data} column={column} className={cn(isRightAlignedColumn(column) && "text-right")} />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.games.map((game) => (
                <TableRow key={game.universeId} className="border-border/60 hover:bg-background/40">
                  {visibleColumns.includes("rank") ? <TableCell className="font-mono text-xs text-muted">#{game.rank ?? "-"}</TableCell> : null}
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
                  {dataColumns.map((column) => (
                    <TableCell key={`${game.universeId}-${column}`} className={cn(isRightAlignedColumn(column) && "text-right", ["created", "updated", "statsRefresh"].includes(column) && "text-xs text-muted", column === "playing" && "font-semibold")}>
                      {renderStatsColumnValue(game, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2 p-3 md:hidden">
          {data.games.map((game) => <StatsGameCardRow key={game.universeId} game={game} columns={visibleColumns} />)}
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
    </form>
  );
}

function statsPageHref(data: StatsGamesPageData, page: number, overrides: { sort?: StatsSortKey } = {}) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (data.filters.q) params.set("q", data.filters.q);
  for (const genre of data.filters.genres) params.append("genre", genre);
  for (const subgenre of data.filters.subgenres) params.append("subgenre", subgenre);
  const sort = overrides.sort ?? data.filters.sort;
  if (sort !== "playing") params.set("sort", sort);
  if (data.filters.minPlayers) params.set("minPlayers", String(data.filters.minPlayers));
  if (!columnsEqual(data.filters.columns, DEFAULT_STATS_GAME_COLUMNS)) {
    for (const column of data.filters.columns) params.append("column", column);
  }
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
