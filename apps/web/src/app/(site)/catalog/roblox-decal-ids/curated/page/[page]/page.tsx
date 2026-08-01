import type { Metadata } from "next";
import "@/styles/article-content.css";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  buildDecalCuratedPath,
  loadRobloxDecalIdsPageData,
  renderRobloxDecalIdsPage
} from "../../../page-data";

export const revalidate = 21600;

const TITLE = "Curated Roblox Decal IDs";
const DESCRIPTION = "Browse the best Roblox decal IDs from curated lists, strong Roblox ratings, useful categories, and verified image previews.";

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number.parseInt(page, 10);
  const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildDecalCuratedPath()}/page/${safePageNumber}`;
  return {
    title: `${TITLE} - Page ${safePageNumber} | ${SITE_NAME}`,
    description: DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: buildAlternates(canonical)
  };
}

export default async function CuratedRobloxDecalIdsPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNumber = Number.parseInt(page, 10);
  const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const { decals, total, totalPages } = await loadRobloxDecalIdsPageData(safePageNumber, undefined, { curated: true });

  return renderRobloxDecalIdsPage({
    decals,
    total,
    totalPages,
    currentPage: safePageNumber,
    showHero: false,
    section: "curated",
    pageTitleOverride: TITLE,
    pageDescription: DESCRIPTION
  });
}
