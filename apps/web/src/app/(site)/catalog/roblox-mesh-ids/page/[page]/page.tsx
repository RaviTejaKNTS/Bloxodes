import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MESH_IDS_PAGE_SIZE } from "@/lib/catalog-page-sizes";
import { isCatalogPageRangeValid } from "@/lib/catalog-pagination";
import "@/styles/article-content.css";
import { loadRobloxMeshIdsPageData } from "@/lib/roblox-mesh-ids";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  BASE_PATH,
  FALLBACK_DESCRIPTION,
  FALLBACK_SEO_TITLE,
  renderMeshIdsPage
} from "../../page-data";

export const revalidate = 21600;

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = Number.parseInt((await params).page, 10);
  const safePage = Number.isFinite(page) && page > 1 ? page : 2;
  const title = `${FALLBACK_SEO_TITLE} - Page ${safePage}`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/page/${safePage}`;
  return {
    title: `${title} | ${SITE_NAME}`,
    description: FALLBACK_DESCRIPTION,
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
    alternates: buildAlternates(canonical),
    openGraph: { type: "website", url: canonical, title, description: FALLBACK_DESCRIPTION, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title, description: FALLBACK_DESCRIPTION }
  };
}

export default async function RobloxMeshIdsPaginatedPage({ params }: PageProps) {
  const rawPage = (await params).page;
  if (!/^\d+$/.test(rawPage)) notFound();
  const page = Number.parseInt(rawPage, 10);
  if (page < 2 || !isCatalogPageRangeValid(page, MESH_IDS_PAGE_SIZE)) notFound();
  const pageData = await loadRobloxMeshIdsPageData(page);
  if (page > pageData.totalPages) notFound();
  return renderMeshIdsPage({ ...pageData, currentPage: page, contentHtml: null });
}
