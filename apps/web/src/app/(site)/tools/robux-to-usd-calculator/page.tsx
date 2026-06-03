import type { Metadata } from "next";
import "@/styles/article-content.css";
import { SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { getToolContentWithDevFallback } from "@/lib/tools";
import { ContentSlot } from "@/components/ContentSlot";
import { fetchRobuxBundles } from "./robux-bundles";
import { RobuxPurchaseClient } from "./RobuxPurchaseClient";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { resolveModifiedAt, resolvePublishedAt } from "@/lib/content-dates";
import { buildPageContentHtml, renderPageContentNodes } from "@/lib/page-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import {
  DEFAULT_HAS_PREMIUM,
  DEFAULT_TARGET_ROBUX,
  DEFAULT_TARGET_USD,
  buildBudgetPlan,
  buildRobuxPlan,
  buildValueBundlePlan,
  selectBestRobuxPlan
} from "./robux-plans";

export const revalidate = 21600;

const TOOL_CODE = "robux-to-usd-calculator";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/tools/robux-to-usd-calculator`;
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;
const TOOL_AD_SLOT = "3529946151";

export async function generateMetadata(): Promise<Metadata> {
  const tool = await getToolContentWithDevFallback(TOOL_CODE);
  if (!tool) {
    return {
      alternates: buildAlternates(CANONICAL)
    };
  }

  const title = resolveSeoTitle(tool.seo_title) ?? tool.title ?? undefined;
  const description = tool.meta_description ?? undefined;
  const image = tool.thumb_url || FALLBACK_IMAGE;
  const publishedTime = resolvePublishedAt(tool);
  const modifiedTime = resolveModifiedAt(tool);

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

export default async function RobloxPurchasePage() {
  const tool = await getToolContentWithDevFallback(TOOL_CODE);
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
  const bundles = await fetchRobuxBundles();
  const initialRobuxPlanPc = buildRobuxPlan(DEFAULT_TARGET_ROBUX, "pc_web", DEFAULT_HAS_PREMIUM, bundles);
  const initialRobuxPlanMobile = buildRobuxPlan(DEFAULT_TARGET_ROBUX, "mobile", DEFAULT_HAS_PREMIUM, bundles);
  const initialRobuxPlan = selectBestRobuxPlan(initialRobuxPlanPc, initialRobuxPlanMobile);
  const initialValuePlan = buildValueBundlePlan(DEFAULT_TARGET_ROBUX, DEFAULT_HAS_PREMIUM, bundles);
  const initialBudgetPlan = buildBudgetPlan(DEFAULT_TARGET_USD, DEFAULT_HAS_PREMIUM, bundles);

  const faqSchema =
    (tool?.faq_json?.length ?? 0) > 0
      ? tool!.faq_json.map((entry) => ({
          "@type": "Question",
          name: entry.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: entry.a
          }
        }))
      : [];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: tool?.title ?? undefined,
        description: tool?.meta_description ?? undefined,
        url: CANONICAL,
        datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
        dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL.replace(/\/$/, "")}/tools` },
            { "@type": "ListItem", position: 3, name: tool?.title ?? "Tool" }
          ]
        },
        mainEntity: {
          "@type": "WebApplication",
          name: tool?.title ?? undefined,
          description: tool?.meta_description ?? undefined,
          applicationCategory: "Calculator",
          operatingSystem: "Web",
          url: CANONICAL
        }
      },
      ...(faqSchema.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faqSchema
            }
          ]
        : [])
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
          { label: tool?.title ?? "Tool", href: null }
        ]}
      />
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          {tool?.title ?? "Robux to USD Calculator"}
        </h1>
        <UpdatedTimestamp value={modifiedTime} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space mt-8 space-y-6">
        {introNodes ? introNodes : null}
        <ContentSlot
          slot={TOOL_AD_SLOT}
          className="mt-8 w-full"
          adLayout={null}
          adFormat="auto"
          fullWidthResponsive
        />
        <div className="mt-8">
          <RobuxPurchaseClient
            bundles={bundles}
            initialRobuxTarget={DEFAULT_TARGET_ROBUX}
            initialUsdTarget={DEFAULT_TARGET_USD}
            initialHasPremium={DEFAULT_HAS_PREMIUM}
            initialRobuxPlan={initialRobuxPlan}
            initialValuePlan={initialValuePlan}
            initialBudgetPlan={initialBudgetPlan}
          />
        </div>
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
    </>
  );
}
