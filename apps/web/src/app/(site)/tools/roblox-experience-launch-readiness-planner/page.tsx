import type { Metadata } from "next";

import { buildDedicatedToolMetadata, DedicatedToolPage } from "@/components/tools/DedicatedToolPage";
import { ExperienceLaunchReadinessPlannerClient } from "./ExperienceLaunchReadinessPlannerClient";

export const revalidate = 3600;

const TOOL_CODE = "roblox-experience-launch-readiness-planner";
const FALLBACK_TITLE = "Roblox Experience Launch Readiness Planner";
const FALLBACK_DESCRIPTION = "Build a Roblox launch checklist with documented publication blockers and practical checks for testing, performance, saves, purchases, and monitoring.";

export function generateMetadata(): Promise<Metadata> {
  return buildDedicatedToolMetadata({ toolCode: TOOL_CODE, fallbackTitle: FALLBACK_TITLE, fallbackDescription: FALLBACK_DESCRIPTION });
}

export default function RobloxExperienceLaunchReadinessPlannerPage() {
  return <DedicatedToolPage toolCode={TOOL_CODE} fallbackTitle={FALLBACK_TITLE} fallbackDescription={FALLBACK_DESCRIPTION} applicationCategory="DeveloperApplication"><ExperienceLaunchReadinessPlannerClient /></DedicatedToolPage>;
}
