"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  readLocalChecklistProgress,
  useChecklistProgressIndex,
  useChecklistSession
} from "@/lib/checklist-progress-client";
import { ProgressBar } from "@/components/ProgressBar";

type ChecklistSidebarCardProps = {
  slug: string;
  title: string;
  itemsCount: number;
};

/** Server-rendered shell (title + link in HTML for SEO); progress bar hydrates per user. */
export function ChecklistSidebarCard({ slug, title, itemsCount }: ChecklistSidebarCardProps) {
  const session = useChecklistSession();
  const progressIndex = useChecklistProgressIndex(session.status === "ready" ? session.userId : null);
  const accountDone =
    session.userId && progressIndex.userId === session.userId ? (progressIndex.counts[slug] ?? 0) : 0;
  const total = typeof itemsCount === "number" ? itemsCount : 0;
  const [localVersion, setLocalVersion] = useState(0);

  const progress = useMemo(() => {
    if (session.status !== "ready") return { done: 0, percent: 0 };
    const done = session.userId ? Math.min(accountDone, total) : Math.min(readLocalChecklistProgress(slug).length, total);
    return { done, percent: total ? Math.round((done / total) * 100) : 0 };
  }, [session.status, session.userId, accountDone, slug, total, localVersion]);

  useEffect(() => {
    if (session.userId) return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === `checklist:${slug}`) setLocalVersion((prev) => prev + 1);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [session.userId, slug]);

  return (
    <Link
      href={`/checklists/${slug}`}
      className="block rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-border"
    >
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/55">Checklist</p>
      <p className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{title}</p>
      <div className="mb-1.5 flex items-center justify-between text-xs text-foreground/70">
        <span>
          {progress.done}/{total} done
        </span>
        <span className="font-medium">{progress.percent}%</span>
      </div>
      <ProgressBar percent={progress.percent} label={`${title} progress`} />
    </Link>
  );
}
