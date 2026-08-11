import type { Metadata } from "next";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { renderMarkdown } from "@/lib/markdown";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import {
  CANONICAL,
  loadRobloxDictionaryData,
  renderRobloxDictionaryPage,
  type CatalogContentHtml
} from "./page-data";

export const revalidate = 86400;

const CATALOG_CODE_CANDIDATES = ["roblox-dictionary"];
const FALLBACK_IMAGE = `${SITE_URL}/Bloxodes.png`;

type DictionarySearchParams = {
  q?: string | string[];
  category?: string | string[];
  status?: string | string[];
  letter?: string | string[];
};

type DictionaryPageProps = {
  searchParams?: Promise<DictionarySearchParams>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function buildCatalogContent(): Promise<{ contentHtml: CatalogContentHtml | null }> {
  const catalog = await getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES);
  if (!catalog) return { contentHtml: null };

  const [introHtml, descriptionHtml, howHtml] = await Promise.all([
    catalog.intro_md ? renderMarkdown(catalog.intro_md, { paragraphizeLineBreaks: true }) : "",
    catalog.description_md ? renderMarkdown(catalog.description_md, { paragraphizeLineBreaks: true }) : "",
    catalog.how_it_works_md ? renderMarkdown(catalog.how_it_works_md, { paragraphizeLineBreaks: true }) : ""
  ]);
  const faqEntries = Array.isArray(catalog.faq_json) ? catalog.faq_json : [];
  const faqHtml = await Promise.all(
    faqEntries.map(async (entry) => ({
      q: entry.q,
      a: await renderMarkdown(entry.a ?? "", { paragraphizeLineBreaks: true })
    }))
  );

  return {
    contentHtml: {
      id: catalog.id ?? null,
      title: catalog.title ?? null,
      introHtml,
      descriptionHtml,
      howHtml,
      faqHtml,
      publishedAt: catalog.published_at ?? catalog.created_at ?? null,
      updatedAt: catalog.content_updated_at ?? catalog.updated_at ?? catalog.published_at ?? catalog.created_at ?? null
    }
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const [catalog, { meta }] = await Promise.all([
    getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES),
    loadRobloxDictionaryData()
  ]);
  const title = meta.itemCount
    ? `Roblox Dictionary [${meta.itemCount.toLocaleString("en-US")} Slang, Acronyms & Terms]`
    : catalog?.seo_title ?? catalog?.title ?? meta.title ?? "Roblox Dictionary: Slang, Acronyms & Terms";
  const description =
    catalog?.meta_description ??
    (catalog
      ? CATALOG_DESCRIPTION
      : "Look up Roblox slang, acronyms, and platform terms with definitions, expansions, examples, and current or legacy labels.");
  const image = catalog?.thumb_url || FALLBACK_IMAGE;

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

export default async function RobloxDictionaryPage({ searchParams }: DictionaryPageProps) {
  const [{ items, meta }, { contentHtml }, resolvedSearchParams] = await Promise.all([
    loadRobloxDictionaryData(),
    buildCatalogContent(),
    searchParams ?? Promise.resolve<DictionarySearchParams>({})
  ]);
  const category = firstParam(resolvedSearchParams.category);
  const status = firstParam(resolvedSearchParams.status);
  const letter = firstParam(resolvedSearchParams.letter).toUpperCase();
  const validCategories = new Set([
    "chat-and-social",
    "gameplay",
    "accounts-and-safety",
    "avatars-and-marketplace",
    "creator-and-studio",
    "classic-roblox"
  ]);

  return renderRobloxDictionaryPage({
    items,
    updatedAt: contentHtml?.updatedAt ?? meta.updatedAt ?? null,
    contentHtml,
    filters: {
      query: firstParam(resolvedSearchParams.q).trim().slice(0, 100),
      category: validCategories.has(category) ? category : null,
      status: status === "current" || status === "legacy" ? status : null,
      letter: letter === "#" || /^[A-Z]$/.test(letter) ? letter : null
    }
  });
}
