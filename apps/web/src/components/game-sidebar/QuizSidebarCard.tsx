"use client";

import { useState } from "react";
import Link from "next/link";
import { CardImage } from "@/components/CardImage";
import { cn } from "@/lib/utils";

type Option = { id: string; text: string };

type QuizSidebarCardProps = {
  code: string;
  gameName: string;
  question: { id: string; question: string; image: string | null; options: Option[]; correctOptionId: string };
};

/**
 * Server-rendered shell (question + options + quiz link in the HTML for SEO),
 * hydrated so the first answer is interactive. Answering deep-links to the full
 * quiz at question 2 with this answer pre-recorded (`?qa=<optionId>`).
 */
export function QuizSidebarCard({ code, gameName, question }: QuizSidebarCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const continueHref = answered ? `/quizzes/${code}?qa=${encodeURIComponent(selected)}` : `/quizzes/${code}`;

  return (
    <section className="rounded-lg border border-border/70 bg-card p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/55">{gameName} Quiz</p>

      <div className="mb-3 flex items-start gap-3">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">{question.question}</p>
        {question.image ? (
          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface-muted">
            <CardImage src={question.image} alt="" />
          </span>
        ) : null}
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {question.options.map((option) => {
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
                  "h-full w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  state === "idle" && "border-border/60 hover:border-accent hover:bg-accent/5",
                  state === "correct" && "border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  state === "wrong" && "border-red-400/50 bg-red-500/10 text-red-600 dark:text-red-300",
                  state === "muted" && "border-border/40 text-muted"
                )}
              >
                {option.text}
              </button>
            </li>
          );
        })}
      </ul>

      <Link
        href={continueHref}
        prefetch={false}
        className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-border/60 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
      >
        {answered ? "Continue quiz →" : "Take the full quiz →"}
      </Link>
    </section>
  );
}
