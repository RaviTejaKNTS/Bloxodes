"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { classifyUmamiContentType, trackUmamiEvent } from "@/lib/umami";

const ENGAGED_TIME_MS = 30_000;
const ENGAGED_SCROLL_DEPTH = 0.5;

export function UmamiEngagementTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    let activeStartedAt = document.visibilityState === "visible" ? Date.now() : null;
    let activeTimeMs = 0;
    let reachedDepth = false;
    let tracked = false;
    let timer: number | null = null;

    const readActiveTime = () =>
      activeTimeMs + (activeStartedAt === null ? 0 : Date.now() - activeStartedAt);

    const readScrollDepth = () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollableHeight <= 0) return 1;
      return Math.min(1, Math.max(0, window.scrollY / scrollableHeight));
    };

    const maybeTrack = () => {
      if (tracked || !reachedDepth || readActiveTime() < ENGAGED_TIME_MS) return;
      tracked = true;
      trackUmamiEvent("engaged_visit", {
        content_type: classifyUmamiContentType(pathname),
        seconds: ENGAGED_TIME_MS / 1000,
        scroll_percent: ENGAGED_SCROLL_DEPTH * 100
      });
    };

    const scheduleTimeCheck = () => {
      if (timer !== null) window.clearTimeout(timer);
      if (tracked || activeStartedAt === null) return;
      const remaining = Math.max(0, ENGAGED_TIME_MS - readActiveTime());
      timer = window.setTimeout(maybeTrack, remaining);
    };

    const onScroll = () => {
      if (!reachedDepth && readScrollDepth() >= ENGAGED_SCROLL_DEPTH) {
        reachedDepth = true;
        maybeTrack();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        activeStartedAt = Date.now();
        scheduleTimeCheck();
        return;
      }
      if (activeStartedAt !== null) {
        activeTimeMs += Date.now() - activeStartedAt;
        activeStartedAt = null;
      }
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    reachedDepth = readScrollDepth() >= ENGAGED_SCROLL_DEPTH;
    scheduleTimeCheck();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname]);

  return null;
}
