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
const gtaDescription = "Track your progress toward 100% completion in GTA games. Check off missions, activities and collectibles, and save your checklist as you play.";
export const GTA_CHECKLISTS: ChecklistConfig = {
  basePath: "/gta/checklists", title: "GTA Checklists",
  heading: "Guided GTA checklists to track your progress",
  intro: gtaDescription, description: gtaDescription, progressNamespace: "gta"
};
export const ROBLOX_QUIZZES: QuizConfig = {
  basePath: "/quizzes", title: "Roblox Quizzes", homePath: "/",
  heading: "Roblox quizzes to test in-game knowledge",
  intro: "Quick, replayable quizzes built from in-game mechanics, NPCs, and regions. Pick a game and take a 15-question run.",
  description: QUIZZES_DESCRIPTION, progressNamespace: "", progress: DEFAULT_QUIZ_PROGRESS
};
