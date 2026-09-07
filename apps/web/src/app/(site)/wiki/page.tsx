import type { Metadata } from "next";
import { buildAlternates, SITE_NAME, SITE_URL } from "@/lib/seo";
import { WIKI_INDEX_TITLE, WIKI_INDEX_DESCRIPTION } from "./index-content";
import { loadWikiIndexPageData, renderWikiIndexPage } from "./index-page-data";
import { wikiIndexOptions, wikiIndexQuery, type WikiSearchParams } from "@/lib/wiki-index-options";

export const revalidate = 21600;

type PageProps = { searchParams?: Promise<WikiSearchParams> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const filtered = Boolean(wikiIndexQuery(wikiIndexOptions(await searchParams)));
  return {
    title: WIKI_INDEX_TITLE,
    description: WIKI_INDEX_DESCRIPTION,
    alternates: buildAlternates(`${SITE_URL}/wiki`),
    openGraph: {
      type: "website",
      title: WIKI_INDEX_TITLE,
      description: WIKI_INDEX_DESCRIPTION,
      url: `${SITE_URL}/wiki`,
      siteName: SITE_NAME,
      images: [`${SITE_URL}/Bloxodes.png`]
    },
    twitter: {
      card: "summary_large_image",
      title: WIKI_INDEX_TITLE,
      description: WIKI_INDEX_DESCRIPTION,
      images: [`${SITE_URL}/Bloxodes.png`]
    },
    ...(filtered ? { robots: { index: false, follow: true } } : {})
  };
}

export default async function WikiIndexPage({ searchParams }: PageProps) {
  const data = await loadWikiIndexPageData(1, await searchParams);
  return renderWikiIndexPage(data);
}
