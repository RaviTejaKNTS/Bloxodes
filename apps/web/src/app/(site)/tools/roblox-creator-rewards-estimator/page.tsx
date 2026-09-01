import type { Metadata } from "next";

import { buildDedicatedToolMetadata, DedicatedToolPage } from "@/components/tools/DedicatedToolPage";
import { CreatorRewardsEstimatorClient } from "./CreatorRewardsEstimatorClient";

export const revalidate = 3600;

const TOOL_CODE = "roblox-creator-rewards-estimator";
const FALLBACK_TITLE = "Roblox Creator Rewards Estimator";
const FALLBACK_DESCRIPTION = "Estimate Roblox Daily Engagement rewards and model the published Audience Expansion share from already-qualified Creator Dashboard inputs.";

export function generateMetadata(): Promise<Metadata> {
  return buildDedicatedToolMetadata({ toolCode: TOOL_CODE, fallbackTitle: FALLBACK_TITLE, fallbackDescription: FALLBACK_DESCRIPTION });
}

export default function RobloxCreatorRewardsEstimatorPage() {
  return <DedicatedToolPage toolCode={TOOL_CODE} fallbackTitle={FALLBACK_TITLE} fallbackDescription={FALLBACK_DESCRIPTION} applicationCategory="Calculator"><CreatorRewardsEstimatorClient /></DedicatedToolPage>;
}
