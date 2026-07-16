import type { Metadata } from "next";
import "@/styles/article-content.css";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import {
    BASE_PATH,
    DECAL_PAGE_HEADING,
    DECAL_SEO_TITLE,
    loadRobloxDecalIdsPageData,
    resolveDecalSearch,
    renderRobloxDecalIdsPage,
} from "../../page-data";

export const revalidate = 21600;
export const dynamic = "force-dynamic";

const FALLBACK_IMAGE = `${SITE_URL}/Bloxodes.png`;

type PageProps = {
    params: Promise<{ page: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { page } = await params;
    const pageNumber = Number.parseInt(page, 10);
    const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;

    const title = `${DECAL_SEO_TITLE} - Page ${safePageNumber}`;
    const description = CATALOG_DESCRIPTION;
    const image = FALLBACK_IMAGE;
    const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/page/${safePageNumber}`;

    return {
        title: `${title} | ${SITE_NAME}`,
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

export default async function RobloxDecalIdsPaginatedPage({ params, searchParams }: PageProps) {
    const { page } = await params;
    const pageNumber = Number.parseInt(page, 10);
    const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const search = await resolveDecalSearch(searchParams);

    const { decals, total, totalPages } = await loadRobloxDecalIdsPageData(safePageNumber, search);

    return renderRobloxDecalIdsPage({
        decals,
        total,
        totalPages,
        currentPage: safePageNumber,
        showHero: false,
        search: search.search,
        sort: search.sort,
        pageTitleOverride: DECAL_PAGE_HEADING
    });
}
