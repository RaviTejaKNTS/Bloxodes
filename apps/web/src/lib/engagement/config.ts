import { CHECKLISTS_DESCRIPTION, QUIZZES_DESCRIPTION } from "@/lib/seo";
import type { ChecklistConfig, QuizConfig, QuizProgressConfig } from "./types";

export const DEFAULT_QUIZ_PROGRESS: QuizProgressConfig = {
  sessionEndpoint: "/api/quizzes/session",
  progressEndpoint: "/api/quizzes/progress"
};
export const ROBLOX_CHECKLISTS: ChecklistConfig = {
  basePath: "/checklists", title: "Roblox Checklists",
  heading: "Guided Roblox checklists to track your progress",
  intro: "Actionable runbooks for your favorite experiences so you can mark off tasks, rewards, and codes as you play.",
  description: CHECKLISTS_DESCRIPTION, progressNamespace: ""
};
export const ROBLOX_QUIZZES: QuizConfig = {
  basePath: "/quizzes", title: "Roblox Quizzes", homePath: "/",
  heading: "Roblox quizzes to test in-game knowledge",
  intro: "Quick, replayable quizzes built from in-game mechanics, NPCs, and regions. Pick a game and take a 15-question run.",
  description: QUIZZES_DESCRIPTION, progressNamespace: "", progress: DEFAULT_QUIZ_PROGRESS
};

export function gameChecklistConfig(namespace: string, canonicalPath: string): ChecklistConfig {
  return { title: "Checklists", heading: "Checklists", intro: "", description: "Game completion checklists.", basePath: canonicalPath.slice(0, canonicalPath.lastIndexOf("/")), progressNamespace: namespace };
}
