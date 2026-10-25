import Link from "next/link";
import { Children, type ReactNode } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays, Clock3, ExternalLink, Medal, ShoppingBag, Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompactNumber, formatFullNumber, formatPercent, formatDeltaPercent } from "@/lib/stats-format";
import type { BadgeInsight, CalendarDay, Milestone, Mover, StatsGameInsights } from "@/lib/stats-insights";
import { cn } from "@/lib/utils";
import { GenreScatterChart, InsightTip, PassPriceChart, SessionChart, VotesChart } from "./StatsInsightCharts";

const date = (value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) => new Date(value).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });

function InsightCard({ title, subtitle, icon: Icon, children, href }: { title: string; subtitle: string; icon: typeof Users; children: ReactNode; href?: string }) {
  return (
    <Card className="min-w-0 rounded-lg border-border/70 bg-surface/80 shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/60 p-4">
        <div className="min-w-0">
          <CardTitle className="m-0 flex items-center gap-2 text-base font-semibold text-foreground">
            <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />{title}
          </CardTitle>
          <p className="mt-1 text-xs text-muted">{subtitle}</p>
        </div>
        {href ? (
          <Link href={href} aria-label={title} className="shrink-0 text-muted hover:text-foreground">
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

export function InsightPair({ children }: { children: ReactNode }) {
  const cards = Children.toArray(children);
  return cards.length ? (
    <div className="stats-insight-pair grid gap-6 md:grid-cols-2 [&>*:only-child]:col-span-full">{cards}</div>
  ) : null;
}

function Change({ value, neutralBelow = 0 }: { value: number | null; neutralBelow?: number }) {
  if (value === null) return <span className="text-muted">–</span>;
  const positive = value > 0 && Math.abs(value) >= neutralBelow;
  const negative = value < 0 && Math.abs(value) >= neutralBelow;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Activity;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold",
      positive ? "bg-emerald-500/10 text-emerald-500" : negative ? "bg-rose-500/10 text-rose-500" : "bg-secondary text-muted"
    )}>
      <Icon className="h-3.5 w-3.5" aria-hidden />{formatDeltaPercent(value)}
    </span>
  );
}

function InsightTableHeader({ columns }: { columns: string[] }) {
  return (
    <TableHeader>
      <TableRow>
        {columns.map((heading, index) => (
          <TableHead key={heading} className={cn("px-1", index > 0 && "text-right")}>{heading}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

export function MonthlyPlayersCard({ data }: { data: StatsGameInsights }) {
  return (
    <InsightCard title="Players by month" subtitle="Average and peak players" icon={CalendarDays}>
      <Table className="text-xs">
        <InsightTableHeader columns={["Month", "Avg players", "Change", "Peak"]} />
        <TableBody>
          {data.months.map(row => (
            <TableRow key={row.month}>
              <TableCell className="whitespace-nowrap px-1">
                {row.month === "last30" ? "Last 30 days" : date(`${row.month}-01T00:00:00Z`, { month: "short", year: "numeric" })}
              </TableCell>
              <TableCell className="px-1 text-right tabular-nums">{formatCompactNumber(row.average)}</TableCell>
              <TableCell className="px-1 text-right"><Change value={row.change} /></TableCell>
              <TableCell className="px-1 text-right tabular-nums">{row.peak === null ? "–" : formatCompactNumber(row.peak)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.trackedSince ? <p className="mt-3 text-xs text-muted">Tracked since {date(data.trackedSince, { month: "long", year: "numeric" })}.</p> : null}
    </InsightCard>
  );
}

function milestoneLabel(item: Milestone) {
  if (item.kind === "peak") return `New player peak: ${formatCompactNumber(item.value)}`;
  if (item.kind === "top1") return "Reached #1 in all tracked games";
  if (item.kind === "top10") return "Entered the top 10 of all tracked games";
  return `Passed ${formatCompactNumber(item.value)} ${item.kind}`;
}

export function MilestonesCard({ data }: { data: StatsGameInsights }) {
  return (
    <InsightCard title="Milestones" subtitle="Newest first" icon={Trophy}>
      <ol className="m-0 space-y-4 border-l border-border pl-4">
        {data.milestones.map(item => (
          <li key={`${item.date}:${item.kind}`} className="relative text-sm">
            <span className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-accent" />
            <div className="font-medium">{milestoneLabel(item)}</div>
            <time className="text-xs text-muted" dateTime={item.date}>{date(item.date, { month: "short", day: "numeric", year: "numeric" })}</time>
          </li>
        ))}
      </ol>
    </InsightCard>
  );
}

export function UpdateImpactsCard({ data }: { data: StatsGameInsights }) {
  return (
    <InsightCard title="How updates did" subtitle="Average players, 24h before vs 48h after" icon={Activity}>
      <Table className="text-xs">
        <InsightTableHeader columns={["Update", "Before", "After", "Change"]} />
        <TableBody>
          {data.updates.map(row => (
            <TableRow key={row.date}>
              <TableCell className="max-w-40 px-1">{date(row.date)} · {row.title}</TableCell>
              <TableCell className="px-1 text-right">{formatCompactNumber(row.before)}</TableCell>
              <TableCell className="px-1 text-right">{formatCompactNumber(row.after)}</TableCell>
              <TableCell className="px-1 text-right"><Change value={row.change} neutralBelow={5} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </InsightCard>
  );
}

export function VotesCard({ data }: { data: StatsGameInsights }) {
  return (
    <InsightCard title="Votes per day" subtitle="Up = likes, down = dislikes, last 21 days" icon={BarChart3}>
      <VotesChart points={data.votes} asOf={data.asOf} />
      <div className="mt-2 flex gap-4 text-xs text-muted">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500" />Likes</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-rose-500" />Dislikes</span>
      </div>
    </InsightCard>
  );
}

export function SessionsCard({ data }: { data: StatsGameInsights }) {
  return (
    <InsightCard title="Estimated session length" subtitle="Minutes per visit, by day" icon={Clock3}>
      <SessionChart points={data.sessions} markers={data.markers} asOf={data.asOf} />
      <p className="mt-3 text-xs text-muted">Estimate: average players × 1,440 ÷ new visits that day.</p>
    </InsightCard>
  );
}

export function GenreScatterCard({ data }: { data: NonNullable<StatsGameInsights['scatter']> }) {
  return (
    <InsightCard title={`${data.genre} games`} subtitle="Players vs rating, games with 1K+ players" icon={Users}>
      <GenreScatterChart data={data} />
      <p className="mt-3 text-xs text-muted">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />
        This game · #{formatFullNumber(data.rank)} of {formatFullNumber(data.count)} {data.genre} games
      </p>
    </InsightCard>
  );
}

function BadgeRarityBar({ badge }: { badge: BadgeInsight }) {
  const rate = badge.rarity_percent! * 100;
  return (
    <InsightTip label={`${badge.name} · ${formatPercent(rate)} rarity`}>
      <div tabIndex={0}>
        <div className="mb-1 flex justify-between gap-3 text-xs">
          <span className="truncate">{badge.name}</span>
          <span className="tabular-nums">{formatPercent(rate)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-secondary">
          <div className="h-full rounded bg-accent" style={{ width: `${rate}%` }} />
        </div>
      </div>
    </InsightTip>
  );
}

export function BadgesCard({ data }: { data: StatsGameInsights }) {
  return (
    <InsightCard title="Badge rarity" subtitle="Most common to rarest. A lower % is a rarer badge." icon={Medal}>
      <div className="space-y-4">{data.badges.map(badge => <BadgeRarityBar key={badge.badge_id} badge={badge} />)}</div>
    </InsightCard>
  );
}

export function PassPricesCard({ data }: { data: StatsGameInsights }) {
  const prices = data.passes.map(pass => pass.price).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  return (
    <InsightCard title="Game pass prices" subtitle={`${formatFullNumber(prices.length)} ${prices.length === 1 ? "pass" : "passes"} on sale, Robux`} icon={ShoppingBag}>
      <PassPriceChart passes={data.passes} />
      <p className="mt-3 text-xs text-muted">
        Robux (log scale) · {formatFullNumber(prices[0])} to {formatFullNumber(prices[prices.length - 1])}, median {formatFullNumber(median)}
      </p>
    </InsightCard>
  );
}

function MoverRow({ game }: { game: Mover }) {
  const change = game.growth_7d_percent!;
  const width = Math.min(100, Math.abs(change)) / 2;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-3 text-xs">
      <Link href={`/stats/games/${game.slug}`} className="truncate font-medium hover:text-accent">{game.name}</Link>
      <InsightTip label={`${game.name} · ${formatDeltaPercent(change)}`}>
        <div tabIndex={0} className="relative h-5">
          <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
          <span
            className={cn("absolute top-1 h-3 rounded-sm", change > 0 ? "bg-emerald-500" : "bg-rose-500")}
            style={{ left: change > 0 ? "50%" : `${50 - width}%`, width: `${width}%` }}
          />
        </div>
      </InsightTip>
      <span className={cn("text-right font-semibold tabular-nums", change > 0 ? "text-emerald-500" : "text-rose-500")}>{formatDeltaPercent(change)}</span>
    </div>
  );
}

export function WeeklyMoversCard({ movers }: { movers: Mover[] }) {
  if (!movers.length) return null;
  return (
    <InsightCard title="Biggest moves this week" subtitle="Change in players over 7 days, games with 5K+ players" icon={BarChart3} href="/stats/games?sort=growth_7d&minPlaying=5000">
      <div className="space-y-3">{movers.map(game => <MoverRow key={game.universe_id} game={game} />)}</div>
      <p className="mt-4 text-xs text-muted">Bars cap at ±100%; the label shows the full change.</p>
    </InsightCard>
  );
}

const shades = ['bg-secondary', 'bg-accent/20', 'bg-accent/40', 'bg-accent/65', 'bg-accent'];
const weekdayLabels = ["Sun", "Mon", "", "Wed", "", "Fri", ""];
const calendarRows = { gridTemplateRows: "repeat(7, 1rem)" };

function CalendarCell({ day }: { day: CalendarDay }) {
  const value = day.players === null ? "No data" : `${formatFullNumber(day.players)} players`;
  return (
    <InsightTip label={`${date(day.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${value}`}>
      <span
        tabIndex={day.future ? -1 : 0} role="img" aria-label={`${day.date}: ${value}`}
        className={cn(
          "block h-4 rounded-sm", shades[day.level], day.future && "invisible",
          day.players === null && "border border-border/50 bg-transparent"
        )}
      />
    </InsightTip>
  );
}

export function PlayersCalendarCard({ weeks }: { weeks: CalendarDay[][] }) {
  const days = weeks.flat().filter(day => day.players !== null);
  if (!days.length) return null;
  const busiest = days.reduce((best, day) => day.players! > best.players! ? day : best);
  return (
    <InsightCard title="Players by day" subtitle="Average players across tracked games, last 13 weeks. Darker = busier day." icon={CalendarDays}>
      <div className="flex gap-2">
        <div className="grid gap-1 text-[10px] text-muted" style={calendarRows}>
          {weekdayLabels.map((label, index) => <span key={index} className="flex h-4 items-center">{label}</span>)}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-[repeat(13,minmax(0,1fr))] gap-1">
          {weeks.map(week => (
            <div key={week[0].date} className="grid gap-1" style={calendarRows}>
              {week.map(day => <CalendarCell key={day.date} day={day} />)}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted">
        <span className="mr-1">Fewer</span>
        {shades.slice(1).map(shade => <span key={shade} className={cn("h-3 w-3 rounded-sm", shade)} />)}
        <span className="ml-1">More</span>
      </div>
      <p className="mt-3 text-xs text-muted">
        Busiest day: {formatCompactNumber(busiest.players)} on {date(busiest.date, { weekday: "long", month: "short", day: "numeric" })}
      </p>
    </InsightCard>
  );
}
