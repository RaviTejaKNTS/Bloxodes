"use client";

import { useEffect, useMemo, useState } from "react";
import { FiClock } from "react-icons/fi";
import { ProgressBar } from "@/components/ProgressBar";
import {
  readLocalChecklistProgress,
  useChecklistProgressIndex,
  useChecklistSession
} from "@/lib/checklist-progress-client";
import { ContentCard } from "@/components/ContentCard";

type ChecklistCardProps = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  updatedLabel: string | null;
  itemsCount: number | null;
};

type Progress = { done: number; total: number; percent: number };

export function ChecklistCard({ slug, title, coverImage, universeName, updatedLabel, itemsCount }: ChecklistCardProps) {
  const session = useChecklistSession();
  const progressIndex = useChecklistProgressIndex(session.status === "ready" ? session.userId : null);
  const accountDone =
    session.userId && progressIndex.userId === session.userId ? (progressIndex.counts[slug] ?? 0) : 0;
  const totalItems = typeof itemsCount === "number" ? itemsCount : 0;
  const [localVersion, setLocalVersion] = useState(0);

  const progress = useMemo<Progress>(() => {
    if (session.status !== "ready") {
      return { done: 0, total: totalItems, percent: 0 };
    }
    if (session.userId) {
      const clampedDone = Math.min(accountDone, totalItems);
      return {
        done: clampedDone,
        total: totalItems,
        percent: totalItems ? Math.round((clampedDone / totalItems) * 100) : 0
      };
    }
    const localDone = readLocalChecklistProgress(slug).length;
    const clampedDone = Math.min(localDone, totalItems);
    return {
      done: clampedDone,
      total: totalItems,
      percent: totalItems ? Math.round((clampedDone / totalItems) * 100) : 0
    };
  }, [session.status, session.userId, accountDone, slug, totalItems, localVersion]);

  useEffect(() => {
    if (!session.userId) {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === `checklist:${slug}`) {
          setLocalVersion((prev) => prev + 1);
        }
      };
      window.addEventListener("storage", handleStorage);
      return () => {
        window.removeEventListener("storage", handleStorage);
      };
    }
    return () => {
      // no-op
    };
  }, [session.userId, slug]);

  const progressLabel =
    progress.total > 0 ? `${progress.done}/${progress.total} tasks completed` : "No tasks tracked yet";

  return (
    <ContentCard
      type="checklist"
      href={`/checklists/${slug}`}
      title={title}
      image={{ src: coverImage, alt: universeName || title, ratio: "1:1" }}
      subtitle={
        updatedLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <FiClock aria-hidden className="h-3 w-3" />
            <span>{updatedLabel}</span>
          </span>
        ) : null
      }
      liveSlot={
        <>
          <div className="flex items-center justify-between gap-3 text-xs text-foreground/70">
            <span>{progressLabel}</span>
            <span className="font-medium">{progress.percent}%</span>
          </div>
          <ProgressBar percent={progress.percent} label={`${title} progress`} />
        </>
      }
    />
  );
}
