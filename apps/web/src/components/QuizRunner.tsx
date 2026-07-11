"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuizData, QuizOption, QuizQuestion } from "@/lib/quiz-types";
import { ProgressBar } from "@/components/ProgressBar";
import {
  buildQuizAttempt,
  QUIZ_LEVEL_CONFIG,
  type QuizAttemptQuestion,
  type QuizDifficulty
} from "@/lib/quiz-attempts";
import { trackUmamiEvent } from "@/lib/umami";

const STORAGE_VERSION = 1;

type Difficulty = QuizDifficulty;
type AttemptQuestion = QuizAttemptQuestion;

type QuizRunnerProps = {
  quizCode: string;
  questions: QuizData;
  initialAttempt?: AttemptQuestion[];
  heroImage?: string | null;
  heroAlt?: string | null;
  /** Deep-link from the sidebar quiz card: pre-answers question 1 and starts at question 2. */
  startAnswerOptionId?: string;
};

type SessionState = { status: "loading" | "ready"; userId: string | null };

type Breakdown = Record<Difficulty, { correct: number; total: number }>;

type PersistedQuestion = {
  id: string;
  difficulty: Difficulty;
  optionOrder: string[];
};

type PersistedState = {
  version: number;
  attempt: PersistedQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  showSummary: boolean;
  savedAttemptKey?: string | null;
};

function mergeSeenIds(existing: string[], additions: string[]): string[] {
  const merged = new Set(existing);
  additions.forEach((id) => merged.add(id));
  return Array.from(merged);
}

function formatDifficulty(value: Difficulty) {
  if (value === "easy") return "Easy";
  if (value === "medium") return "Medium";
  return "Hard";
}

function buildQuestionMap(quizData: QuizData) {
  const map = new Map<string, { question: QuizQuestion; difficulty: Difficulty }>();
  for (const question of quizData.easy ?? []) {
    map.set(question.id, { question, difficulty: "easy" });
  }
  for (const question of quizData.medium ?? []) {
    map.set(question.id, { question, difficulty: "medium" });
  }
  for (const question of quizData.hard ?? []) {
    map.set(question.id, { question, difficulty: "hard" });
  }
  return map;
}

function toPersistedAttempt(attempt: AttemptQuestion[]): PersistedQuestion[] {
  return attempt.map((question) => ({
    id: question.id,
    difficulty: question.difficulty,
    optionOrder: (question.options ?? []).map((option) => option.id)
  }));
}

function restoreAttempt(persisted: PersistedQuestion[], quizData: QuizData): AttemptQuestion[] | null {
  if (!Array.isArray(persisted) || persisted.length !== 15) return null;
  const questionMap = buildQuestionMap(quizData);
  const attempt: AttemptQuestion[] = [];

  for (const entry of persisted) {
    if (!entry || typeof entry.id !== "string") return null;
    const source = questionMap.get(entry.id);
    if (!source) return null;
    const difficulty = source.difficulty;
    const sourceQuestion = source.question;
    const optionsById = new Map((sourceQuestion.options ?? []).map((option) => [option.id, option]));
    const orderedOptions: QuizOption[] = [];
    const seenOptionIds = new Set<string>();

    for (const optionId of entry.optionOrder ?? []) {
      const option = optionsById.get(optionId);
      if (!option || seenOptionIds.has(optionId)) continue;
      seenOptionIds.add(optionId);
      orderedOptions.push(option);
    }

    for (const option of sourceQuestion.options ?? []) {
      if (seenOptionIds.has(option.id)) continue;
      orderedOptions.push(option);
    }

    if (!orderedOptions.length || !orderedOptions.find((option) => option.id === sourceQuestion.correctOptionId)) {
      return null;
    }

    attempt.push({
      ...sourceQuestion,
      difficulty,
      options: orderedOptions
    });
  }

  const expectedOrder: Difficulty[] = [
    ...Array.from({ length: QUIZ_LEVEL_CONFIG.easy }, () => "easy" as const),
    ...Array.from({ length: QUIZ_LEVEL_CONFIG.medium }, () => "medium" as const),
    ...Array.from({ length: QUIZ_LEVEL_CONFIG.hard }, () => "hard" as const)
  ];

  if (attempt.length !== expectedOrder.length) return null;
  for (let i = 0; i < expectedOrder.length; i += 1) {
    if (attempt[i]?.difficulty !== expectedOrder[i]) return null;
  }

  return attempt;
}

function sanitizeAnswers(
  answers: Record<string, string>,
  attempt: AttemptQuestion[]
): Record<string, string> {
  const result: Record<string, string> = {};
  const questionMap = new Map(attempt.map((question) => [question.id, question]));
  for (const [questionId, optionId] of Object.entries(answers)) {
    const question = questionMap.get(questionId);
    if (!question) continue;
    if ((question.options ?? []).some((option) => option.id === optionId)) {
      result[questionId] = optionId;
    }
  }
  return result;
}

function getStorageKey(quizCode: string) {
  return `quiz:${quizCode}:state:v${STORAGE_VERSION}`;
}

export function QuizRunner(props: QuizRunnerProps) {
  const { quizCode, questions } = props;
  const initialAttempt = props.initialAttempt ?? [];
  const heroImage = props.heroImage ?? null;
  const heroAlt = props.heroAlt ?? null;
  const [session, setSession] = useState<SessionState>({ status: "loading", userId: null });
  const [progressStatus, setProgressStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [seenQuestionIds, setSeenQuestionIds] = useState<string[]>([]);
  const [attempt, setAttempt] = useState<AttemptQuestion[]>(() => initialAttempt);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [savedAttemptKey, setSavedAttemptKey] = useState<string | null>(null);
  const lastSavedAttempt = useRef<string | null>(null);
  const storageKey = useMemo(() => getStorageKey(quizCode), [quizCode]);
  const initializedStorageKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const res = await fetch("/api/quizzes/session", { credentials: "include" });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        const userId = typeof payload?.userId === "string" ? payload.userId : null;
        setSession({ status: "ready", userId });
      } catch {
        if (!cancelled) {
          setSession({ status: "ready", userId: null });
        }
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      setProgressStatus("loading");
      try {
        const res = await fetch(`/api/quizzes/progress?code=${encodeURIComponent(quizCode)}`, {
          credentials: "include"
        });
        if (!res.ok) {
          if (!cancelled) {
            setSeenQuestionIds([]);
            setProgressStatus("ready");
          }
          return;
        }
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        const ids = Array.isArray(payload?.seenQuestionIds) ? payload.seenQuestionIds : [];
        setSeenQuestionIds(ids.filter((id: unknown) => typeof id === "string" && id.trim()));
        setProgressStatus("ready");
      } catch {
        if (!cancelled) {
          setSeenQuestionIds([]);
          setProgressStatus("ready");
        }
      }
    }

    if (session.status === "ready" && session.userId) {
      void loadProgress();
      return () => {
        cancelled = true;
      };
    }

    if (session.status === "ready" && !session.userId) {
      setSeenQuestionIds([]);
      setProgressStatus("ready");
    }

    return () => {
      cancelled = true;
    };
  }, [session.status, session.userId, quizCode]);

  const readyToStart = session.status === "ready" && progressStatus === "ready";
  const canInteract = readyToStart;

  const startNewAttempt = useCallback(() => {
    const nextAttempt = buildQuizAttempt(questions, seenQuestionIds);
    setAttempt(nextAttempt);
    setCurrentIndex(0);
    setAnswers({});
    setShowSummary(false);
    setSavedAttemptKey(null);
    lastSavedAttempt.current = null;
  }, [questions, seenQuestionIds]);

  useEffect(() => {
    if (!readyToStart) return;
    if (initializedStorageKey.current === storageKey) return;
    initializedStorageKey.current = storageKey;

    const queryStartAnswerOptionId =
      props.startAnswerOptionId ??
      (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("qa") || undefined : undefined);

    if (queryStartAnswerOptionId && initialAttempt.length) {
      const first = initialAttempt[0];
      if (first && (first.options ?? []).some((option) => option.id === queryStartAnswerOptionId)) {
        setAttempt(initialAttempt);
        setAnswers({ [first.id]: queryStartAnswerOptionId });
        setCurrentIndex(1);
        setShowSummary(false);
        setSavedAttemptKey(null);
        lastSavedAttempt.current = null;
        return;
      }
    }

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? (JSON.parse(raw) as PersistedState) : null;
        if (parsed && parsed.version === STORAGE_VERSION && Array.isArray(parsed.attempt)) {
          const restoredAttempt = restoreAttempt(parsed.attempt, questions);
          if (restoredAttempt) {
            const rawAnswers =
              parsed.answers && typeof parsed.answers === "object" && !Array.isArray(parsed.answers)
                ? (parsed.answers as Record<string, string>)
                : {};
            const restoredAnswers = sanitizeAnswers(rawAnswers, restoredAttempt);
            const answeredCount = Object.keys(restoredAnswers).length;
            const total = restoredAttempt.length;
            const restoredShowSummary = Boolean(parsed.showSummary && answeredCount === total);
            if (answeredCount > 0 || restoredShowSummary) {
              const safeIndex = Math.min(
                Math.max(Number.isFinite(parsed.currentIndex) ? parsed.currentIndex : 0, 0),
                Math.max(0, total - 1)
              );
              setAttempt(restoredAttempt);
              setAnswers(restoredAnswers);
              setCurrentIndex(safeIndex);
              setShowSummary(restoredShowSummary);
              setSavedAttemptKey(parsed.savedAttemptKey ?? null);
              if (parsed.savedAttemptKey) {
                lastSavedAttempt.current = parsed.savedAttemptKey;
              }
              return;
            }

            try {
              window.localStorage.removeItem(storageKey);
            } catch {
              // ignore storage failures
            }
          }
        }
      } catch {
        // Ignore invalid stored state
      }
    }

    if (initialAttempt.length && seenQuestionIds.length === 0) {
      setAttempt(initialAttempt);
      setCurrentIndex(0);
      setAnswers({});
      setShowSummary(false);
      setSavedAttemptKey(null);
      lastSavedAttempt.current = null;
      return;
    }

    startNewAttempt();
  }, [readyToStart, startNewAttempt, questions, storageKey, initialAttempt, seenQuestionIds.length, props.startAnswerOptionId]);

  const currentQuestion = attempt[currentIndex] ?? null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const answeredCount = Object.keys(answers).length;

  const breakdown = useMemo<Breakdown>(() => {
    const base: Breakdown = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 }
    };
    for (const question of attempt) {
      base[question.difficulty].total += 1;
      if (answers[question.id] === question.correctOptionId) {
        base[question.difficulty].correct += 1;
      }
    }
    return base;
  }, [attempt, answers]);

  const totalCorrect = breakdown.easy.correct + breakdown.medium.correct + breakdown.hard.correct;
  const totalQuestions = attempt.length;
  const progressPercent = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const totalAvailableQuestions = (questions.easy?.length ?? 0) + (questions.medium?.length ?? 0) + (questions.hard?.length ?? 0);

  useEffect(() => {
    if (!showSummary || !attempt.length) return;
    const attemptKey = attempt.map((question) => question.id).join("|");
    if (attemptKey && lastSavedAttempt.current === attemptKey) return;

    const attemptIds = attempt.map((question) => question.id);
    const merged = mergeSeenIds(seenQuestionIds, attemptIds);
    setSeenQuestionIds(merged);
    lastSavedAttempt.current = attemptKey || "saved";
    setSavedAttemptKey(attemptKey || "saved");

    trackUmamiEvent("quiz_finished", {
      quiz_code: quizCode,
      score: totalCorrect,
      total: totalQuestions
    });

    if (!session.userId) return;

    void fetch("/api/quizzes/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        code: quizCode,
        questionIds: merged,
        score: totalCorrect,
        total: totalQuestions,
        breakdown
      })
    });
  }, [showSummary, session.userId, attempt, quizCode, totalCorrect, totalQuestions, breakdown, seenQuestionIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!attempt.length) return;

    if (answeredCount === 0) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore storage failures
      }
      return;
    }

    const payload: PersistedState = {
      version: STORAGE_VERSION,
      attempt: toPersistedAttempt(attempt),
      currentIndex,
      answers,
      showSummary,
      savedAttemptKey
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }, [attempt, currentIndex, answers, showSummary, savedAttemptKey, storageKey, answeredCount]);

  const handleSelectOption = (optionId: string) => {
    if (!canInteract) return;
    if (!currentQuestion || currentAnswer) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
  };

  const handleNext = () => {
    if (!canInteract) return;
    if (!currentQuestion || !currentAnswer) return;
    const isLast = currentIndex >= attempt.length - 1;
    if (isLast) {
      setShowSummary(true);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const handleRestart = () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore storage failures
      }
    }
    startNewAttempt();
  };

  const handleReloadQuiz = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore storage failures
    }
    window.location.reload();
  };

  if (!attempt.length && !readyToStart) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-card p-8 text-center text-muted">
        Preparing your quiz...
      </div>
    );
  }

  if (!attempt.length) {
    if (totalAvailableQuestions === 0) {
      return (
        <div className="rounded-lg border border-dashed border-border/70 bg-card p-8 text-center text-muted">
          No quiz questions available yet.
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-card p-8 text-center text-muted">
        Preparing your quiz...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!showSummary ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            <span className="rounded-md border border-border/70 bg-surface-muted px-2.5 py-1 text-accent">
              {formatDifficulty(currentQuestion?.difficulty ?? "easy")}
            </span>
            <span>
              Question {currentIndex + 1} of {totalQuestions}
            </span>
          </div>

          <ProgressBar percent={progressPercent} label="Quiz progress" />

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:items-start">
            <h2 className="text-2xl font-semibold leading-snug text-foreground md:text-3xl">{currentQuestion?.question}</h2>
            {currentQuestion?.image || heroImage ? (
              <div className="aspect-video overflow-hidden rounded-lg bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentQuestion?.image || heroImage || ""}
                  alt={heroAlt || "Quiz image"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : null}
          </div>

          <div className="grid gap-3">
            {(currentQuestion?.options ?? []).map((option, index) => {
              const label = String.fromCharCode(65 + index);
              const selected = currentAnswer === option.id;
              const isCorrect = currentQuestion?.correctOptionId === option.id;
              const showResult = Boolean(currentAnswer);
              const baseClass =
                "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors";
              const stateClass = showResult
                ? selected
                  ? isCorrect
                    ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                    : "border-rose-500/70 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                  : isCorrect
                    ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-300"
                    : "border-border/70 bg-background text-foreground"
                : "border-border/70 bg-background text-foreground hover:border-border hover:bg-surface-muted";

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`${baseClass} ${stateClass}`}
                  onClick={() => handleSelectOption(option.id)}
                  disabled={!canInteract || Boolean(currentAnswer)}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-muted text-xs font-semibold uppercase">
                    {label}
                  </span>
                  <span className="flex-1">{option.text}</span>
                </button>
              );
            })}
          </div>

          {currentAnswer ? (
            <div
              className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
                currentAnswer === currentQuestion?.correctOptionId
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300"
              }`}
            >
              {currentAnswer === currentQuestion?.correctOptionId
                ? "Correct!"
                : `Wrong. The correct answer is ${
                    currentQuestion?.options.find((option) => option.id === currentQuestion.correctOptionId)?.text ?? ""
                  }.`}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-md border border-border/70 bg-background px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-surface-muted"
              onClick={handleReloadQuiz}
            >
              Reload Quiz
            </button>
            <button
              type="button"
              className="rounded-md bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-accent/40"
              onClick={handleNext}
              disabled={!canInteract || !currentAnswer}
            >
              {currentIndex >= attempt.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/70 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Final Score</p>
              <p className="text-3xl font-semibold text-foreground">
                {totalCorrect}/{totalQuestions}
              </p>
              <p className="text-xs text-muted">
                Correct {totalCorrect} · Wrong {Math.max(0, totalQuestions - totalCorrect)}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-accent/90"
              onClick={handleRestart}
            >
              Play Again
            </button>
            <button
              type="button"
              className="rounded-md border border-border/70 bg-background px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-surface-muted"
              onClick={handleReloadQuiz}
            >
              Reload Quiz
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {(Object.keys(QUIZ_LEVEL_CONFIG) as Difficulty[]).map((level) => (
              <div key={level} className="rounded-lg border border-border/70 bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{formatDifficulty(level)}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {breakdown[level].correct}/{breakdown[level].total}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-border/70 bg-background px-4 py-3 text-xs text-muted">
            If you are logged in, we will save your quiz history to keep your progress across attempts.
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-base font-semibold text-foreground">Answer review</h3>
            <div className="space-y-3">
              {attempt.map((question, index) => {
                const selectedId = answers[question.id];
                const selectedOption = question.options.find((option) => option.id === selectedId)?.text ?? "Not answered";
                const correctOption = question.options.find((option) => option.id === question.correctOptionId)?.text ?? "";
                const isCorrect = selectedId === question.correctOptionId;

                return (
                  <div key={question.id} className="rounded-lg border border-border/70 bg-background p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {index + 1}. {question.question}
                      </p>
                      <span
                        className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          isCorrect
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-300"
                        }`}
                      >
                        {isCorrect ? "Correct" : "Wrong"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted">Your answer: {selectedOption}</p>
                    <p className="text-xs text-muted">Correct answer: {correctOption}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
