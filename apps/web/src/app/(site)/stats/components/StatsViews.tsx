import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  Eye,
  ExternalLink,
  Gamepad2,
  Heart,
  IdCard,
  Layers,
  Play,
  Search,
  ShoppingBag,
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
import { StatsItemImage } from "@/app/(site)/stats/components/StatsItemImage";
import { StatsItemChartPanel } from "@/app/(site)/stats/components/StatsItemChartPanel";
import { StatsRankChartPanel } from "@/app/(site)/stats/components/StatsRankChartPanel";
import { StatsVisitShareChartPanel } from "@/app/(site)/stats/components/StatsVisitShareChartPanel";
import {
  DEFAULT_STATS_GAME_COLUMNS,
  STATS_CREATOR_SORT_OPTIONS,
  STATS_GAME_COLUMN_OPTIONS,
  STATS_ITEM_CATEGORY_OPTIONS,
  STATS_ITEM_CREATOR_OPTIONS,
  STATS_ITEM_SALE_OPTIONS,
  STATS_ITEM_SORT_OPTIONS,
  STATS_ITEM_SUBCATEGORY_OPTIONS,
  STATS_SORT_OPTIONS,
  type StatsCreator,
  type StatsCreatorSortKey,
  type StatsCreatorTypeFilter,
  type StatsCreatorsPageData,
  type StatsGame,
  type StatsGameColumnKey,
  type StatsGameDetailData,
  type StatsGamesPageData,
  type StatsHomeData,
  type StatsItem,
  type StatsItemDetailData,
  type StatsItemSortKey,
  type StatsItemsPageData,
  type StatsPlatformPageData,
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

function itemImage(item: Pick<StatsItem, "thumbnailUrl" | "name">, size = 44, loading: "eager" | "lazy" = "lazy") {
  return (
    <StatsItemImage
      src={item.thumbnailUrl}
      alt={`${item.name} thumbnail`}
      size={size}
      loading={loading}
    />
  );
}

function itemStatsHref(item: Pick<StatsItem, "assetId" | "itemType">) {
  const routeId = item.itemType === "Bundle" ? Math.abs(item.assetId) : item.assetId;
  return `/stats/items/${routeId}`;
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

function GameDetailStatCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: ReactNode;
  icon: typeof Users;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border/70 bg-surface/80 px-3 py-3 shadow-none">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-background/70 text-muted">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-0 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
        <p className="mt-1 truncate text-lg font-semibold leading-none text-foreground">{value}</p>
      </div>
    </div>
  );
}

function GameDetailStatsRow({ game }: { game: StatsGame }) {
  const stats = [
    { icon: Users, label: game.playing == null ? "Current players" : "Playing now", value: game.playing == null ? "Unavailable" : formatCompactNumber(game.playing) },
    { icon: Eye, label: "Total visits", value: formatCompactNumber(game.visits) },
    { icon: Star, label: "Favorites", value: formatCompactNumber(game.favorites) }
  ];

  return (
    <section aria-label={`${game.name} headline stats`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <GameDetailStatCard key={stat.label} {...stat} />
      ))}
    </section>
  );
}

function CompactGameRow({ game, rank, metric }: { game: StatsGame; rank?: number | null; metric?: "playing" | "trend" | "visits" }) {
  const primary = metric === "visits" ? formatCompactNumber(game.visits) : formatCompactNumber(game.playing);
  return (
    <Link
      href={`/stats/games/${game.slug}`}
      className="group grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-background/35 px-3 py-3 transition hover:border-accent/70 hover:bg-background/65 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]"
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
      <span className="col-span-3 flex min-w-0 items-center justify-between gap-3 rounded-md bg-surface/60 px-2 py-1.5 text-left sm:col-span-1 sm:block sm:bg-transparent sm:p-0 sm:text-right">
        <span className="block text-sm font-semibold text-foreground">{metric === "trend" ? game.trendScore : primary}</span>
        <span className="block sm:mt-1"><DeltaPill value={game.growth24h} percent={game.growth24hPercent} /></span>
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
  return !["rank", "genre", "subgenre", "creator", "ageRating"].includes(column);
}

function isCenterAlignedColumn(column: StatsGameColumnKey) {
  return column === "rank";
}

const STATS_GAME_COLUMN_WIDTHS: Record<StatsGameColumnKey, number> = {
  rank: 64,
  playing: 112,
  growth24h: 126,
  growth7d: 126,
  visits: 116,
  favorites: 120,
  rating: 96,
  likes: 112,
  dislikes: 124,
  genre: 160,
  subgenre: 190,
  creator: 220,
  ageRating: 120,
  peak24h: 112,
  peak7d: 112,
  created: 128,
  updated: 112,
  statsRefresh: 112
};

function statsGamesTableMinWidth(columns: StatsGameColumnKey[]) {
  const gameColumnWidth = 320;
  return Math.max(980, gameColumnWidth + columns.reduce((total, column) => total + STATS_GAME_COLUMN_WIDTHS[column], 0));
}

function statsColumnWidthClass(column: StatsGameColumnKey) {
  switch (column) {
    case "rank":
      return "w-16 min-w-16";
    case "playing":
      return "min-w-[112px]";
    case "growth24h":
    case "growth7d":
      return "min-w-[126px]";
    case "visits":
      return "min-w-[116px]";
    case "favorites":
      return "min-w-[120px]";
    case "rating":
      return "min-w-24";
    case "likes":
      return "min-w-[112px]";
    case "dislikes":
      return "min-w-[124px]";
    case "genre":
      return "min-w-40 max-w-[210px] whitespace-normal leading-snug";
    case "subgenre":
      return "min-w-[190px] max-w-[260px] whitespace-normal leading-snug";
    case "creator":
      return "min-w-[220px] max-w-[300px] whitespace-normal leading-snug";
    case "ageRating":
      return "min-w-[120px] whitespace-normal leading-snug";
    case "peak24h":
    case "peak7d":
      return "min-w-[112px]";
    case "created":
      return "min-w-32 whitespace-normal leading-snug";
    case "updated":
    case "statsRefresh":
      return "min-w-[112px]";
    default:
      return undefined;
  }
}

function statsColumnCellClass(column: StatsGameColumnKey) {
  const wraps = ["genre", "subgenre", "creator", "ageRating", "created"].includes(column);
  return cn(
    statsColumnWidthClass(column),
    "align-middle",
    wraps ? "whitespace-normal leading-snug" : "whitespace-nowrap",
    isCenterAlignedColumn(column) ? "text-center" : isRightAlignedColumn(column) ? "text-right" : "text-left"
  );
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
    case "likes":
      return "likes";
    case "dislikes":
      return "dislikes";
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
          "inline-flex w-full items-center gap-1 rounded-sm text-muted transition hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          isRightAlignedColumn(column) && "justify-end",
          isCenterAlignedColumn(column) && "justify-center",
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
      return game.ratingPercent != null ? formatPercent(game.ratingPercent) : "Unrated";
    case "likes":
      return formatCompactNumber(game.likes);
    case "dislikes":
      return formatCompactNumber(game.dislikes);
    case "genre":
      return game.genre ?? <span className="text-muted">-</span>;
    case "subgenre":
      return game.subgenre ?? <span className="text-muted">-</span>;
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
            Public Roblox game data tracked by Bloxodes, refreshed regularly for players and researchers.
          </p>
          <Link className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline" href="/stats/reports">
            <BookOpen className="h-4 w-4" aria-hidden />
            Monthly Roblox reports
          </Link>
        </div>
        <form action="/stats/games" className="flex w-full max-w-xl gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input name="q" type="search" placeholder="Search games" className="h-10 rounded-md bg-surface pl-9" />
          </div>
          <Button asChild className="rounded-md">
            <Link href="/stats/games">Games</Link>
          </Button>
        </form>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Platform CCU"
          value={formatCompactNumber(data.totals.livePlayers)}
          detail={`Across ${formatFullNumber(data.totals.trackedGames)} tracked games`}
          icon={Users}
          href="/stats/roblox-platform"
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
        <StatsChartPanel
          title="Platform CCU trend"
          subtitle="Tracked Roblox games"
          initialChart={data.platformChart}
          chartEndpoint="/api/stats/platform/chart"
          defaultMetric="players"
          defaultRange="14d"
          autoDailyForMultiDayRange
          compact={false}
          area
        />
      </div>

      <StatsVisitShareChartPanel initialChart={data.visitShareChart} />

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

export function StatsPlatformView({ data }: { data: StatsPlatformPageData }) {
  const breadcrumbItems = [
    { label: "Stats", href: "/stats" },
    { label: "Roblox Platform" }
  ];
  return (
    <div className="stats-surface space-y-6">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <PageBreadcrumb items={breadcrumbItems} className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Platform Stats</p>
          <h1 className="mb-0 mt-2 text-3xl font-semibold leading-tight text-foreground md:text-4xl">Roblox platform stats</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-muted">
            Aggregate Roblox activity across games tracked by Bloxodes, with current players, visits, genre mix, and mover lists.
          </p>
        </div>
        <Button asChild variant="outline" className="h-10 rounded-md border-border/70 bg-surface shadow-none">
          <Link href="/stats/games">
            Browse games
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Platform CCU"
          value={formatCompactNumber(data.totals.livePlayers)}
          detail="Latest tracked-game total"
          icon={Users}
        />
        <MetricCard
          label="Tracked games"
          value={formatFullNumber(data.totals.trackedGames)}
          detail="Public stats index"
          icon={Gamepad2}
          href="/stats/games"
        />
        <MetricCard
          label="Platform visits"
          value={formatCompactNumber(data.totals.totalVisits)}
          detail="Tracked-game total visits"
          icon={Eye}
          href="/stats/games?sort=visits"
        />
        <MetricCard
          label="Freshness"
          value={formatRelativeStatsDate(data.totals.lastUpdatedAt)}
          detail="Latest stats index refresh"
          icon={Clock3}
        />
      </div>

      <StatsChartPanel
        title="Roblox platform trend"
        subtitle="Aggregate tracked-game players, visits, favorites, and rating"
        initialChart={data.chart}
        chartEndpoint="/api/stats/platform/chart"
        defaultMetric="players"
        defaultRange="1d"
        area
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <GameListPanel title="Top games right now" subtitle="Largest contributors to platform CCU." games={data.topGames} metric="playing" href="/stats/games" />
        <GameListPanel title="Fastest risers" subtitle="Games adding the most players over the last 24 hours." games={data.risers} metric="playing" href="/stats/games?sort=growth_24h" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
          <CardHeader className="border-b border-border/60 p-4">
            <CardTitle className="m-0 text-base font-semibold text-foreground">Platform genre mix</CardTitle>
            <p className="mt-1 text-xs font-medium text-muted">Current players grouped by tracked Roblox genre.</p>
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
        <GameListPanel title="Most visited games" subtitle="Long-running traffic leaders in the tracked game index." games={data.mostVisited} metric="visits" href="/stats/games?sort=visits" />
      </div>
    </div>
  );
}

function prettyStatsItemLabel(value: string | null | undefined) {
  if (!value) return "All";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bT Shirt\b/g, "T-Shirt")
    .replace(/\bDress Skirt\b/g, "Dresses & skirts")
    .replace(/\bBody Parts Bundles\b/g, "Full bodies")
    .replace(/\bAvatar Animations\b/g, "Avatar animations")
    .trim();
}

function itemPriceLabel(value: number | null | undefined) {
  if (value == null) return "-";
  if (value === 0) return "Free";
  return `R$ ${formatFullNumber(value)}`;
}

function itemPageHref(
  data: StatsItemsPageData,
  page: number,
  overrides: Partial<Pick<StatsItemsPageData["filters"], "sort" | "category" | "subcategory" | "sale" | "creator">> = {}
) {
  const params = new URLSearchParams();
  if (data.filters.q) params.set("q", data.filters.q);
  const sort = overrides.sort ?? data.filters.sort;
  const category = overrides.category ?? data.filters.category;
  const subcategory = overrides.subcategory ?? data.filters.subcategory;
  const sale = overrides.sale ?? data.filters.sale;
  const creator = overrides.creator ?? data.filters.creator;
  if (sort !== "favorites") params.set("sort", sort);
  if (category) params.set("category", category);
  if (subcategory) params.set("subcategory", subcategory);
  if (sale !== "all") params.set("sale", sale);
  if (creator !== "all") params.set("creator", creator);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/stats/items?${query}` : "/stats/items";
}

function StatsItemSortableTableHead({
  data,
  sort,
  label,
  className
}: {
  data: StatsItemsPageData;
  sort: StatsItemSortKey;
  label: string;
  className?: string;
}) {
  const active = sort === data.filters.sort;
  return (
    <TableHead className={className}>
      <Link
        href={itemPageHref(data, 1, { sort })}
        className={cn(
          "inline-flex w-full items-center justify-end gap-1 rounded-sm text-muted transition hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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

function StatsItemMobileCard({ item }: { item: StatsItem }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="w-7 shrink-0 pt-1 text-center text-xs font-bold text-muted">#{item.rank ?? "-"}</span>
        {itemImage(item, 44)}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link href={itemStatsHref(item)} className="mb-0 truncate text-sm font-semibold text-foreground hover:text-accent">
              {item.name}
            </Link>
            {item.creatorHasVerifiedBadge ? <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]"><BadgeCheck className="mr-1 h-3 w-3" aria-hidden />Verified</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">{prettyStatsItemLabel(item.category)} / {prettyStatsItemLabel(item.subcategory)}</p>
          <p className="mt-1 truncate text-xs text-muted">{item.creatorName}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="mb-0 text-sm font-semibold text-foreground">{formatCompactNumber(item.favoriteCount)}</p>
          <p className="text-[11px] font-medium text-muted">favorites</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3 text-xs sm:grid-cols-3">
        <span>
          <span className="block font-medium uppercase tracking-[0.08em] text-muted">Price</span>
          <span className="mt-1 block font-semibold text-foreground">{itemPriceLabel(item.priceRobux)}</span>
        </span>
        <span>
          <span className="block font-medium uppercase tracking-[0.08em] text-muted">Resale</span>
          <span className="mt-1 block font-semibold text-foreground">{item.hasResellers ? itemPriceLabel(item.lowestResalePriceRobux) : "-"}</span>
        </span>
        <span>
          <span className="block font-medium uppercase tracking-[0.08em] text-muted">Seen</span>
          <span className="mt-1 block font-semibold text-foreground">{formatRelativeStatsDate(item.lastSeenAt)}</span>
        </span>
      </div>
      <Button asChild variant="outline" className="mt-3 h-9 w-full rounded-md">
        <Link href={itemStatsHref(item)}>
          <BarChart3 className="mr-2 h-4 w-4" aria-hidden />Stats
        </Link>
      </Button>
    </div>
  );
}

export function StatsItemsView({ data }: { data: StatsItemsPageData }) {
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Stats", href: "/stats" },
    { label: "Items", href: null }
  ];
  const formStateKey = [data.filters.q, data.filters.sort, data.filters.category, data.filters.subcategory, data.filters.sale, data.filters.creator].join("\u0002");
  const subcategoryOptions = data.filters.category
    ? STATS_ITEM_SUBCATEGORY_OPTIONS[data.filters.category] ?? []
    : Object.values(STATS_ITEM_SUBCATEGORY_OPTIONS).flat();

  return (
    <form key={formStateKey} action="/stats/items" className="stats-surface space-y-5" data-stats-games-form>
      <StatsGamesAutoSubmit />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <PageBreadcrumb items={breadcrumbItems} className="text-xs uppercase tracking-[0.22em] text-muted" />
          <div>
            <h1 className="mb-0 text-3xl font-semibold leading-tight text-foreground md:text-4xl">Roblox item stats</h1>
            <p className="mt-2 text-sm font-medium text-muted">
              Search Roblox marketplace items by favorites, price, resale, category, creator, and recent catalog sightings.
            </p>
          </div>
        </div>
        <div className="flex w-full max-w-xl gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input name="q" type="search" defaultValue={data.filters.q} placeholder="Search items" className="h-10 rounded-md border-0 bg-surface pl-9 shadow-none" />
          </div>
          <Button type="submit" className="h-10 rounded-md px-4">Search</Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Category</label>
            <Select name="category" defaultValue={data.filters.category || "all"}>
              <SelectTrigger className="h-10 rounded-md border-border/80 bg-surface/60 shadow-none hover:border-border hover:bg-surface">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {STATS_ITEM_CATEGORY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Type</label>
            <Select name="subcategory" defaultValue={data.filters.subcategory || "all"}>
              <SelectTrigger className="h-10 rounded-md border-border/80 bg-surface/60 shadow-none hover:border-border hover:bg-surface">
                <SelectValue placeholder="Item type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {subcategoryOptions.map((option) => <SelectItem key={`${option.value}-${option.label}`} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Sale</label>
            <Select name="sale" defaultValue={data.filters.sale}>
              <SelectTrigger className="h-10 rounded-md border-border/80 bg-surface/60 shadow-none hover:border-border hover:bg-surface">
                <SelectValue placeholder="Sale state" />
              </SelectTrigger>
              <SelectContent>
                {STATS_ITEM_SALE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Creator</label>
            <Select name="creator" defaultValue={data.filters.creator}>
              <SelectTrigger className="h-10 rounded-md border-border/80 bg-surface/60 shadow-none hover:border-border hover:bg-surface">
                <SelectValue placeholder="Creator" />
              </SelectTrigger>
              <SelectContent>
                {STATS_ITEM_CREATOR_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Sort by</label>
            <Select name="sort" defaultValue={data.filters.sort}>
              <SelectTrigger className="h-10 rounded-md border-border/80 bg-surface/60 shadow-none hover:border-border hover:bg-surface">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {STATS_ITEM_SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button asChild type="button" variant="ghost" className="h-10 rounded-md px-4">
          <Link href="/stats/items" data-stats-games-reset>Reset</Link>
        </Button>
      </div>

      <Card className="overflow-hidden rounded-lg border-border/70 bg-surface/80 shadow-none">
        <div className="hidden overflow-x-auto md:block">
          <Table className="min-w-[1240px] table-auto">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead className="min-w-[340px] text-left">Item</TableHead>
                <TableHead className="min-w-[180px] text-left">Creator</TableHead>
                <StatsItemSortableTableHead data={data} sort="favorites" label="Favorites" className="min-w-[120px] text-right" />
                <StatsItemSortableTableHead data={data} sort="price_high" label="Price" className="min-w-[110px] text-right" />
                <StatsItemSortableTableHead data={data} sort="resale_low" label="Resale" className="min-w-[110px] text-right" />
                <TableHead className="min-w-[170px] text-left">Category</TableHead>
                <StatsItemSortableTableHead data={data} sort="updated" label="Seen" className="min-w-[112px] text-right" />
                <TableHead className="min-w-[96px] text-right">Roblox</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.assetId} className="border-border/60 hover:bg-background/40">
                  <TableCell className="w-16 text-center font-mono text-xs text-muted">#{item.rank ?? "-"}</TableCell>
                  <TableCell className="min-w-[340px] align-middle">
                    <div className="flex min-w-0 items-center gap-3">
                      <Link href={itemStatsHref(item)} aria-label={`Open stats for ${item.name}`}>
                        {itemImage(item, 42)}
                      </Link>
                      <div className="min-w-0">
                        <Link href={itemStatsHref(item)} className="block truncate text-sm font-semibold text-foreground hover:text-accent">
                          {item.name}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-muted">{item.itemType} #{item.assetId}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[180px]">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm text-foreground">{item.creatorName}</span>
                      {item.creatorHasVerifiedBadge ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden /> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCompactNumber(item.favoriteCount)}</TableCell>
                  <TableCell className="text-right">{itemPriceLabel(item.priceRobux)}</TableCell>
                  <TableCell className="text-right">{item.hasResellers ? itemPriceLabel(item.lowestResalePriceRobux) : <span className="text-muted">-</span>}</TableCell>
                  <TableCell className="min-w-[170px]">
                    <span className="block text-sm text-foreground">{prettyStatsItemLabel(item.category)}</span>
                    <span className="text-xs text-muted">{prettyStatsItemLabel(item.subcategory)}</span>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted">{formatRelativeStatsDate(item.lastSeenAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2">
                      <Link href={item.robloxUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.name} on Roblox`}>
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2 p-3 md:hidden">
          {data.items.map((item) => <StatsItemMobileCard key={item.assetId} item={item} />)}
        </div>

        {!data.items.length ? (
          <div className="border-t border-border/60 p-8 text-center text-sm text-muted">No items match the current filters.</div>
        ) : null}
      </Card>

      {data.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-md" aria-disabled={data.page <= 1}>
              <Link href={itemPageHref(data, Math.max(1, data.page - 1))}>Previous</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-md" aria-disabled={data.page >= data.totalPages}>
              <Link href={itemPageHref(data, Math.min(data.totalPages, data.page + 1))}>Next</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function StatsItemDetailView({ data }: { data: StatsItemDetailData }) {
  const { item } = data;
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Stats", href: "/stats" },
    { label: "Items", href: "/stats/items" },
    { label: item.name, href: null }
  ];

  return (
    <div className="stats-surface space-y-6">
      <header className="space-y-4">
        <PageBreadcrumb items={breadcrumbItems} className="text-xs uppercase tracking-[0.22em] text-muted" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {itemImage(item, 86, "eager")}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-md">{prettyStatsItemLabel(item.category)}</Badge>
                <Badge variant="outline" className="rounded-md">{prettyStatsItemLabel(item.subcategory)}</Badge>
                {item.itemStatsTier ? <Badge className="rounded-md">{item.itemStatsTier}</Badge> : null}
              </div>
              <h1 className="mt-3 mb-0 text-3xl font-semibold leading-tight text-foreground md:text-4xl">{item.name}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted">{item.description || `${item.name} Roblox marketplace stats, price signals, resale history, and favorites tracked by Bloxodes.`}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
                <span>{item.itemType} #{item.assetId}</span>
                <span>{item.creatorName}</span>
                {item.creatorHasVerifiedBadge ? <span className="inline-flex items-center gap-1 text-accent"><BadgeCheck className="h-4 w-4" aria-hidden />Verified</span> : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-md">
              <Link href="/stats/items">All items</Link>
            </Button>
            <Button asChild className="rounded-md">
              <Link href={item.robloxUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden />Roblox
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Favorites" value={formatFullNumber(item.favoriteCount)} detail={item.favoriteChange24h != null ? `${formatDelta(item.favoriteChange24h)} in 24h` : "Current tracked count"} icon={Heart} />
        <MetricCard label="Price" value={itemPriceLabel(item.priceRobux)} detail={item.priceChange24h != null ? `${formatDelta(item.priceChange24h)} in 24h` : item.priceStatus || "Marketplace price"} icon={ShoppingBag} />
        <MetricCard label="Lowest resale" value={item.hasResellers ? itemPriceLabel(item.lowestResalePriceRobux) : "No resale"} detail={item.resaleChange24h != null ? `${formatDelta(item.resaleChange24h)} in 24h` : "Reseller floor price"} icon={BarChart3} />
        <MetricCard label="Refreshed" value={formatRelativeStatsDate(item.lastItemStatsRefreshedAt ?? item.lastSeenAt)} detail={item.lastResaleDataFetchedAt ? `Resale ${formatRelativeStatsDate(item.lastResaleDataFetchedAt)}` : "Stats refresh status"} icon={Clock3} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
          <CardHeader><CardTitle className="text-base">Ranks</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted">Favorites rank</span><span className="font-semibold">{item.globalFavoritesRank ? `#${formatFullNumber(item.globalFavoritesRank)}` : "Not indexed"}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Resale rank</span><span className="font-semibold">{item.globalResaleRank ? `#${formatFullNumber(item.globalResaleRank)}` : "Not indexed"}</span></div>
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
          <CardHeader><CardTitle className="text-base">24h movement</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <DeltaPill value={item.favoriteChange24h} />
            <DeltaPill value={item.priceChange24h} />
            <DeltaPill value={item.resaleChange24h} />
          </CardContent>
        </Card>
        <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
          <CardHeader><CardTitle className="text-base">Supply</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted">Total quantity</span><span className="font-semibold">{formatFullNumber(item.totalQuantity)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted">Available</span><span className="font-semibold">{formatFullNumber(item.unitsAvailableForConsumption)}</span></div>
          </CardContent>
        </Card>
      </div>

      <StatsItemChartPanel hourlyPoints={data.hourlyPoints} dailyPoints={data.dailyPoints} resalePoints={data.resalePoints} />

      {data.similarItems.length ? (
        <Card className="rounded-lg border-border/70 bg-surface/80 shadow-none">
          <CardHeader><CardTitle className="text-base">Similar items</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.similarItems.map((similar) => (
              <Link key={similar.assetId} href={itemStatsHref(similar)} className="flex min-w-0 gap-3 rounded-lg border border-border/70 bg-background/40 p-3 hover:border-accent/50">
                {itemImage(similar, 44)}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{similar.name}</span>
                  <span className="mt-1 block text-xs text-muted">{formatCompactNumber(similar.favoriteCount)} favorites</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function creatorTypeLabel(value: StatsCreatorTypeFilter | string) {
  if (value === "group") return "Group";
  if (value === "user") return "User";
  return "All creators";
}

function creatorPageHref(data: StatsCreatorsPageData, page: number, overrides: { sort?: StatsCreatorSortKey; creatorType?: StatsCreatorTypeFilter } = {}) {
  const params = new URLSearchParams();
  const sort = overrides.sort ?? data.filters.sort;
  const creatorType = overrides.creatorType ?? data.filters.creatorType;
  if (page > 1) params.set("page", String(page));
  if (data.filters.q) params.set("q", data.filters.q);
  if (sort !== "playing") params.set("sort", sort);
  if (creatorType !== "all") params.set("type", creatorType);
  const query = params.toString();
  return query ? `/stats/creators?${query}` : "/stats/creators";
}

function CreatorSortableTableHead({
  data,
  sort,
  label,
  className
}: {
  data: StatsCreatorsPageData;
  sort: StatsCreatorSortKey;
  label: string;
  className?: string;
}) {
  const active = sort === data.filters.sort;
  return (
    <TableHead className={className}>
      <Link
        href={creatorPageHref(data, 1, { sort })}
        className={cn(
          "inline-flex w-full items-center justify-end gap-1 rounded-sm text-muted transition hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
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

function StatsCreatorMobileCard({ creator }: { creator: StatsCreator }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="w-7 shrink-0 pt-1 text-center text-xs font-bold text-muted">#{creator.rank ?? "-"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mb-0 truncate text-sm font-semibold text-foreground">{creator.creatorName}</p>
            {creator.hasVerifiedBadge ? <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]"><BadgeCheck className="mr-1 h-3 w-3" aria-hidden />Verified</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">{creatorTypeLabel(creator.creatorType)} creator</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="mb-0 text-sm font-semibold text-foreground">{formatCompactNumber(creator.playing)}</p>
          <p className="text-[11px] font-medium text-muted">players</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3 text-xs sm:grid-cols-3">
        <span>
          <span className="block font-medium uppercase tracking-[0.08em] text-muted">Games</span>
          <span className="mt-1 block font-semibold text-foreground">{formatFullNumber(creator.gameCount)}</span>
        </span>
        <span>
          <span className="block font-medium uppercase tracking-[0.08em] text-muted">Visits</span>
          <span className="mt-1 block font-semibold text-foreground">{formatCompactNumber(creator.visits)}</span>
        </span>
        <span>
          <span className="block font-medium uppercase tracking-[0.08em] text-muted">Members</span>
          <span className="mt-1 block font-semibold text-foreground">{creator.memberCount == null ? "-" : formatCompactNumber(creator.memberCount)}</span>
        </span>
      </div>
      {creator.topGame ? (
        <Link href={`/stats/games/${creator.topGame.slug}`} className="mt-3 flex items-center gap-2 rounded-md border border-border/50 bg-surface/60 p-2 transition hover:border-accent/70">
          {gameImage(creator.topGame, 32)}
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-foreground">{creator.topGame.name}</span>
            <span className="block text-[11px] text-muted">{formatCompactNumber(creator.topGame.playing)} players</span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}

export function StatsCreatorsView({ data }: { data: StatsCreatorsPageData }) {
  const title =
    data.filters.creatorType === "group"
      ? "Roblox group creator stats"
      : data.filters.creatorType === "user"
        ? "Roblox user creator stats"
        : "Roblox creator stats";
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Stats", href: "/stats" },
    { label: "Creators", href: data.filters.creatorType !== "all" ? "/stats/creators" : null },
    ...(data.filters.creatorType !== "all" ? [{ label: creatorTypeLabel(data.filters.creatorType), href: null }] : [])
  ];
  const formStateKey = [data.filters.q, data.filters.sort, data.filters.creatorType].join("\u0002");
  const typeOptions: Array<{ value: StatsCreatorTypeFilter; label: string }> = [
    { value: "all", label: "All creators" },
    { value: "group", label: "Groups" },
    { value: "user", label: "Users" }
  ];

  return (
    <form key={formStateKey} action="/stats/creators" className="stats-surface space-y-5" data-stats-games-form>
      <StatsGamesAutoSubmit />
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <PageBreadcrumb items={breadcrumbItems} className="text-xs uppercase tracking-[0.22em] text-muted" />
          <div>
            <h1 className="mb-0 text-3xl font-semibold leading-tight text-foreground md:text-4xl">{title}</h1>
            <p className="mt-2 text-sm font-medium text-muted">
              Sort Roblox creators by live players, visits, favorites, tracked games, and group size.
            </p>
          </div>
        </div>
        <div className="flex w-full max-w-xl gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input name="q" type="search" defaultValue={data.filters.q} placeholder="Search creators" className="h-10 rounded-md border-0 bg-surface pl-9 shadow-none" />
          </div>
          <Button type="submit" className="h-10 rounded-md px-4">Search</Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-2 md:max-w-2xl">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Type</label>
            <Select name="type" defaultValue={data.filters.creatorType}>
              <SelectTrigger className="h-10 rounded-md border-border/80 bg-surface/60 shadow-none hover:border-border hover:bg-surface">
                <SelectValue placeholder="Creator type" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Sort by</label>
            <Select name="sort" defaultValue={data.filters.sort}>
              <SelectTrigger className="h-10 rounded-md border-border/80 bg-surface/60 shadow-none hover:border-border hover:bg-surface">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {STATS_CREATOR_SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button asChild type="button" variant="ghost" className="h-10 rounded-md px-4">
          <Link href="/stats/creators" data-stats-games-reset>Reset</Link>
        </Button>
      </div>

      <Card className="overflow-hidden rounded-lg border-border/70 bg-surface/80 shadow-none">
        <div className="hidden overflow-x-auto md:block">
          <Table className="min-w-[1180px] table-auto">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead className="min-w-[300px] text-left">Creator</TableHead>
                <CreatorSortableTableHead data={data} sort="playing" label="CCU" className="min-w-[110px] text-right" />
                <CreatorSortableTableHead data={data} sort="games" label="Games" className="min-w-[100px] text-right" />
                <CreatorSortableTableHead data={data} sort="visits" label="Visits" className="min-w-[120px] text-right" />
                <CreatorSortableTableHead data={data} sort="favorites" label="Favorites" className="min-w-[120px] text-right" />
                <TableHead className="min-w-[260px] text-left">Top game</TableHead>
                <CreatorSortableTableHead data={data} sort="members" label="Members" className="min-w-[120px] text-right" />
                <TableHead className="min-w-[112px] text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.creators.map((creator) => (
                <TableRow key={creator.creatorKey} className="border-border/60 hover:bg-background/40">
                  <TableCell className="w-16 text-center font-mono text-xs text-muted">#{creator.rank ?? "-"}</TableCell>
                  <TableCell className="min-w-[300px] align-middle">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">{creator.creatorName}</span>
                        {creator.hasVerifiedBadge ? <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]"><BadgeCheck className="mr-1 h-3 w-3" aria-hidden />Verified</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{creatorTypeLabel(creator.creatorType)} creator</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCompactNumber(creator.playing)}</TableCell>
                  <TableCell className="text-right">{formatFullNumber(creator.gameCount)}</TableCell>
                  <TableCell className="text-right">{formatCompactNumber(creator.visits)}</TableCell>
                  <TableCell className="text-right">{formatCompactNumber(creator.favorites)}</TableCell>
                  <TableCell className="min-w-[260px]">
                    {creator.topGame ? (
                      <Link href={`/stats/games/${creator.topGame.slug}`} className="flex items-center gap-3">
                        {gameImage(creator.topGame, 34)}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground hover:text-accent">{creator.topGame.name}</span>
                          <span className="text-xs text-muted">{formatCompactNumber(creator.topGame.playing)} players</span>
                        </span>
                      </Link>
                    ) : (
                      <span className="text-sm text-muted">Not tracked</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{creator.memberCount == null ? <span className="text-muted">-</span> : formatCompactNumber(creator.memberCount)}</TableCell>
                  <TableCell className="text-right text-xs text-muted">{formatRelativeStatsDate(creator.lastStatsRefreshedAt ?? creator.indexedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-2 p-3 md:hidden">
          {data.creators.map((creator) => <StatsCreatorMobileCard key={creator.creatorKey} creator={creator} />)}
        </div>

        {!data.creators.length ? (
          <div className="border-t border-border/60 p-8 text-center text-sm text-muted">No creators match the current filters.</div>
        ) : null}
      </Card>

      {data.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>Page {data.page} of {data.totalPages}</span>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-md" aria-disabled={data.page <= 1}>
              <Link href={creatorPageHref(data, Math.max(1, data.page - 1))}>Previous</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-md" aria-disabled={data.page >= data.totalPages}>
              <Link href={creatorPageHref(data, Math.min(data.totalPages, data.page + 1))}>Next</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function StatsGamesView({ data }: { data: StatsGamesPageData }) {
  const activeGenres = data.filters.genres;
  const activeSubgenres = data.filters.subgenres;
  const activeGenre = activeGenres.length === 1 ? activeGenres[0] : null;
  const activeSubgenre = activeGenre && activeSubgenres.length === 1 ? activeSubgenres[0] : null;
  const genreParams = new URLSearchParams();
  if (activeGenre) genreParams.set("genre", activeGenre);
  const genreHref = activeGenre ? `/stats/games?${genreParams.toString()}` : null;
  const title = activeSubgenre
    ? `${activeSubgenre} Roblox game stats`
    : activeGenre
      ? `${activeGenre} Roblox game stats`
      : "Roblox game stats table";
  const description = activeSubgenre
    ? `Compare ${activeSubgenre} Roblox games in the ${activeGenre} genre by current players, visits, rating, and tracked peaks.`
    : activeGenre
      ? `Sort ${activeGenre} Roblox games by current players, growth, visits, rating, and tracked peaks.`
      : "Sort public Roblox games by current players, growth, visits, rating, and tracked peaks.";
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Stats", href: "/stats" },
    { label: "Games", href: activeGenres.length ? "/stats/games" : null },
    ...(activeGenre
      ? [{ label: activeGenre, href: activeSubgenre ? genreHref : null }]
      : activeGenres.length
        ? [{ label: `${activeGenres.length} genres`, href: null }]
        : []),
    ...(activeSubgenre ? [{ label: activeSubgenre, href: null }] : [])
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
        <div className="hidden overflow-x-auto md:block">
          <Table className="table-auto" style={{ minWidth: statsGamesTableMinWidth(visibleColumns) }}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {visibleColumns.includes("rank") ? <SortableTableHead data={data} column="rank" className={statsColumnCellClass("rank")} /> : null}
                <TableHead className="min-w-[320px] text-left align-middle">Game</TableHead>
                {dataColumns.map((column) => (
                  <SortableTableHead key={column} data={data} column={column} className={statsColumnCellClass(column)} />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.games.map((game) => (
                <TableRow key={game.universeId} className="border-border/60 hover:bg-background/40">
                  {visibleColumns.includes("rank") ? <TableCell className={cn(statsColumnCellClass("rank"), "font-mono text-xs text-muted")}>#{game.rank ?? "-"}</TableCell> : null}
                  <TableCell className="min-w-[320px] align-middle">
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
                    <TableCell key={`${game.universeId}-${column}`} className={cn(statsColumnCellClass(column), ["created", "updated", "statsRefresh"].includes(column) && "text-xs text-muted", column === "playing" && "font-semibold")}>
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
  const globalRank = game.rank;
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Stats", href: "/stats" },
    { label: "Games", href: "/stats/games" }
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
              <HeaderStat label="Rating" value={game.ratingPercent != null ? formatPercent(game.ratingPercent) : "Unrated"} icon={Star} />
              <HeaderStat label="Updated" value={formatRelativeStatsDate(game.updatedAtApi)} icon={Clock3} />
              <HeaderStat label="Created" value={formatStatsDate(game.createdAtApi)} icon={CalendarDays} />
              <HeaderStat label="Genre" value={game.genre ?? "Not tracked"} icon={Layers} />
              <HeaderStat label="Subgenre" value={game.subgenre ?? "Not tracked"} icon={Layers} />
              <HeaderStat label="Maturity" value={game.ageRating ?? "Not tracked"} icon={IdCard} />
            </div>
          </div>
        </div>
      </header>

      <GameDetailStatsRow game={game} />

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
          <RelatedLinks links={data.relatedLinks} />
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
