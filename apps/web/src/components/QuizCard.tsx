"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { FiCheck, FiClock } from "react-icons/fi";
import { ContentCard } from "@/components/ContentCard";

type QuizCardProps = {
  code: string;
  title: string;
  summary: string;
  universeName: string | null;
  coverImage: string | null;
  updatedAt: string | null;
};

type QuizProgress = {
  code: string;
  lastScore: number | null;
  lastTotal: number | null;
};

type QuizProgressState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "ready"; progress: Map<string, QuizProgress> }
  | { status: "error" };

let quizProgressPromise: Promise<QuizProgressState> | null = null;

function formatUpdatedLabel(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  try {
    return formatDistanceToNow(new Date(updatedAt), { addSuffix: true });
  } catch {
    return null;
  }
}

async function loadQuizProgressIndex(): Promise<QuizProgressState> {
  if (!quizProgressPromise) {
    quizProgressPromise = fetch("/api/quizzes/progress", { credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) return { status: "signed-out" } as QuizProgressState;
        if (!res.ok) return { status: "error" } as QuizProgressState;
        const payload = await res.json().catch(() => ({}));
        const rows = Array.isArray(payload?.progress) ? payload.progress : [];
        const progress = new Map<string, QuizProgress>();
        for (const row of rows) {
          const rowCode = typeof row?.code === "string" ? row.code.trim().toLowerCase() : "";
          if (!rowCode) continue;
          progress.set(rowCode, {
            code: rowCode,
            lastScore: typeof row?.lastScore === "number" ? row.lastScore : null,
            lastTotal: typeof row?.lastTotal === "number" ? row.lastTotal : null
          });
        }
        return { status: "ready", progress } as QuizProgressState;
      })
      .catch(() => ({ status: "error" }) as QuizProgressState);
  }

  return quizProgressPromise;
}

export function QuizCard({ code, title, universeName, coverImage, updatedAt }: QuizCardProps) {
  const updatedLabel = formatUpdatedLabel(updatedAt);
  const [progressState, setProgressState] = useState<QuizProgressState>({ status: "loading" });
  const normalizedCode = code.trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;
    void loadQuizProgressIndex().then((state) => {
      if (!cancelled) setProgressState(state);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const progress = progressState.status === "ready" ? progressState.progress.get(normalizedCode) ?? null : null;
  const hasCompleted = Boolean(
    progress && typeof progress.lastScore === "number" && typeof progress.lastTotal === "number" && progress.lastTotal > 0
  );
  const statusLabel =
    progressState.status === "ready"
      ? hasCompleted
        ? "Completed"
        : "Not completed yet"
      : progressState.status === "signed-out" || progressState.status === "error"
        ? "15 questions"
        : "Checking progress";
  const scoreLabel = hasCompleted ? `${progress!.lastScore}/${progress!.lastTotal}` : null;

  return (
    <ContentCard
      type="quiz"
      href={`/quizzes/${code}`}
      title={`${universeName ?? "Roblox"} Quiz`}
      image={{ src: coverImage, alt: universeName || title, ratio: "1:1" }}
      meta={
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/70">
            <span className="inline-flex items-center gap-1.5">
              {hasCompleted ? <FiCheck aria-hidden className="h-3.5 w-3.5 text-green-400" /> : null}
              <span>{statusLabel}</span>
            </span>
            {scoreLabel ? <span>Last score: {scoreLabel}</span> : null}
          </div>
          {updatedLabel ? (
            <p className="mb-0 inline-flex items-center gap-1 text-xs text-foreground/70">
              <FiClock aria-hidden className="h-3 w-3" />
              <span>{updatedLabel}</span>
            </p>
          ) : null}
        </>
      }
    />
  );
}
