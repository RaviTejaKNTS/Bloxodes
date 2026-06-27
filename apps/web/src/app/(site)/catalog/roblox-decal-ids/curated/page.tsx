import type { Metadata } from "next";
import "@/styles/article-content.css";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import {
  buildDecalCuratedPath,
  loadRobloxDecalIdsPageData,
  resolveDecalSearch,
  renderRobloxDecalIdsPage
} from "../page-data";

export const revalidate = 21600;

const HEADING = "Curated Roblox Decal IDs";
const SEO_TITLE = "Best Roblox Decal IDs to Copy [Image IDs]";
const DESCRIPTION =
  "Find the best Roblox decal IDs for memes, anime, logos, faces, and image codes with previews and copy-ready IDs.";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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
      images: [`${SITE_URL}/og-image.png`]
    }
  };
}

export default async function CuratedRobloxDecalIdsPage({ searchParams }: PageProps) {
  const search = await resolveDecalSearch(searchParams);
  const { decals, total, totalPages } = await loadRobloxDecalIdsPageData(1, search, { curated: true });

  return renderRobloxDecalIdsPage({
    decals,
    total,
    totalPages,
    currentPage: 1,
    showHero: true,
    search: search.search,
    sort: search.sort,
    section: "curated",
    pageTitleOverride: HEADING,
    pageDescription: DESCRIPTION
  });
}
