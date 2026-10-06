import { QuizRunner } from "@/components/QuizRunner";
import { buildServerQuizAttempt } from "@/lib/quiz-attempts";
import { parseGameQuizData, type GameExtendedPage } from "@/lib/game-page-data";
import { GameContentPage } from "./GameContentPage";

export function GameQuizPage({ page }: { page: GameExtendedPage }) {
  const questions = parseGameQuizData(page.quiz_data);
  const code = `${page.namespace}:${page.slug}`;
  return <GameContentPage page={page}><QuizRunner quizCode={code} questions={questions} initialAttempt={buildServerQuizAttempt(questions,code)} progress={{sessionEndpoint:"/api/quizzes/session",progressEndpoint:`/api/games/${page.namespace}/quizzes/progress`}} /></GameContentPage>;
}
