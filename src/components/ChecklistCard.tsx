"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { FiClock } from "react-icons/fi";
import {
  readLocalChecklistProgress,
  useChecklistProgressIndex,
  useChecklistSession
} from "@/lib/checklist-progress-client";

type ChecklistCardProps = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  itemsCount: number | null;
};

type Progress = { done: number; total: number; percent: number };

function formatUpdatedLabel(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  try {
    return formatDistanceToNow(new Date(updatedAt), { addSuffix: true });
  } catch {
    return null;
  }
}

export function ChecklistCard({
  slug,
  title,
  universeName,
  coverImage,
  updatedAt,
  itemsCount
}: ChecklistCardProps) {
  const session = useChecklistSession();
  const progressIndex = useChecklistProgressIndex(session.status === "ready" ? session.userId : null);
  const accountDone =
    session.userId && progressIndex.userId === session.userId ? (progressIndex.counts[slug] ?? 0) : 0;
  const updatedLabel = formatUpdatedLabel(updatedAt);
  const totalItems = typeof itemsCount === "number" ? itemsCount : 0;
  const [localVersion, setLocalVersion] = useState(0);
  const fallbackImage = "/og-image.png";
  const handleImgError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src.endsWith(fallbackImage)) return;
    event.currentTarget.src = fallbackImage;
  };

  const progress = useMemo<Progress>(() => {
    if (session.status !== "ready") {
      return { done: 0, total: totalItems, percent: totalItems ? 0 : 0 };
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
    progress.total > 0
      ? `${progress.done}/${progress.total} tasks completed`
      : "No tasks tracked yet";

  return (
    <Link
      href={`/checklists/${slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-none transition-colors hover:border-border"
    >
      <div className="relative aspect-square shrink-0 overflow-hidden bg-surface-muted">
        {coverImage ? (
          <img
            src={coverImage}
            alt={universeName || title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
            onError={handleImgError}
          />
        ) : (
          <img
            src={fallbackImage}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/70 to-transparent" aria-hidden />
      </div>

      <div className="relative -mt-1 flex flex-1 flex-col gap-3 bg-card px-4 pb-4 pt-3">
        <div className="space-y-2">
          <h3 className="mb-0 line-clamp-2 text-lg font-semibold leading-snug text-foreground">{title}</h3>
          {updatedLabel ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-foreground/70">
              <FiClock aria-hidden className="h-3 w-3" />
              <span>{updatedLabel}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs text-foreground/70">
            <span>{progressLabel}</span>
            <span className="font-medium">{progress.percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${progress.percent}%` }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
