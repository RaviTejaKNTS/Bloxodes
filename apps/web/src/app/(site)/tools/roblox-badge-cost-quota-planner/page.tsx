import type { Metadata } from "next";

import { buildDedicatedToolMetadata, DedicatedToolPage } from "@/components/tools/DedicatedToolPage";
import { BadgeCostQuotaPlannerClient } from "./BadgeCostQuotaPlannerClient";

export const revalidate = 3600;

const TOOL_CODE = "roblox-badge-cost-quota-planner";
const FALLBACK_TITLE = "Roblox Badge Cost and Quota Planner";
const FALLBACK_DESCRIPTION = "Plan Roblox badge creation costs and UTC free quotas across experiences, then check the published AwardBadgeAsync call budget separately.";

export function generateMetadata(): Promise<Metadata> {
  return buildDedicatedToolMetadata({ toolCode: TOOL_CODE, fallbackTitle: FALLBACK_TITLE, fallbackDescription: FALLBACK_DESCRIPTION });
}

export default function RobloxBadgeCostQuotaPlannerPage() {
  return <DedicatedToolPage toolCode={TOOL_CODE} fallbackTitle={FALLBACK_TITLE} fallbackDescription={FALLBACK_DESCRIPTION} applicationCategory="Calculator"><BadgeCostQuotaPlannerClient /></DedicatedToolPage>;
}
