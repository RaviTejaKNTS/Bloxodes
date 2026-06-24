"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Option = { id: string; text: string };

type FeaturedQuizCardProps = {
  code: string;
  gameName: string;
  question: { id: string; question: string; options: Option[]; correctOptionId: string };
};

/**
 * Homepage "quiz of the day". Server-rendered shell (question + options + link in
 * the HTML for SEO); answering reveals correct/incorrect and deep-links into the
 * full quiz at question 2 via `?qa=<optionId>`.
 */
export function FeaturedQuizCard({ code, gameName, question }: FeaturedQuizCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const continueHref = answered ? `/quizzes/${code}?qa=${encodeURIComponent(selected)}` : `/quizzes/${code}`;

  return (
    <div className="rounded-lg border border-border/70 bg-card p-4 sm:p-5">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/55">{gameName} quiz</p>
      <p className="mb-4 text-base font-semibold leading-snug text-foreground">{question.question}</p>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {question.options.map((option, index) => {
          const isSelected = selected === option.id;
          const isCorrect = option.id === question.correctOptionId;
          const state = !answered ? "idle" : isCorrect ? "correct" : isSelected ? "wrong" : "muted";
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={answered}
                onClick={() => setSelected(option.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                  state === "idle" && "border-border/60 hover:border-accent hover:bg-accent/5",
                  state === "correct" && "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  state === "wrong" && "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-300",
                  state === "muted" && "border-border/40 text-muted"
                )}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border/60 bg-surface-muted text-xs font-semibold uppercase">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="flex-1">{option.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        href={continueHref}
        prefetch={false}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-accent-dark"
      >
        {answered ? "Continue the quiz" : "Play the full 15-question quiz"}
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
