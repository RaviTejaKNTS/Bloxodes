import type { Metadata } from "next";
import { MusicChartsPage, buildMusicChartsMetadata } from "../charts-page";

export const revalidate = 21600;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata(): Metadata {
  return buildMusicChartsMetadata();
}

export default function RobloxMusicIdsChartsPage({ searchParams }: PageProps) {
  return <MusicChartsPage searchParams={searchParams} />;
}
