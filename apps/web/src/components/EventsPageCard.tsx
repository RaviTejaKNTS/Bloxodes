"use client";

import { useEffect, useMemo, useState } from "react";
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
  const useTimerHero = (status === "current" || status === "upcoming") && hasTimer;

  const eyebrowText =
    status === "current" ? "Live now" : status === "upcoming" ? "Starts in" : status === "past" ? "Last event" : "Events";
  const heroText = useTimerHero ? timerLabel : gameTitle;
  const subtitleText = useTimerHero ? gameTitle : eventTitle;
  const heroColor = !useTimerHero
    ? ""
    : status === "current"
      ? "text-emerald-500 dark:text-emerald-400"
      : "text-accent";
  const heroSize = useTimerHero ? "text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl" : "text-xl font-bold";

  return (
    <ContentCard
      type="events"
      variant="overlay"
      overlayAlign="center"
      overlayScrim
      href={`/events/${slug}`}
      prefetch={false}
      image={{ src: imageUrl, alt: gameTitle, ratio: "16:9" }}
      eyebrow={eyebrowText}
      title={heroText}
      titleClassName={`${heroSize} ${heroColor}`}
      subtitle={subtitleText}
    />
  );
}
