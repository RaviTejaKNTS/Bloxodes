import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes, listPublishedCatalogCodes, type CatalogFaqEntry } from "@/lib/catalog";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { splitPathToSlug } from "@/lib/static-params";
import { buildPageContentHtml, renderPageContentNodes } from "@/lib/page-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { buildGameDatasetCatalogCopy, getGameDatasetCatalogConfigByCode } from "@/lib/game-dataset-catalogs";
import { getWikiCatalogPageByCode } from "@/lib/wiki-catalog";
import { loadGameDatasetCatalogDataset } from "../game-datasets/page-data";

export const revalidate = 21600;
const RESERVED_CATALOG_PREFIXES = [
  "admin-commands",
  "roblox-color-codes",
  "roblox-decal-ids",
  "free-roblox-items",
  "roblox-free-items",
  "roblox-music-ids",
  "roblox-items-and-bundles",
  "roblox-avatar-items",
  "roblox-accessories",
  "roblox-clothing",
  "roblox-body-parts",
  "roblox-emotes",
  "roblox-animations",
  "roblox-makeup",
  "the-forge",
  "grow-a-garden"
];
const RESERVED_CATALOG_CODE_PREFIXES = ["the-forge-", "grow-a-garden-"];

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

export async function generateStaticParams() {
  return [];
}

function normalizeCatalogCode(slugParts: string[]): string {
  return slugParts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/")
    .toLowerCase();
}

function isReservedCatalogCode(code: string): boolean {
  return (
    RESERVED_CATALOG_PREFIXES.some((prefix) => code === prefix || code.startsWith(`${prefix}/`)) ||
    RESERVED_CATALOG_CODE_PREFIXES.some((prefix) => code.startsWith(prefix))
  );
}

async function buildCatalogContent(code: string) {
  const catalog = await getCatalogPageContentByCodes([code]);
  return {
    contentHtml: await buildPageContentHtml(catalog)
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const code = normalizeCatalogCode(slug ?? []);
  const canonical = `${SITE_URL.replace(/\/$/, "")}/catalog/${code}`;
  if (!code) {
    return {
      alternates: buildAlternates(`${SITE_URL.replace(/\/$/, "")}/catalog`)
    };
  }

  const gameDatasetConfig = getGameDatasetCatalogConfigByCode(code);
  if (gameDatasetConfig) {
    const nextCanonical = `${SITE_URL.replace(/\/$/, "")}/wiki/${gameDatasetConfig.gameSlug}/${gameDatasetConfig.slug}`;
    const [dataset, catalog] = await Promise.all([
      loadGameDatasetCatalogDataset(gameDatasetConfig),
      getWikiCatalogPageByCode(code)
    ]);
    const generated = buildGameDatasetCatalogCopy({
      config: gameDatasetConfig,
      itemCount: dataset.items.length,
      columns: dataset.columns,
      imageUrls: getDatasetImageUrls(dataset.items)
    });
    const title = resolveSeoTitle(catalog?.seo_title) ?? catalog?.title ?? generated.seo_title;
    const description = catalog?.meta_description ?? generated.meta_description;
    const image = catalog?.thumb_url || generated.thumb_url || `${SITE_URL}/og-image.png`;

    return {
      title,
      description,
      alternates: buildAlternates(nextCanonical),
      openGraph: {
        type: "website",
        url: nextCanonical,
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

  const catalog = await getCatalogPageContentByCodes([code]);
  if (!catalog) {
    return {
      alternates: buildAlternates(canonical)
    };
  }

  const title = resolveSeoTitle(catalog.seo_title) ?? catalog.title ?? `Roblox Catalogs | ${SITE_NAME}`;
  const description = catalog.meta_description ?? CATALOG_DESCRIPTION;
  const image = catalog.thumb_url || `${SITE_URL}/og-image.png`;

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

export default async function CatalogFallbackPage({ params }: PageProps) {
  const { slug } = await params;
  const code = normalizeCatalogCode(slug ?? []);
  if (!code || isReservedCatalogCode(code)) {
    notFound();
  }

  const gameDatasetConfig = getGameDatasetCatalogConfigByCode(code);
  if (gameDatasetConfig) {
    permanentRedirect(`/wiki/${gameDatasetConfig.gameSlug}/${gameDatasetConfig.slug}`);
  }

  const { contentHtml } = await buildCatalogContent(code);
  if (!contentHtml) {
    notFound();
  }

  const title = contentHtml.title?.trim() ? contentHtml.title.trim() : "Roblox catalog";
  const introHtml = contentHtml.introHtml?.trim() ? contentHtml.introHtml : "";
  const howHtml = contentHtml.howHtml?.trim() ? contentHtml.howHtml : "";
  const descriptionHtml = contentHtml.descriptionHtml ?? [];
  const faqHtml = contentHtml.faqHtml ?? [];
  const introNodes = introHtml ? renderPageContentNodes(introHtml, "catalog-intro") : null;
  const descriptionNodes = descriptionHtml.map((entry) => ({
    key: entry.key,
    nodes: renderPageContentNodes(entry.html, `catalog-description-${entry.key}`)
  }));
  const howNodes = howHtml ? renderPageContentNodes(howHtml, "catalog-how") : null;
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `catalog-faq-${idx}`)
  }));

  return (
    <div className="catalog-surface space-y-10">
      <PageBreadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Catalog", href: "/catalog" },
          { label: title, href: null }
        ]}
      />
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={contentHtml.updatedAt} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes ? introNodes : null}

        {descriptionNodes.length ? descriptionNodes.flatMap((entry) => entry.nodes) : null}

        {howNodes ? howNodes : null}

        <ContentFaq
          items={faqNodes.map((faq, idx) => ({
            id: `${faq.q}-${idx}`,
            question: faq.q,
            answer: faq.nodes
          }))}
        />
      </section>

      {contentHtml?.id ? (
        <div className="mt-10">
          <CommentsSection entityType="catalog" entityId={contentHtml.id} />
        </div>
      ) : null}
    </div>
  );
}

function getDatasetImageUrls(items: Array<{ image?: string | null }>): string[] {
  return Array.from(
    new Set(
      items
        .map((item) => item.image)
        .filter((image): image is string => typeof image === "string" && image.length > 0)
    )
  ).slice(0, 6);
}
