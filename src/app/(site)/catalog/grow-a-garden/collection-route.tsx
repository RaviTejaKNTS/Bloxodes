import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { renderMarkdown } from "@/lib/markdown";
import { getCatalogPageContentByCodes, type CatalogFaqEntry } from "@/lib/catalog";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import {
  buildGrowGardenCatalogCodeCandidates,
  buildGrowGardenCatalogPath,
  getGrowGardenCatalogConfig,
  loadGrowGardenCatalogDataset,
  renderGrowGardenCatalogPage,
  type GrowGardenCatalogConfig
} from "./page-data";
import type { CatalogContentHtml } from "../the-forge/page-data";

export const revalidate = 86400;

function sortDescriptionEntries(description: Record<string, string> | null | undefined) {
  return Object.entries(description ?? {}).sort((a, b) => {
    const left = Number.parseInt(a[0], 10);
    const right = Number.parseInt(b[0], 10);
    if (Number.isNaN(left) && Number.isNaN(right)) return a[0].localeCompare(b[0]);
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return left - right;
  });
}

async function buildCatalogContent(config: GrowGardenCatalogConfig): Promise<{ contentHtml: CatalogContentHtml | null }> {
  const catalog = await getCatalogPageContentByCodes(buildGrowGardenCatalogCodeCandidates(config));
  if (!catalog) {
    return { contentHtml: null };
  }

  const introHtml = catalog.intro_md ? await renderMarkdown(catalog.intro_md, { paragraphizeLineBreaks: true }) : "";
  const howHtml = catalog.how_it_works_md ? await renderMarkdown(catalog.how_it_works_md, { paragraphizeLineBreaks: true }) : "";

  const descriptionEntries = sortDescriptionEntries(catalog.description_json ?? {});
  const descriptionHtml = await Promise.all(
    descriptionEntries.map(async ([key, value]) => ({
      key,
      html: await renderMarkdown(value ?? "", { paragraphizeLineBreaks: true })
    }))
  );

  const faqEntries: CatalogFaqEntry[] = Array.isArray(catalog.faq_json) ? catalog.faq_json : [];
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
      howHtml,
      descriptionHtml,
      faqHtml,
      updatedAt: catalog.content_updated_at ?? catalog.updated_at ?? catalog.published_at ?? catalog.created_at ?? null,
      ctaLabel: catalog.cta_label ?? null,
      ctaUrl: catalog.cta_url ?? null
    }
  };
}

export async function generateGrowGardenCollectionMetadata(collection: string): Promise<Metadata> {
  const config = getGrowGardenCatalogConfig(collection);
  const canonicalPath = config ? buildGrowGardenCatalogPath(config.slug) : `/catalog/${collection}`;
  const canonical = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;

  if (!config) {
    return {
      title: `Grow a Garden Catalog | ${SITE_NAME}`,
      description: CATALOG_DESCRIPTION,
      alternates: buildAlternates(canonical)
    };
  }

  const dataset = await loadGrowGardenCatalogDataset(config);
  const count = dataset.items.length;
  const fallbackTitle = `All ${count.toLocaleString("en-US")} ${config.label} in Grow a Garden`;
  const catalog = await getCatalogPageContentByCodes(buildGrowGardenCatalogCodeCandidates(config));
  const title = resolveSeoTitle(catalog?.seo_title) ?? catalog?.title ?? fallbackTitle;
  const description = catalog?.meta_description ?? config.description ?? CATALOG_DESCRIPTION;
  const image = catalog?.thumb_url ?? `${SITE_URL}/og-image.png`;

  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "website",
      url: canonical,
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

export async function renderGrowGardenCollectionRoute(collection: string) {
  const config = getGrowGardenCatalogConfig(collection);
  if (!config) {
    notFound();
  }

  const [dataset, { contentHtml }] = await Promise.all([
    loadGrowGardenCatalogDataset(config),
    buildCatalogContent(config)
  ]);

  return renderGrowGardenCatalogPage({ config, dataset, contentHtml });
}
