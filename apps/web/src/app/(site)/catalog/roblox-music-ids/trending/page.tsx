import type { Metadata } from "next";
import { MusicChartPage, buildMusicChartMetadata } from "../chart-page";

export const revalidate = 21600;

export async function generateMetadata(): Promise<Metadata> {
  return buildMusicChartMetadata("trending");
}

export default function TrendingMusicIdsPage() {
  return <MusicChartPage chart="trending" />;
}
