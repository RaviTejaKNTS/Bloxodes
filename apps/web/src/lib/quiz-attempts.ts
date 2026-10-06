import type { QuizData, QuizOption, QuizQuestion } from "@/lib/quiz-types";

export const QUIZ_LEVEL_CONFIG = {
  easy: 5,
  medium: 5,
  hard: 5
} as const;

export type QuizDifficulty = keyof typeof QUIZ_LEVEL_CONFIG;

export type QuizAttemptQuestion = QuizQuestion & {
  difficulty: QuizDifficulty;
  options: QuizOption[];
};

type RandomSource = () => number;

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string): RandomSource {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle<T>(items: T[], random: RandomSource): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function pickQuestions(
  pool: QuizQuestion[],
  seenIds: Set<string>,
  count: number,
  random: RandomSource
): QuizQuestion[] {
  const unseen = pool.filter((question) => !seenIds.has(question.id));
  const picks: QuizQuestion[] = [];

  const unseenPicks = shuffle(unseen, random).slice(0, Math.min(count, unseen.length));
  picks.push(...unseenPicks);

  if (picks.length < count) {
    const remainingPool = pool.filter((question) => !picks.some((picked) => picked.id === question.id));
    picks.push(...shuffle(remainingPool, random).slice(0, count - picks.length));
  }

  return picks;
}

export function buildQuizAttempt(
  quizData: QuizData,
  seenQuestionIds: string[] = [],
  random: RandomSource = Math.random
): QuizAttemptQuestion[] {
  const seen = new Set(seenQuestionIds);
  const easy = pickQuestions(quizData.easy ?? [], seen, QUIZ_LEVEL_CONFIG.easy, random).map((question) => ({
    ...question,
    difficulty: "easy" as const,
    options: shuffle(question.options ?? [], random)
  }));
  const medium = pickQuestions(quizData.medium ?? [], seen, QUIZ_LEVEL_CONFIG.medium, random).map((question) => ({
    ...question,
    difficulty: "medium" as const,
    options: shuffle(question.options ?? [], random)
  }));
  const hard = pickQuestions(quizData.hard ?? [], seen, QUIZ_LEVEL_CONFIG.hard, random).map((question) => ({
    ...question,
    difficulty: "hard" as const,
    options: shuffle(question.options ?? [], random)
  }));

  return [...easy, ...medium, ...hard];
}

export function buildServerQuizAttempt(quizData: QuizData, quizCode: string): QuizAttemptQuestion[] {
  return buildQuizAttempt(quizData, [], createSeededRandom(`quiz:${quizCode}`));
}

export type PersistedQuizQuestion = {
  id: string;
  difficulty: QuizDifficulty;
  optionOrder: string[];
};

function buildQuestionMap(quizData: QuizData) {
  const map = new Map<string, { question: QuizQuestion; difficulty: QuizDifficulty }>();
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

export function restoreQuizAttempt(persisted: PersistedQuizQuestion[], quizData: QuizData): QuizAttemptQuestion[] | null {
  const expectedLength = Object.entries(QUIZ_LEVEL_CONFIG).reduce(
    (sum, [level, count]) => sum + Math.min(count, quizData[level as QuizDifficulty].length), 0
  );
  if (!Array.isArray(persisted) || persisted.length !== expectedLength) return null;
  const questionMap = buildQuestionMap(quizData);
  const attempt: QuizAttemptQuestion[] = [];

  const seenQuestionIds = new Set<string>();
  for (const entry of persisted) {
    if (!entry || typeof entry.id !== "string") return null;
    const source = questionMap.get(entry.id);
    if (!source || seenQuestionIds.has(entry.id)) return null;
    seenQuestionIds.add(entry.id);
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

  const expectedOrder: QuizDifficulty[] = [
    ...Array.from({ length: Math.min(QUIZ_LEVEL_CONFIG.easy, quizData.easy.length) }, () => "easy" as const),
    ...Array.from({ length: Math.min(QUIZ_LEVEL_CONFIG.medium, quizData.medium.length) }, () => "medium" as const),
    ...Array.from({ length: Math.min(QUIZ_LEVEL_CONFIG.hard, quizData.hard.length) }, () => "hard" as const)
  ];

  if (attempt.length !== expectedOrder.length) return null;
  for (let i = 0; i < expectedOrder.length; i += 1) {
    if (attempt[i]?.difficulty !== expectedOrder[i]) return null;
  }

  return attempt;
}
