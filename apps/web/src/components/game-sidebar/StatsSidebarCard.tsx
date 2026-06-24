"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
        if (typeof game.playing === "number") setPlaying(game.playing);
        if (typeof game.rank === "number") setRank(game.rank);
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/55">{gameName} Stats</p>
      <p className="mt-2 text-xs text-muted">Current players</p>
      <p className="inline-flex items-center gap-2 text-2xl font-semibold leading-tight text-foreground">
        <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden />
        {typeof playing === "number" ? playing.toLocaleString("en-US") : "—"}
      </p>
      {typeof rank === "number" ? (
        <p className="mt-1 text-xs text-muted">Global rank #{rank.toLocaleString("en-US")}</p>
      ) : null}
    </>
  );

  const className = "block rounded-lg border border-border/60 px-4 py-3.5 transition-colors hover:border-border";
  return slug ? (
    <Link href={`/stats/games/${slug}`} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
