import type { Metadata } from "next";

import {
  buildDedicatedToolMetadata,
  DedicatedToolPage
} from "@/components/tools/DedicatedToolPage";
import { MarketplaceFeeCalculatorClient } from "./MarketplaceFeeCalculatorClient";

export const revalidate = 3600;

const TOOL_CODE = "roblox-marketplace-fee-calculator";
const FALLBACK_TITLE = "Roblox Marketplace and UGC Commission Calculator";
const FALLBACK_DESCRIPTION =
  "Estimate creator, experience-owner, and Roblox shares for paid non-Limited avatar-item sales on the Roblox Marketplace or inside an experience.";

export function generateMetadata(): Promise<Metadata> {
  return buildDedicatedToolMetadata({
    toolCode: TOOL_CODE,
    fallbackTitle: FALLBACK_TITLE,
    fallbackDescription: FALLBACK_DESCRIPTION
  });
}

export default function RobloxMarketplaceFeeCalculatorPage() {
  return (
    <DedicatedToolPage
      toolCode={TOOL_CODE}
      fallbackTitle={FALLBACK_TITLE}
      fallbackDescription={FALLBACK_DESCRIPTION}
      applicationCategory="Calculator"
    >
      <MarketplaceFeeCalculatorClient />
    </DedicatedToolPage>
  );
}
