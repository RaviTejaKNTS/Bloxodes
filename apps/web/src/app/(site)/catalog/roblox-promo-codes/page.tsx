import type { Metadata } from "next";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { buildPageContentHtml } from "@/lib/page-content";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import { CANONICAL, loadPromoRewards, renderPromoRewardsPage } from "./page-data";

export const revalidate = 21600;

const CATALOG_CODE = "roblox-promo-codes";
const FALLBACK_TITLE = `Roblox Promo Codes and Reward Items | ${SITE_NAME}`;
const FALLBACK_DESCRIPTION =
  "Browse Roblox promotional codes, experience codes, event rewards, and creator challenge items with their listed claim details.";

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
  const [catalog, rewards] = await Promise.all([
    getCatalogPageContentByCodes([CATALOG_CODE]),
    loadPromoRewards()
  ]);
  const contentHtml = await buildPageContentHtml(catalog);

  return renderPromoRewardsPage({
    items: rewards.items,
    sourceUpdatedAt: rewards.updatedAt,
    contentHtml
  });
}
