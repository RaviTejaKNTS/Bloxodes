import { finalizeCatalogMetadata } from "@/lib/catalog-metadata";
import type { Metadata } from "next";
import { MusicChartPage, buildMusicChartMetadata } from "../../../chart-page";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) return finalizeCatalogMetadata({});
  return buildMusicChartMetadata("trending", pageNumber);
}

export default async function TrendingMusicIdsPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  return <MusicChartPage chart="trending" pageNumber={Number(page)} />;
}
