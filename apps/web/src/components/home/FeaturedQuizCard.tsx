"use client";

import { useState } from "react";
import Link from "next/link";
import { CardImage } from "@/components/CardImage";
import { cn } from "@/lib/utils";
import type { HomeLink, HomeQuiz } from "@/lib/home-page-data";

/**
 * Homepage "quiz of the day": the first question is playable in place (question, options and link
 * are in the HTML), and answering deep-links into the full quiz at question 2.
 */
export function FeaturedQuizCard({ quiz, more }: { quiz: HomeQuiz; more: Array<HomeLink & { icon: string | null }> }) {
  const { code, gameName, icon, questionCount, question } = quiz;
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const continueHref = answered ? `/quizzes/${code}?qa=${encodeURIComponent(selected)}` : `/quizzes/${code}`;

  return (
    <div className="flex h-full flex-col rounded-lg border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
          <CardImage src={icon} alt="" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-foreground">{gameName} quiz</span>
          <span className="block text-sm text-muted">Question 1 of {questionCount}</span>
        </span>
      </div>
      <p className="mb-3 mt-4 text-lg font-semibold leading-snug text-foreground sm:text-xl">{question.question}</p>
      <ul className="grid gap-2 md:grid-cols-2">
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
                  "flex h-full w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  state === "idle" && "border-border/60 bg-secondary/40 hover:border-accent hover:bg-accent/5",
                  state === "correct" && "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  state === "wrong" && "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-300",
                  state === "muted" && "border-border/40 text-muted"
                )}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border/60 bg-card text-xs font-semibold uppercase">
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
        {answered ? "Continue the quiz" : `Play all ${questionCount} questions`}
        <span aria-hidden>→</span>
      </Link>
      {more.length ? (
        <div className="mt-auto">
          <p className="mt-4 border-t border-border/60 pt-4 text-sm font-semibold text-foreground">More quizzes</p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {more.map((entry) => (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-secondary/50 py-1 pl-1 pr-3 text-sm font-medium text-foreground transition-colors hover:border-accent/60"
                >
                  <span className="relative block h-6 w-6 overflow-hidden rounded-full bg-surface-muted">
                    <CardImage src={entry.icon} alt="" />
                  </span>
                  {entry.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
