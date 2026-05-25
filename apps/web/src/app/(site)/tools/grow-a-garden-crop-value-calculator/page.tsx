import type { Metadata } from "next";
import "@/styles/article-content.css";
import { SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { getToolContentWithDevFallback } from "@/lib/tools";
import { ContentSlot } from "@/components/ContentSlot";
import { loadCropDataset } from "@/lib/grow-a-garden/crops";
import { GrowGardenCropValueCalculatorClient } from "./GrowGardenCropValueCalculatorClient";
import { GAG_MUTATIONS, GAG_VARIANTS } from "@/lib/grow-a-garden/mutations";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { resolveModifiedAt, resolvePublishedAt } from "@/lib/content-dates";
import { buildPageContentHtml, renderPageContentNodes } from "@/lib/page-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";

export const revalidate = 0;

const TOOL_CODE = "grow-a-garden-crop-value-calculator";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/tools/${TOOL_CODE}`;
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;
const TOOL_AD_SLOT = "3529946151";

export async function generateMetadata(): Promise<Metadata> {
  const tool = await getToolContentWithDevFallback(TOOL_CODE);
  const title =
    resolveSeoTitle(tool?.seo_title) || tool?.title || "Grow a Garden Crop Value Calculator";
  const description =
    tool?.meta_description ||
    "Calculate Grow a Garden crop value using average value, weight, variants, and mutations with live breakdowns.";
  const image = tool?.thumb_url || FALLBACK_IMAGE;
  const publishedTime = tool ? resolvePublishedAt(tool) : null;
  const modifiedTime = tool ? resolveModifiedAt(tool) : null;

  return {
    title,
    description,
    alternates: buildAlternates(CANONICAL),
    openGraph: {
      type: "article",
      url: CANONICAL,
      title,
      description,
      siteName: SITE_NAME,
      images: [image],
      publishedTime: publishedTime ? new Date(publishedTime).toISOString() : undefined,
      modifiedTime: modifiedTime ? new Date(modifiedTime).toISOString() : undefined
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function GrowGardenCropValueCalculatorPage() {
  const [tool, cropDataset] = await Promise.all([
    getToolContentWithDevFallback(TOOL_CODE),
    loadCropDataset()
  ]);
  const contentHtml = await buildPageContentHtml(tool);
  const introNodes = contentHtml?.introHtml ? renderPageContentNodes(contentHtml.introHtml, "tool-intro") : null;
  const descriptionNodes = (contentHtml?.descriptionHtml ?? []).map((entry) => ({
    key: entry.key,
    nodes: renderPageContentNodes(entry.html, `tool-description-${entry.key}`)
  }));
  const howNodes = contentHtml?.howHtml ? renderPageContentNodes(contentHtml.howHtml, "tool-how") : null;
  const faqNodes = (contentHtml?.faqHtml ?? []).map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `tool-faq-${idx}`)
  }));
  const publishedTime = tool ? resolvePublishedAt(tool) : null;
  const modifiedTime = tool ? resolveModifiedAt(tool) : null;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: tool?.title ?? "Grow a Garden Crop Value Calculator",
        description:
          tool?.meta_description ??
          "Pick a crop, enter weight and quantity, apply variants and mutations, and see the Sheckles you earn with a clear breakdown.",
        url: CANONICAL,
        datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
        dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL.replace(/\/$/, "")}/tools` },
            { "@type": "ListItem", position: 3, name: tool?.title ?? "Grow a Garden Crop Value Calculator" }
          ]
        },
        mainEntity: {
          "@type": "WebApplication",
          name: tool?.title ?? "Grow a Garden Crop Value Calculator",
          description:
            tool?.meta_description ??
            "Pick a crop, enter weight and quantity, apply variants and mutations, and see the Sheckles you earn with a clear breakdown.",
          applicationCategory: "Calculator",
          operatingSystem: "Web",
          url: CANONICAL
        }
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <PageBreadcrumb
        className="mb-6 text-xs uppercase tracking-[0.25em] text-muted"
        items={[
          { label: "Home", href: "/" },
          { label: "Tools", href: "/tools" },
          { label: tool?.title ?? "Grow a Garden Crop Value Calculator", href: null }
        ]}
      />

      <div className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            {tool?.title ?? "Grow a Garden Crop Value Calculator"}
          </h1>
          <UpdatedTimestamp value={modifiedTime} />
        </header>

        <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space mt-8 space-y-6">
          {introNodes ? introNodes : null}
          <ContentSlot
            slot={TOOL_AD_SLOT}
            className="w-full"
            adLayout={null}
            adFormat="auto"
            fullWidthResponsive
          />
          <GrowGardenCropValueCalculatorClient
            crops={cropDataset.crops}
            variants={GAG_VARIANTS}
            mutations={GAG_MUTATIONS}
          />
          {howNodes ? howNodes : null}
          <ContentSlot
            slot={TOOL_AD_SLOT}
            className="my-8 w-full"
            adLayout={null}
            adFormat="auto"
            fullWidthResponsive
          />
          {(descriptionNodes.length || faqNodes.length) ? (
            <>
            {descriptionNodes.length ? descriptionNodes.flatMap((item) => item.nodes) : null}

            {faqNodes.length ? (
              <>
                <ContentSlot
                  slot={TOOL_AD_SLOT}
                  className="w-full"
                  adLayout={null}
                  adFormat="auto"
                  fullWidthResponsive
                />
                <ContentFaq
                  items={faqNodes.map((faq, idx) => ({
                    id: `${faq.q}-${idx}`,
                    question: faq.q,
                    answer: faq.nodes
                  }))}
                />
              </>
            ) : null}
            </>
          ) : null}
        </section>

        {tool?.id ? (
          <div className="mt-10">
            <CommentsSection entityType="tool" entityId={tool.id} />
          </div>
        ) : null}

        <ContentSlot
          slot={TOOL_AD_SLOT}
          className="mt-8 w-full"
          adLayout={null}
          adFormat="auto"
          fullWidthResponsive
        />
      </div>
    </>
  );
}
