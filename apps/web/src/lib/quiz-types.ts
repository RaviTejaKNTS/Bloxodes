export type QuizOption = {
  id: string;
  text: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  image?: string | null;
};

export type QuizData = {
  easy: QuizQuestion[];
  medium: QuizQuestion[];
  hard: QuizQuestion[];
};

export const QUIZ_DIFFICULTIES = ["easy", "medium", "hard"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseQuizData(value: unknown, label = "quiz data"): QuizData {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);

  const questionIds = new Set<string>();
  const result = {} as QuizData;

  for (const difficulty of QUIZ_DIFFICULTIES) {
    const questions = value[difficulty];
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error(`${label}.${difficulty} must be a non-empty array.`);
    }

    result[difficulty] = questions.map((entry, questionIndex) => {
      const questionLabel = `${label}.${difficulty}[${questionIndex}]`;
      if (!isRecord(entry)) throw new Error(`${questionLabel} must be an object.`);

      const id = typeof entry.id === "string" ? entry.id.trim() : "";
      const question = typeof entry.question === "string" ? entry.question.trim() : "";
      const correctOptionId = typeof entry.correctOptionId === "string" ? entry.correctOptionId.trim() : "";
      if (!id || !question || !correctOptionId) {
        throw new Error(`${questionLabel} requires id, question, and correctOptionId.`);
      }
      if (questionIds.has(id)) throw new Error(`${label} contains duplicate question id ${id}.`);
      questionIds.add(id);

      if (!Array.isArray(entry.options) || entry.options.length !== 4) {
        throw new Error(`${questionLabel}.options must contain exactly four choices.`);
      }
      const optionIds = new Set<string>();
      const options = entry.options.map((option, optionIndex) => {
        if (!isRecord(option)) throw new Error(`${questionLabel}.options[${optionIndex}] must be an object.`);
        const optionId = typeof option.id === "string" ? option.id.trim() : "";
        const text = typeof option.text === "string" ? option.text.trim() : "";
        if (!optionId || !text) throw new Error(`${questionLabel}.options[${optionIndex}] requires id and text.`);
        if (optionIds.has(optionId)) throw new Error(`${questionLabel} contains duplicate option id ${optionId}.`);
        optionIds.add(optionId);
        return { id: optionId, text };
      });
      if (!optionIds.has(correctOptionId)) {
        throw new Error(`${questionLabel}.correctOptionId does not match an option.`);
      }

      const image = entry.image;
      if (image !== undefined && image !== null && typeof image !== "string") {
        throw new Error(`${questionLabel}.image must be a string or null.`);
      }

      return {
        id,
        question,
        options,
        correctOptionId,
        ...(image === undefined ? {} : { image: image as string | null })
      };
    });
  }

  return result;
}
