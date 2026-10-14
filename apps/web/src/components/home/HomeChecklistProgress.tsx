"use client";

import { useEffect, useState } from "react";
import { readLocalChecklistProgress, useChecklistProgressIndex, useChecklistSession } from "@/lib/checklist-progress-client";

/** Saved progress for one checklist: the account's count when signed in, this browser's otherwise. */
export function HomeChecklistProgress({ slug, total }: { slug: string; total: number | null }) {
  const session = useChecklistSession();
  const progressIndex = useChecklistProgressIndex(session.status === "ready" ? session.userId : null);
  const [localDone, setLocalDone] = useState(0);

  useEffect(() => {
    setLocalDone(readLocalChecklistProgress(slug).length);
  }, [slug]);

  const tasks = total ?? 0;
  const accountDone = session.userId && progressIndex.userId === session.userId ? (progressIndex.counts[slug] ?? 0) : 0;
  const done = Math.min(session.userId ? accountDone : localDone, tasks);
  const percent = tasks ? Math.round((done / tasks) * 100) : 0;

  return (
    <span className="mt-1.5 block">
      <span className="flex items-center justify-between gap-3 text-xs">
        {done ? (
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">You're {percent}% there</span>
        ) : (
          <span className="text-muted">Not started</span>
        )}
        <span className="text-muted">{done ? `${done} / ${tasks}` : `${tasks} tasks`}</span>
      </span>
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}
