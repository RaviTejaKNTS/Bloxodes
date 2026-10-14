"use client";

import { useEffect, useState } from "react";
import { readLocalChecklistProgress, useChecklistSession } from "@/lib/checklist-progress-client";
import { ProgressBar } from "@/components/ProgressBar";

type Progress = { done: number; total: number; percent: number };

type ChecklistProgressHeaderProps = {
  title: string;
  slug: string;
  totalItems: number;
};

function computeProgress(slug: string, totalItems: number): Progress {
  const done = readLocalChecklistProgress(slug).length;
  const clampedDone = Math.min(done, totalItems);
  return {
    done: clampedDone,
    total: totalItems,
    percent: totalItems ? Math.round((clampedDone / totalItems) * 100) : 0
  };
}

export function ChecklistProgressHeader({ title, slug, totalItems }: ChecklistProgressHeaderProps) {
  const session = useChecklistSession();
  const [progress, setProgress] = useState<Progress>(() => ({
    done: 0,
    total: totalItems,
    percent: totalItems ? 0 : 0
  }));

  useEffect(() => {
    if (session.status !== "ready" || session.userId) return;
    setProgress(computeProgress(slug, totalItems));
  }, [session.status, session.userId, slug, totalItems]);

  useEffect(() => {
    const handleProgressEvent = (event: Event) => {
      const custom = event as CustomEvent<{ slug: string; checkedCount: number; totalCount: number }>;
      const detail = custom.detail;
      if (!detail || detail.slug !== slug) return;
      const total = totalItems || detail.totalCount || 0;
      const done = Math.min(detail.checkedCount, total);
      setProgress({
        done,
        total,
        percent: total ? Math.round((done / total) * 100) : 0
      });
    };

    window.addEventListener("checklist-progress", handleProgressEvent as EventListener);
    if (!session.userId) {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === `checklist:${slug}`) {
          setProgress(computeProgress(slug, totalItems));
        }
      };
      window.addEventListener("storage", handleStorage);
      return () => {
        window.removeEventListener("checklist-progress", handleProgressEvent as EventListener);
        window.removeEventListener("storage", handleStorage);
      };
    }
    return () => {
      window.removeEventListener("checklist-progress", handleProgressEvent as EventListener);
    };
  }, [session.userId, slug, totalItems]);

  return (
    <div className="flex w-full items-center gap-3">
      <ProgressBar percent={progress.percent} className="h-2 flex-1" label={`Overall progress for ${title}`} />
      <p className="m-0 whitespace-nowrap text-sm tabular-nums text-muted">
        <span className="font-semibold text-foreground">{progress.done}/{progress.total}</span> tasks done
        <span aria-hidden> · </span>
        <span className="font-semibold text-foreground">{progress.percent}%</span>
      </p>
    </div>
  );
}
