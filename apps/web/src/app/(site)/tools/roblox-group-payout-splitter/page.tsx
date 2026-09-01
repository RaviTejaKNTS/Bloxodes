import type { Metadata } from "next";

import { buildDedicatedToolMetadata, DedicatedToolPage } from "@/components/tools/DedicatedToolPage";
import { GroupPayoutSplitterClient } from "./GroupPayoutSplitterClient";

export const revalidate = 3600;

const TOOL_CODE = "roblox-group-payout-splitter";
const FALLBACK_TITLE = "Roblox Group Payout Splitter";
const FALLBACK_DESCRIPTION = "Split released Roblox group funds by percentage, weight, or fixed amount with transparent whole-Robux allocation and remainder handling.";

export function generateMetadata(): Promise<Metadata> {
  return buildDedicatedToolMetadata({ toolCode: TOOL_CODE, fallbackTitle: FALLBACK_TITLE, fallbackDescription: FALLBACK_DESCRIPTION });
}

export default function RobloxGroupPayoutSplitterPage() {
  return <DedicatedToolPage toolCode={TOOL_CODE} fallbackTitle={FALLBACK_TITLE} fallbackDescription={FALLBACK_DESCRIPTION} applicationCategory="Calculator"><GroupPayoutSplitterClient /></DedicatedToolPage>;
}
