import type { Metadata } from "next";

import { buildDedicatedToolMetadata, DedicatedToolPage } from "@/components/tools/DedicatedToolPage";
import { ServerMemoryCapacityPlannerClient } from "./ServerMemoryCapacityPlannerClient";

export const revalidate = 3600;

const TOOL_CODE = "roblox-server-memory-capacity-planner";
const FALLBACK_TITLE = "Roblox Server Memory and Capacity Planner";
const FALLBACK_DESCRIPTION = "Project Roblox server memory at a target player count from measured samples, the current dynamic allocation formula, reserves, and heartbeat checks.";

export function generateMetadata(): Promise<Metadata> {
  return buildDedicatedToolMetadata({ toolCode: TOOL_CODE, fallbackTitle: FALLBACK_TITLE, fallbackDescription: FALLBACK_DESCRIPTION });
}

export default function RobloxServerMemoryCapacityPlannerPage() {
  return <DedicatedToolPage toolCode={TOOL_CODE} fallbackTitle={FALLBACK_TITLE} fallbackDescription={FALLBACK_DESCRIPTION} applicationCategory="DeveloperApplication"><ServerMemoryCapacityPlannerClient /></DedicatedToolPage>;
}
