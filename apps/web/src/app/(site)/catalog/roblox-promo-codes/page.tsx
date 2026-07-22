import type { Metadata } from "next";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { buildPageContentHtml } from "@/lib/page-content";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import { CANONICAL, loadFreeItemsPreview, loadPromoRewards, renderPromoRewardsPage } from "./page-data";

export const revalidate = 21600;

const CATALOG_CODE = "roblox-promo-codes";
const FALLBACK_TITLE = `Roblox Promo Codes and Free Items | ${SITE_NAME}`;
const FALLBACK_DESCRIPTION =
  "Find Roblox promo codes and in-game codes for free items, with direct links to the correct Roblox redemption page or experience.";

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCatalogPageContentByCodes([CATALOG_CODE]);
  const title = resolveSeoTitle(catalog?.seo_title) ?? catalog?.title ?? FALLBACK_TITLE;
  const description = catalog?.meta_description ?? FALLBACK_DESCRIPTION;
  const image = catalog?.thumb_url || `${SITE_URL}/Bloxodes.png`;

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
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

export default async function RobloxPromoCodesPage() {
  const [catalog, rewards, freeItems] = await Promise.all([
    getCatalogPageContentByCodes([CATALOG_CODE]),
    loadPromoRewards(),
    loadFreeItemsPreview()
  ]);
  const contentHtml = await buildPageContentHtml(catalog);

  return renderPromoRewardsPage({
    items: rewards.items,
    freeItems,
    contentHtml
  });
}
