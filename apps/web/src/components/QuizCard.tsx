"use client";

import { useEffect, useState } from "react";
import { FiCheck, FiClock } from "react-icons/fi";
import { DEFAULT_QUIZ_PROGRESS, ROBLOX_QUIZZES } from "@/lib/engagement/config";
import { loadQuizProgressIndex, type QuizProgressState } from "@/lib/quiz-progress-client";
import { ContentCard } from "@/components/ContentCard";

type QuizCardProps = {
  href?: string;
  progressEndpoint?: string;
  code: string;
  title: string;
  summary: string;
  gameName: string | null;
  coverImage: string | null;
  updatedAt: string | null;
  updatedLabel: string | null;
};

export function QuizCard({ code, title, gameName, coverImage, updatedLabel, href, progressEndpoint = DEFAULT_QUIZ_PROGRESS.progressEndpoint }: QuizCardProps) {
  const [progressState, setProgressState] = useState<QuizProgressState>({ status: "loading" });
  const normalizedCode = code.trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;
    void loadQuizProgressIndex(progressEndpoint).then((state) => {
      if (!cancelled) setProgressState(state);
    });

    return () => {
      cancelled = true;
    };
  }, [progressEndpoint]);

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
      href={href ?? `${ROBLOX_QUIZZES.basePath}/${code}`}
      title={gameName ? `${gameName} Quiz` : title}
      image={{ src: coverImage, alt: gameName || title, ratio: "1:1" }}
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
