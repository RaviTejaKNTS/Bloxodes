import type { Metadata } from "next";
import { MusicChartsPage, buildMusicChartsMetadata } from "../../../charts-page";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ page: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return {};
  return buildMusicChartsMetadata(pageNumber);
}

export default async function RobloxMusicIdsChartsPaginatedPage({ params, searchParams }: PageProps) {
  const { page } = await params;
  return <MusicChartsPage pageNumber={Number(page)} searchParams={searchParams} />;
}
