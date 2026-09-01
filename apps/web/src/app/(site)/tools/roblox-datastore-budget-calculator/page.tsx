import type { Metadata } from "next";

import { buildDedicatedToolMetadata, DedicatedToolPage } from "@/components/tools/DedicatedToolPage";
import { DataStoreBudgetCalculatorClient } from "./DataStoreBudgetCalculatorClient";

export const revalidate = 3600;

const TOOL_CODE = "roblox-datastore-budget-calculator";
const FALLBACK_TITLE = "Roblox DataStore Budget Calculator";
const FALLBACK_DESCRIPTION = "Estimate Roblox DataStore request demand against current server and experience limits, including UpdateAsync and OrderedDataStore budgets.";

export function generateMetadata(): Promise<Metadata> {
  return buildDedicatedToolMetadata({ toolCode: TOOL_CODE, fallbackTitle: FALLBACK_TITLE, fallbackDescription: FALLBACK_DESCRIPTION });
}

export default function RobloxDataStoreBudgetCalculatorPage() {
  return <DedicatedToolPage toolCode={TOOL_CODE} fallbackTitle={FALLBACK_TITLE} fallbackDescription={FALLBACK_DESCRIPTION} applicationCategory="DeveloperApplication"><DataStoreBudgetCalculatorClient /></DedicatedToolPage>;
}
