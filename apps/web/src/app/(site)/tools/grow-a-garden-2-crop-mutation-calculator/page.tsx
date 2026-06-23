import type { Metadata } from "next";

import "@/styles/article-content.css";

import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentSlot } from "@/components/ContentSlot";
import { ContentFaq } from "@/components/ContentFaq";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { resolveModifiedAt, resolvePublishedAt } from "@/lib/content-dates";
import { loadGrowGarden2ValueDataset } from "@/lib/grow-a-garden-2/value-calculator";
import { buildPageContentHtml, renderPageContentNodes } from "@/lib/page-content";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getToolContentWithDevFallback } from "@/lib/tools";
import { GrowGarden2CropMutationCalculatorClient } from "./GrowGarden2CropMutationCalculatorClient";

export const revalidate = 21600;

const TOOL_CODE = "grow-a-garden-2-crop-mutation-calculator";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/tools/${TOOL_CODE}`;
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;
const TOOL_AD_SLOT = "3529946151";

export async function generateMetadata(): Promise<Metadata> {
  const tool = await getToolContentWithDevFallback(TOOL_CODE);
  const title =
    resolveSeoTitle(tool?.seo_title) || tool?.title || "Grow a Garden 2 Crop and Mutation Value Calculator";
  const description =
    tool?.meta_description ||
    "Calculate Grow a Garden 2 crop mutation value from normal crop value, mutation, and quantity before selling for Sheckles.";
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

export default async function GrowGarden2CropMutationCalculatorPage() {
  const [tool, dataset] = await Promise.all([
    getToolContentWithDevFallback(TOOL_CODE),
    loadGrowGarden2ValueDataset()
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
        name: tool?.title ?? "Grow a Garden 2 Crop and Mutation Value Calculator",
        description:
          tool?.meta_description ??
          "Calculate Grow a Garden 2 crop mutation value from normal crop value, mutation, and quantity before selling for Sheckles.",
        url: CANONICAL,
        datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
        dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL.replace(/\/$/, "")}/tools` },
            { "@type": "ListItem", position: 3, name: tool?.title ?? "Grow a Garden 2 Crop and Mutation Value Calculator" }
          ]
        },
        mainEntity: {
          "@type": "WebApplication",
          name: tool?.title ?? "Grow a Garden 2 Crop and Mutation Value Calculator",
          description:
            tool?.meta_description ??
            "Grow a Garden 2 calculator for crop mutation value, per-crop value, and total Sheckles.",
          applicationCategory: "Calculator",
          operatingSystem: "Web",
          url: CANONICAL
        }
      }
    ]
  };

  const fallbackIntro =
    "In Grow a Garden 2, one mutation can turn an ordinary harvest into a much bigger Sheckles payout. Enter the crop's normal value, choose a mutation, and see the per-crop and total Sheckles result.";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <PageBreadcrumb
        className="mb-6 text-xs uppercase tracking-[0.25em] text-muted"
        items={[
          { label: "Home", href: "/" },
          { label: "Tools", href: "/tools" },
          { label: tool?.title ?? "Grow a Garden 2 Crop and Mutation Value Calculator", href: null }
        ]}
      />

      <div className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            {tool?.title ?? "Grow a Garden 2 Crop and Mutation Value Calculator"}
          </h1>
          <UpdatedTimestamp value={modifiedTime} />
        </header>

        <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space mt-8 space-y-6">
          {introNodes ? introNodes : <p data-md-copy className="md-copy-node md-copy-p">{fallbackIntro}</p>}
          <ContentSlot
            slot={TOOL_AD_SLOT}
            className="w-full"
            adLayout={null}
            adFormat="auto"
            fullWidthResponsive
          />
          <GrowGarden2CropMutationCalculatorClient crops={dataset.crops} mutations={dataset.mutations} />
          {howNodes ? howNodes : null}
          <ContentSlot
            slot={TOOL_AD_SLOT}
            className="my-8 w-full"
            adLayout={null}
            adFormat="auto"
            fullWidthResponsive
          />
          {descriptionNodes.length ? descriptionNodes.flatMap((entry) => entry.nodes) : null}
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
