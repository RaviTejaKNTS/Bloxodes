import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { loadCodesPageData, renderCodesPage, codesMetadata } from "../../page-data";
import { buildAlternates, SITE_URL } from "@/lib/seo";
import { CODES_INDEX_DESCRIPTION } from "../../index-content";

export const revalidate = 3600;

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(pageNumber)) return {};
  const title = pageNumber > 1 ? `Roblox Game Codes - Page ${pageNumber}` : "Roblox Game Codes";
  return {
    ...codesMetadata,
    title,
    alternates: buildAlternates(pageNumber === 1 ? "/codes" : `/codes/page/${pageNumber}`),
    openGraph: {
      ...codesMetadata.openGraph,
      title,
      url: `${SITE_URL}${pageNumber === 1 ? "/codes" : `/codes/page/${pageNumber}`}`
    },
    twitter: { card: "summary_large_image", title, description: CODES_INDEX_DESCRIPTION, images: [`${SITE_URL}/Bloxodes.png`] }
  };
}

export default async function CodesPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNumber = Number(page);
  if (!/^[1-9]\d*$/.test(page) || !Number.isSafeInteger(pageNumber)) {
    notFound();
  }
  if (pageNumber === 1) permanentRedirect("/codes");

  const { games, total, totalPages } = await loadCodesPageData(pageNumber);
  if (pageNumber > totalPages) {
    notFound();
  }

  return renderCodesPage({
    games,
    totalGames: total,
    totalPages,
    currentPage: pageNumber,
    showHero: pageNumber === 1
  });
}
