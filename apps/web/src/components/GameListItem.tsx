import type { ComponentType, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiUsers, FiEye, FiStar, FiThumbsUp, FiClock, FiMonitor, FiSmartphone, FiTablet, FiTv, FiShield, FiHash, FiTrendingUp } from "react-icons/fi";
import { TbAugmentedReality } from "react-icons/tb";
import type { GameListUniverseEntry, ListUniverseDetails, UniverseListBadge } from "@/lib/db";
import { FaCrown, FaMedal, FaTrophy } from "react-icons/fa";
import { formatUpdatedLabel } from "@/lib/updated-label";
import { formatAgeRating } from "@/lib/age-rating";

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

type GameListItemProps = {
  entry: GameListUniverseEntry & { badges?: UniverseListBadge[] };
  rank: number;
  metricLabel?: string | null;
  listSlug?: string;
};

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value < 1000) return value.toLocaleString();
  return numberFormatter.format(value);
}

function formatRatio(likes: number | null | undefined, dislikes: number | null | undefined): string {
  const like = typeof likes === "number" ? likes : 0;
  const dislike = typeof dislikes === "number" ? dislikes : 0;
  const total = like + dislike;
  if (total <= 0) return "—";
  const percent = Math.round((like / total) * 100);
  return `${percent}%`;
}

function formatPrimaryMetric(
  metricKey: string | null | undefined,
  metricLabel: string | null | undefined,
  metricValue: number | null | undefined,
  universe: ListUniverseDetails
): { label: string; value: string; raw: string } | null {
  const key = metricKey?.trim().toLowerCase() || null;
  const friendlyLabel =
    metricLabel ??
    (key === "playing"
      ? "Playing now"
      : key === "visits"
        ? "Visits"
        : key === "visits_7d_change_pct"
          ? "7d gain"
          : key === "visits_7d_change"
            ? "7d change"
            : key === "likes_ratio"
              ? "Like ratio"
              : key ?? null);

  let value: number | null | undefined = metricValue;
  if ((value === null || value === undefined) && key) {
    if (key === "playing") value = universe.playing ?? null;
    else if (key === "visits") value = universe.visits ?? null;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    // fall back to playing or visits if no key was provided
    if (!key) {
      if (typeof universe.playing === "number") {
        const raw = universe.playing.toLocaleString("en-US");
        return { label: "Playing now", value: formatNumber(universe.playing), raw };
      }
      if (typeof universe.visits === "number") {
        const raw = universe.visits.toLocaleString("en-US");
        return { label: "Visits", value: formatNumber(universe.visits), raw };
      }
    }
    return null;
  }

  const isPercent = key?.includes("pct");
  const isDelta = key?.includes("change") || key?.includes("delta");
  let formatted: string;

  if (isPercent) {
    const digits = Math.abs(value) >= 10 ? 0 : 1;
    const raw = `${value >= 0 ? "+" : ""}${value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}%`;
    formatted = `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
    return { label: friendlyLabel ?? "Metric", value: formatted, raw };
  } else if (isDelta) {
    const raw = `${value >= 0 ? "+" : ""}${Math.abs(value).toLocaleString("en-US")}`;
    formatted = `${value >= 0 ? "+" : ""}${formatNumber(Math.abs(value))}`;
    return { label: friendlyLabel ?? "Metric", value: formatted, raw };
  } else {
    const raw = value.toLocaleString("en-US");
    formatted = formatNumber(value);
    return { label: friendlyLabel ?? "Metric", value: formatted, raw };
  }
}

function DeviceBadge({ label, icon: Icon, enabled }: { label: string; icon: ComponentType<{ className?: string }>; enabled?: boolean | null }) {
  return (
    <span
      title={enabled ? `${label} supported` : `${label} not listed`}
      aria-label={enabled ? `${label} supported` : `${label} not listed`}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
        enabled ? "border-accent/50 bg-accent/10 text-accent" : "border-border/60 text-muted/50"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ExternalLinkWrapper({
  href,
  children,
  className
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const isInternal = href.startsWith("/");
  if (isInternal) {
    return (
      <Link href={href} prefetch={false} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function universeTitle(universe: ListUniverseDetails): string {
  return universe.display_name || universe.name;
}

function robloxUniverseUrl(universe: ListUniverseDetails): string {
  const placeId = universe.root_place_id ?? universe.universe_id;
  return `https://www.roblox.com/games/${placeId}`;
}

function badgeIconForRank(rank: number) {
  if (rank === 1) return FaCrown;
  if (rank === 2) return FaTrophy;
  if (rank === 3) return FaMedal;
  return FaMedal;
}

export function GameListItem({ entry, rank, metricLabel, listSlug }: GameListItemProps) {
  const { universe, game } = entry;
  const coverImage = universe.icon_url || "/og-image.png";
  const ageRating = formatAgeRating(universe.age_rating);
  const updatedLabel = formatUpdatedLabel(universe.updated_at);
  const primaryHref = robloxUniverseUrl(universe);
  const activeCodesValue =
    typeof game?.active_count === "number" ? game.active_count.toLocaleString() : "—";
  const activeCodesHref = game?.slug ? `/codes/${game.slug}` : null;
  const statsHref = universe.slug ? `/stats/games/${universe.slug}` : null;
  const badges = (entry as any).badges as UniverseListBadge[] | undefined;
  const visibleBadges = badges?.filter((badge) => badge.rank >= 1 && badge.rank <= 3);
  const metricKey = (entry as any).metric_key ?? (entry.extra as any)?.metric ?? null;
  const metricLabelResolved =
    metricLabel ??
    (entry as any).metric_label ??
    (entry.extra as any)?.metric_label ??
    null;
  const primaryMetric = formatPrimaryMetric(metricKey, metricLabelResolved, entry.metric_value, universe);

  return (
    <article className="rounded-[var(--radius-xl)] border border-border/60 bg-surface/80 p-4 shadow-soft transition hover:border-accent/80 hover:shadow-[0_20px_38px_-34px_rgba(59,70,128,0.72)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
            #{rank}
          </span>
          <ExternalLinkWrapper
            href={primaryHref}
            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-black/20 sm:h-28 sm:w-28"
          >
            <Image
              src={coverImage}
              alt={universeTitle(universe)}
              fill
              sizes="(min-width: 640px) 112px, 96px"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          </ExternalLinkWrapper>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <ExternalLinkWrapper
                href={primaryHref}
                className="line-clamp-2 text-xl font-semibold leading-tight text-foreground transition hover:text-accent"
              >
                {universeTitle(universe)}
              </ExternalLinkWrapper>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
                <FiClock className="h-3 w-3 text-muted/70" aria-hidden />
                Updated {updatedLabel ?? "recently"}
              </p>
            </div>
            {primaryMetric ? (
              <div
                className="inline-flex w-fit max-w-full shrink-0 items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-foreground"
                title={primaryMetric.raw}
              >
                <FiTrendingUp className="h-4 w-4 text-accent" aria-hidden />
                <span>{primaryMetric.value}</span>
                <span className="text-muted">{primaryMetric.label}</span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat icon={FiUsers} label="Playing" value={universe.playing} />
            <Stat icon={FiEye} label="Visits" value={universe.visits} />
            <Stat icon={FiStar} label="Favorites" value={universe.favorites} />
            <Stat icon={FiThumbsUp} label="Like Ratio" valueLabel={formatRatio(universe.likes, universe.dislikes)} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
            <div className="flex items-center gap-1.5">
              <DeviceBadge label="Desktop" icon={FiMonitor} enabled={universe.desktop_enabled} />
              <DeviceBadge label="Mobile" icon={FiSmartphone} enabled={universe.mobile_enabled} />
              <DeviceBadge label="Tablet" icon={FiTablet} enabled={universe.tablet_enabled} />
              <DeviceBadge label="Console" icon={FiTv} enabled={universe.console_enabled} />
              <DeviceBadge label="VR" icon={TbAugmentedReality} enabled={universe.vr_enabled} />
            </div>
            {ageRating ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5">
                <FiShield className="h-3.5 w-3.5" />
                {ageRating}
              </span>
            ) : null}
            {Number(game?.active_count ?? 0) > 0 && activeCodesHref ? (
              <Link
                href={activeCodesHref}
                prefetch={false}
                data-analytics-event="list_game_codes_click"
                data-analytics-list-slug={listSlug}
                data-analytics-game-slug={game?.slug ?? ""}
                data-analytics-rank={rank}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 transition hover:border-accent hover:text-accent"
              >
                <FiHash className="h-3.5 w-3.5" />
                {activeCodesValue} active codes
              </Link>
            ) : null}
            {statsHref ? (
              <Link
                href={statsHref}
                prefetch={false}
                data-analytics-event="list_game_stats_click"
                data-analytics-list-slug={listSlug}
                data-analytics-universe-id={universe.universe_id}
                data-analytics-rank={rank}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 transition hover:border-accent hover:text-accent"
              >
                <FiTrendingUp className="h-3.5 w-3.5" />
                Stats
              </Link>
            ) : null}
          </div>

          {visibleBadges?.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {visibleBadges.slice(0, 3).map((badge) => {
                const Icon = badgeIconForRank(badge.rank);
                const labelBase =
                  (badge as any).list_display_name ||
                  badge.list_title ||
                  badge.list_slug ||
                  universeTitle(universe);
                const label = `#${badge.rank} on ${labelBase}`;
                return (
                  <Link
                    key={`${badge.list_id}-${badge.rank}`}
                    href={`/lists/${badge.list_slug}`}
                    prefetch={false}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent"
                  >
                    <Icon className="h-4 w-4 text-accent" aria-hidden />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  valueLabel
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: number | null;
  valueLabel?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-border/35 text-muted">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="text-base font-semibold leading-tight text-foreground">{valueLabel ?? formatNumber(value ?? null)}</p>
      </div>
    </div>
  );
}
