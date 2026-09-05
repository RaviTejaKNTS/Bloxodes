import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { buildAlternates, SITE_URL } from "@/lib/seo";
import { loadWikiIndexPageData, renderWikiIndexPage } from "../../index-page-data";
import { wikiIndexOptions, wikiIndexQuery, type WikiSearchParams } from "@/lib/wiki-index-options";
import { WIKI_INDEX_DESCRIPTION } from "../../index-content";

export const revalidate = 21600;

type PageProps = { params: Promise<{ page: string }>; searchParams?: Promise<WikiSearchParams> };

function parsePage(value: string) {
  if (!/^[1-9]\d*$/.test(value)) notFound();
  const page = Number(value);
  if (!Number.isSafeInteger(page)) notFound();
  return page;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const page = parsePage((await params).page);
  const title = `Roblox Game Wikis - Page ${page}`;
  const url = `${SITE_URL}${page === 1 ? "/wiki" : `/wiki/page/${page}`}`;
  return {
    title,
    ...(wikiIndexQuery(wikiIndexOptions(await searchParams)) ? { robots: { index: false, follow: true } } : {}),
    description: WIKI_INDEX_DESCRIPTION,
    alternates: buildAlternates(url),
    openGraph: { type: "website", title, description: WIKI_INDEX_DESCRIPTION, url, images: [`${SITE_URL}/Bloxodes.png`] },
    twitter: { card: "summary_large_image", title, description: WIKI_INDEX_DESCRIPTION, images: [`${SITE_URL}/Bloxodes.png`] }
  };
}

export default async function WikiPaginatedPage({ params, searchParams }: PageProps) {
  const page = parsePage((await params).page);
  const filters = await searchParams;
  const query = wikiIndexQuery(wikiIndexOptions(filters));
  if (page === 1) permanentRedirect(query ? `/wiki?${query}#game-wikis` : "/wiki");
  const data = await loadWikiIndexPageData(page, filters);
  if (page > data.totalPages) notFound();
  return renderWikiIndexPage(data);
}
