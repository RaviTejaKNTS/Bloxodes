"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function abbreviateCount(value: number): string {
  const strip = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${strip(value / 1000)}K`;
  if (value < 1_000_000_000) return `${strip(value / 1_000_000)}M`;
  return `${strip(value / 1_000_000_000)}B`;
}

type StatsSidebarCardProps = {
  universeId: number;
  gameName: string;
  slug: string | null;
  initialRank: number | null;
  initialPlaying: number | null;
};

/** Minimal outlined stats block. SSR shows the cached values; the island refreshes live (60s). */
export function StatsSidebarCard({ universeId, gameName, slug, initialRank, initialPlaying }: StatsSidebarCardProps) {
  const [rank, setRank] = useState(initialRank);
  const [playing, setPlaying] = useState(initialPlaying);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/stats/games/${universeId}`);
        if (!res.ok) return;
        const payload = await res.json().catch(() => null);
        const game = payload?.game;
        if (cancelled || !game) return;
        setPlaying(typeof game.playing === "number" ? game.playing : null);
        setRank(typeof game.rank === "number" ? game.rank : null);
      } catch {
        // keep cached values
      }
    };
    void load();
    const id = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [universeId]);

  const body = (
    <>
      <p className="text-xs text-muted">Current Players on {gameName}</p>
      <p className={`mt-1 inline-flex items-center justify-center gap-2 font-bold leading-none text-foreground ${typeof playing === "number" ? "text-4xl" : "text-lg"}`}>
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" aria-hidden />
        {typeof playing === "number" ? abbreviateCount(playing) : "Unavailable"}
      </p>
      {typeof rank === "number" ? (
        <p className="mt-2 text-xs text-muted">Global rank #{rank.toLocaleString("en-US")}</p>
      ) : null}
    </>
  );

  const className = "block px-2 py-2 text-center transition-opacity hover:opacity-80";
  return slug ? (
    <Link href={`/stats/games/${slug}`} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
