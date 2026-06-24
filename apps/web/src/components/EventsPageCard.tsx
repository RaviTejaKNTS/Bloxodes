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
    label: "Starts in",
    standalone: "Upcoming",
    icon: CalendarClock,
    pill: "border-accent/30 bg-accent/10 text-accent",
    dot: "bg-accent"
  },
  current: {
    label: "Live now",
    standalone: "Live now",
    icon: Radio,
    pill: "border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400"
  },
  past: {
    label: "Ended",
    standalone: "Last event",
    icon: Clock3,
    pill: "border-border/60 bg-surface-muted text-muted",
    dot: "bg-muted"
  },
  none: {
    label: "Events hub",
    standalone: "Events hub",
    icon: CalendarClock,
    pill: "border-border/60 bg-surface-muted text-muted",
    dot: "bg-muted"
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
  status
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

  const hasTimer = Boolean(timerLabel) && timerLabel !== "No event time";
  let pillText: string;
  if (status === "current") {
    pillText = hasTimer ? `Live now · ${timerLabel}` : "Live now";
  } else if (status === "upcoming") {
    pillText = hasTimer ? `Starts in ${timerLabel}` : "Upcoming";
  } else if (status === "past") {
    pillText = hasTimer ? `Ended ${timerLabel}` : "Last event";
  } else {
    pillText = "Events hub";
  }

  return (
    <ContentCard
      type="events"
      variant="row"
      href={`/events/${slug}`}
      prefetch={false}
      thumbClassName="border border-border/60"
      title={gameTitle}
      titleClassName="transition-colors group-hover:text-accent"
      subtitle={<p className="line-clamp-1 text-sm text-muted">{eventTitle}</p>}
      image={{ src: imageUrl, alt: gameTitle, ratio: "1:1" }}
      imageFallback={
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted">EV</div>
      }
      liveSlot={
        <span
          className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusCopy.pill}`}
        >
          <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{pillText}</span>
        </span>
      }
    />
  );
}
