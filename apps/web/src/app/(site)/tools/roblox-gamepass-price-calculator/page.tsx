import type { Metadata } from "next";

import {
  buildDedicatedToolMetadata,
  DedicatedToolPage
} from "@/components/tools/DedicatedToolPage";
import { GamepassPriceCalculatorClient } from "./GamepassPriceCalculatorClient";

export const revalidate = 3600;

const TOOL_CODE = "roblox-gamepass-price-calculator";
const FALLBACK_TITLE = "Roblox Gamepass Price and Earnings Calculator";
const FALLBACK_DESCRIPTION =
  "Calculate the published 70% creator share, Roblox fee, reverse pass price, and sales estimate for a Roblox gamepass.";

export function generateMetadata(): Promise<Metadata> {
  return buildDedicatedToolMetadata({
    toolCode: TOOL_CODE,
    fallbackTitle: FALLBACK_TITLE,
    fallbackDescription: FALLBACK_DESCRIPTION
  });
}

export default function RobloxGamepassPriceCalculatorPage() {
  return (
    <DedicatedToolPage
      toolCode={TOOL_CODE}
      fallbackTitle={FALLBACK_TITLE}
      fallbackDescription={FALLBACK_DESCRIPTION}
      applicationCategory="Calculator"
    >
      <GamepassPriceCalculatorClient />
    </DedicatedToolPage>
  );
}
