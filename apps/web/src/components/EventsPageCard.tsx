"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock3, Radio } from "lucide-react";
import { ContentCard } from "@/components/ContentCard";

type EventCounts = {
  upcoming: number;
  current: number;
  past: number;
};

export type EventsPageCardProps = {
  slug: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  fallbackIcon: string | null;
  eventName: string | null;
  eventTimeLabel: string | null;
  eventStartUtc: string | null;
  eventEndUtc: string | null;
  status: "upcoming" | "current" | "past" | "none";
  counts: EventCounts;
  updatedLabel: string | null;
};

const STATUS_COPY = {
  upcoming: {
    label: "Next event",
    timerLabel: "Starts in",
    icon: CalendarClock,
    dot: "bg-accent",
    iconClass: "text-accent"
  },
  current: {
    label: "Live now",
    timerLabel: "Ends in",
    icon: Radio,
    dot: "bg-emerald-400",
    iconClass: "text-emerald-400"
  },
  past: {
    label: "Last event",
    timerLabel: "Ended",
    icon: Clock3,
    dot: "bg-amber-400",
    iconClass: "text-amber-400"
  },
  none: {
    label: "Events hub",
    timerLabel: "Status",
    icon: CalendarClock,
    dot: "bg-muted",
    iconClass: "text-muted"
  }
} as const;

function parseTarget(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function buildCountdown(target: number, now: number): string {
  const diff = target - now;
  if (diff <= 0) return "0d 0h 0m 0s";

  const totalSeconds = Math.ceil(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function buildCountsLabel(counts: EventCounts) {
  const upcoming = counts.upcoming ?? 0;
  const current = counts.current ?? 0;
  const past = counts.past ?? 0;
  if (upcoming || current) {
    const parts: string[] = [];
    if (upcoming) parts.push(`${upcoming} upcoming`);
    if (current) parts.push(`${current} live`);
    return parts.join(" · ");
  }
  if (past) return `${past} past ${past === 1 ? "event" : "events"}`;
  return "No events tracked";
}

function normalizeTimerFallback(status: EventsPageCardProps["status"], fallback: string | null) {
  if (!fallback) return null;
  if (status === "past") {
    return fallback.replace(/^ended\s+/i, "");
  }
  if (status === "upcoming") {
    return fallback.replace(/^starts\s+/i, "");
  }
  if (status === "current") {
    return fallback.replace(/^ends\s+/i, "");
  }
  return fallback;
}

function useEventTimer({
  status,
  startUtc,
  endUtc,
  fallback
}: {
  status: EventsPageCardProps["status"];
  startUtc: string | null;
  endUtc: string | null;
  fallback: string | null;
}) {
  const target = useMemo(() => {
    if (status === "upcoming") return parseTarget(startUtc);
    if (status === "current") return parseTarget(endUtc);
    return null;
  }, [endUtc, startUtc, status]);

  const normalizedFallback = useMemo(() => normalizeTimerFallback(status, fallback), [fallback, status]);
  const [label, setLabel] = useState(() => normalizedFallback ?? "No event time");

  useEffect(() => {
    if (!target) {
      setLabel(normalizedFallback ?? "No event time");
      return;
    }

    const tick = () => setLabel(buildCountdown(target, Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [normalizedFallback, target]);

  return label;
}

export function EventsPageCard({
  slug,
  title,
  universeName,
  coverImage,
  fallbackIcon,
  eventName,
  eventTimeLabel,
  eventStartUtc,
  eventEndUtc,
  status,
  counts,
  updatedLabel
}: EventsPageCardProps) {
  const displayUniverse = universeName ?? "Roblox";
  const statusCopy = STATUS_COPY[status] ?? STATUS_COPY.none;
  const StatusIcon = statusCopy.icon;
  const timerLabel = useEventTimer({
    status,
    startUtc: eventStartUtc,
    endUtc: eventEndUtc,
    fallback: eventTimeLabel
  });
  const imageUrl = coverImage ?? fallbackIcon;
  const gameTitle = displayUniverse || title || "Roblox events";
  const eventTitle = eventName || title || "Events overview";

  return (
    <ContentCard
      type="events"
      variant="row"
      href={`/events/${slug}`}
      prefetch={false}
      thumbClassName="border border-border/60"
      title={gameTitle}
      titleClassName="text-xl transition-colors group-hover:text-accent"
      eyebrow={
        <span className="inline-flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusCopy.dot}`} aria-hidden />
          {statusCopy.label}
        </span>
      }
      subtitle={<p className="line-clamp-1 text-sm text-muted">{eventTitle}</p>}
      image={{ src: imageUrl, alt: gameTitle, ratio: "1:1" }}
      imageFallback={
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted">EV</div>
      }
      liveSlot={
        <div className="inline-flex max-w-full items-center gap-2 rounded-md border border-border/60 bg-surface px-3 py-2 text-sm font-semibold text-foreground">
          <StatusIcon className={`h-4 w-4 shrink-0 ${statusCopy.iconClass}`} aria-hidden />
          <span className="shrink-0 text-muted">{statusCopy.timerLabel}</span>
          <span className="truncate">{timerLabel}</span>
        </div>
      }
      footer={
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-xs text-muted">
          <span>{buildCountsLabel(counts)}</span>
          {updatedLabel ? <span>Updated {updatedLabel}</span> : null}
        </div>
      }
    />
  );
}
