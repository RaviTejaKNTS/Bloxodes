import type { Metadata } from "next";
import "@/styles/article-content.css";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  buildDecalCuratedPath,
  loadRobloxDecalIdsPageData,
  renderRobloxDecalIdsPage
} from "../page-data";

export const revalidate = 21600;

const HEADING = "Curated Roblox Decal IDs";
const SEO_TITLE = "Best Roblox Decal IDs to Copy [Image IDs]";
const DESCRIPTION =
  "Find the best Roblox decal IDs for memes, anime, logos, faces, and image codes with previews and copy-ready IDs.";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = `${SITE_URL.replace(/\/$/, "")}${buildDecalCuratedPath()}`;
  return {
    title: `${SEO_TITLE} | ${SITE_NAME}`,
    description: DESCRIPTION,
    robots: { index: false, follow: true },
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "website",
      url: canonical,
      title: SEO_TITLE,
      description: DESCRIPTION,
      siteName: SITE_NAME,
      images: [`${SITE_URL}/Bloxodes.png`]
    }
  };
}

export default async function CuratedRobloxDecalIdsPage() {
  const { decals, total, totalPages } = await loadRobloxDecalIdsPageData(1, undefined, { curated: true });

  return renderRobloxDecalIdsPage({
    decals,
    total,
    totalPages,
    currentPage: 1,
    showHero: true,
    section: "curated",
    pageTitleOverride: HEADING,
    pageDescription: DESCRIPTION
  });
}
