import type { Metadata } from "next";
import "@/styles/article-content.css";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import {
    buildRobloxDecalCatalogContentHtml,
    CANONICAL,
    DECAL_PAGE_HEADING,
    DECAL_SEO_TITLE,
    loadRobloxDecalIdsPageData,
    renderRobloxDecalIdsPage,
} from "./page-data";

export const revalidate = 21600;

const CATALOG_CODE_CANDIDATES = ["roblox-decal-ids"];
const FALLBACK_IMAGE = `${SITE_URL}/Bloxodes.png`;
const FALLBACK_DESCRIPTION =
    "Browse searchable Roblox decal IDs for images, artwork, game creations, and easy-to-copy asset codes.";

export async function generateMetadata(): Promise<Metadata> {
    const catalog = await getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES);
    if (!catalog) {
        return {
            title: `${DECAL_SEO_TITLE} | ${SITE_NAME}`,
            description: FALLBACK_DESCRIPTION,
            alternates: buildAlternates(CANONICAL)
        };
    }

    const title = resolveSeoTitle(catalog.seo_title) ?? DECAL_SEO_TITLE;
    const description = catalog.meta_description?.trim() && catalog.meta_description.trim() !== CATALOG_DESCRIPTION
        ? catalog.meta_description.trim()
        : FALLBACK_DESCRIPTION;
    const image = catalog.thumb_url || FALLBACK_IMAGE;

    return {
        title,
        description,
        alternates: buildAlternates(CANONICAL),
        openGraph: {
            type: "website",
            url: CANONICAL,
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

export default async function RobloxDecalIdsPage() {
    const [{ decals, total, totalPages }, catalog] = await Promise.all([
        loadRobloxDecalIdsPageData(1),
        getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES)
    ]);
    const contentHtml = await buildRobloxDecalCatalogContentHtml(catalog);

    return renderRobloxDecalIdsPage({
        decals,
        total,
        totalPages,
        currentPage: 1,
        showHero: true,
        contentHtml,
        pageTitleOverride: DECAL_PAGE_HEADING
    });
}
