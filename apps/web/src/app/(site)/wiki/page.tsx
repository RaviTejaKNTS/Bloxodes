import type { Metadata } from "next";
import { buildAlternates, SITE_NAME, SITE_URL, WIKI_DESCRIPTION } from "@/lib/seo";
import { loadWikiIndexPageData, renderWikiIndexPage } from "./page-data";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: `Roblox Wiki | ${SITE_NAME}`,
  description: WIKI_DESCRIPTION,
  alternates: buildAlternates(`${SITE_URL}/wiki`),
  openGraph: {
    type: "website",
    title: `Roblox Wiki | ${SITE_NAME}`,
    description: WIKI_DESCRIPTION,
    url: `${SITE_URL}/wiki`,
    siteName: SITE_NAME,
    images: [`${SITE_URL}/og-image.png`]
  },
  twitter: {
    card: "summary_large_image",
    title: `Roblox Wiki | ${SITE_NAME}`,
    description: WIKI_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`]
  }
};

export default async function WikiIndexPage() {
  const data = await loadWikiIndexPageData();
  return renderWikiIndexPage(data);
}
