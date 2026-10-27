import { catalogIdTitle } from "@/lib/catalog-id-title";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DECAL_IDS_PAGE_SIZE } from "@/lib/catalog-page-sizes";
import { isCatalogPageRangeValid } from "@/lib/catalog-pagination";
import "@/styles/article-content.css";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import {
    BASE_PATH,
    DECAL_PAGE_HEADING,
    DECAL_SEO_TITLE,
    loadRobloxDecalIdsPageData,
    renderRobloxDecalIdsPage,
} from "../../page-data";

export const revalidate = 21600;

const FALLBACK_IMAGE = `${SITE_URL}/Bloxodes.png`;

type PageProps = {
    params: Promise<{ page: string }>;
};

export async function generateStaticParams() {
    return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { page } = await params;
    if (!/^\d+$/.test(page)) notFound();
    const safePageNumber = Number(page);
    if (safePageNumber < 2 || !isCatalogPageRangeValid(safePageNumber, DECAL_IDS_PAGE_SIZE)) notFound();

    const title = catalogIdTitle(`${DECAL_SEO_TITLE} - Page ${safePageNumber}`);
    const description = CATALOG_DESCRIPTION;
    const image = FALLBACK_IMAGE;
    const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/page/${safePageNumber}`;

    return {
        title: catalogIdTitle(`${title} | ${SITE_NAME}`),
        description,
        // Paginated pages: noindex, follow
        robots: {
            index: false,
            follow: true,
            nocache: false,
            googleBot: {
                index: false,
                follow: true
            }
        },
        alternates: buildAlternates(canonicalUrl),
        openGraph: {
            type: "website",
            url: canonicalUrl,
            title,
            description,
            siteName: SITE_NAME,
            images: [image]
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [image]
        }
    };
}

export default async function RobloxDecalIdsPaginatedPage({ params }: PageProps) {
    const { page } = await params;
    if (!/^\d+$/.test(page)) notFound();
    const safePageNumber = Number(page);
    if (safePageNumber < 2 || !isCatalogPageRangeValid(safePageNumber, DECAL_IDS_PAGE_SIZE)) notFound();
    const { decals, total, totalPages } = await loadRobloxDecalIdsPageData(safePageNumber);
    if (safePageNumber > totalPages) notFound();

    return renderRobloxDecalIdsPage({
        decals,
        total,
        totalPages,
        currentPage: safePageNumber,
        showHero: false,
        pageTitleOverride: DECAL_PAGE_HEADING
    });
}
