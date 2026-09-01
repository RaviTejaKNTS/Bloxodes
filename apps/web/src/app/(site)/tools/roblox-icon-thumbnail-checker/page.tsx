import type { Metadata } from "next";

import { buildDedicatedToolMetadata, DedicatedToolPage } from "@/components/tools/DedicatedToolPage";
import { IconThumbnailCheckerClient } from "./IconThumbnailCheckerClient";

export const revalidate = 3600;

const TOOL_CODE = "roblox-icon-thumbnail-checker";
const FALLBACK_TITLE = "Roblox Icon and Thumbnail Checker";
const FALLBACK_DESCRIPTION = "Inspect a local image for Roblox experience icon, detail thumbnail, and Home personalization dimensions, aspect ratio, format, file size, and crop risk.";

export function generateMetadata(): Promise<Metadata> {
  return buildDedicatedToolMetadata({ toolCode: TOOL_CODE, fallbackTitle: FALLBACK_TITLE, fallbackDescription: FALLBACK_DESCRIPTION });
}

export default function RobloxIconThumbnailCheckerPage() {
  return <DedicatedToolPage toolCode={TOOL_CODE} fallbackTitle={FALLBACK_TITLE} fallbackDescription={FALLBACK_DESCRIPTION} applicationCategory="DesignApplication"><IconThumbnailCheckerClient /></DedicatedToolPage>;
}
