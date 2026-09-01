import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { ContentSlot } from "@/components/ContentSlot";
import { MoreTools } from "@/components/more-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { resolveModifiedAt, resolvePublishedAt } from "@/lib/content-dates";
import { buildPageContentHtml, renderPageContentNodes } from "@/lib/page-content";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getToolContentWithDevFallback } from "@/lib/tools";
import "@/styles/article-content.css";

const TOOL_AD_SLOT = "3529946151";
const FALLBACK_IMAGE = `${SITE_URL}/Bloxodes.png`;

type DedicatedToolConfig = {
  toolCode: string;
  fallbackTitle: string;
  fallbackDescription: string;
  applicationCategory?: string;
};

export async function buildDedicatedToolMetadata({
  toolCode,
  fallbackTitle,
  fallbackDescription
}: DedicatedToolConfig): Promise<Metadata> {
  const tool = await getToolContentWithDevFallback(toolCode);
  const canonical = `${SITE_URL.replace(/\/$/, "")}/tools/${toolCode}`;
  const title = resolveSeoTitle(tool?.seo_title) ?? tool?.title ?? fallbackTitle;
  const description = tool?.meta_description ?? fallbackDescription;
  const image = tool?.thumb_url || FALLBACK_IMAGE;
  const publishedTime = tool ? resolvePublishedAt(tool) : null;
  const modifiedTime = tool ? resolveModifiedAt(tool) : null;

  return {
    title,
    description,
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "article",
      url: canonical,
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

export async function DedicatedToolPage({
  toolCode,
  fallbackTitle,
  fallbackDescription,
  applicationCategory = "Calculator",
  children
}: DedicatedToolConfig & { children: ReactNode }) {
  const tool = await getToolContentWithDevFallback(toolCode);
  const canonical = `${SITE_URL.replace(/\/$/, "")}/tools/${toolCode}`;
  const title = tool?.title ?? fallbackTitle;
  const description = tool?.meta_description ?? fallbackDescription;
  const contentHtml = await buildPageContentHtml(tool);
  const introNodes = contentHtml?.introHtml
    ? renderPageContentNodes(contentHtml.introHtml, `${toolCode}-intro`)
    : null;
  const descriptionNodes = (contentHtml?.descriptionHtml ?? []).map((entry) => ({
    key: entry.key,
    nodes: renderPageContentNodes(entry.html, `${toolCode}-description-${entry.key}`)
  }));
  const howNodes = contentHtml?.howHtml
    ? renderPageContentNodes(contentHtml.howHtml, `${toolCode}-how`)
    : null;
  const faqNodes = (contentHtml?.faqHtml ?? []).map((faq, index) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `${toolCode}-faq-${index}`)
  }));
  const publishedTime = tool ? resolvePublishedAt(tool) : null;
  const modifiedTime = tool ? resolveModifiedAt(tool) : null;
  const faqSchema = (tool?.faq_json ?? []).map((entry) => ({
    "@type": "Question",
    name: entry.q,
    acceptedAnswer: { "@type": "Answer", text: entry.a }
  }));
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: title,
        description,
        url: canonical,
        datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
        dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL.replace(/\/$/, "")}/tools` },
            { "@type": "ListItem", position: 3, name: title }
          ]
        },
        mainEntity: {
          "@type": "WebApplication",
          name: title,
          description,
          applicationCategory,
          operatingSystem: "Web",
          url: canonical
        }
      },
      ...(faqSchema.length ? [{ "@type": "FAQPage", mainEntity: faqSchema }] : [])
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
          { label: title, href: null }
        ]}
      />

      <header className="space-y-3">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={modifiedTime} />
      </header>

      <section
        id="article-body"
        itemProp="articleBody"
        className="article-content md-copy-scope copy-with-sidebar-space mt-8 space-y-6 journey-content-stream journey-content-stream--interactive"
      >
        {introNodes}
        <ContentSlot slot={TOOL_AD_SLOT} className="my-8 w-full" adLayout={null} adFormat="auto" fullWidthResponsive />
        {children}
        {howNodes}
        <ContentSlot slot={TOOL_AD_SLOT} className="my-8 w-full" adLayout={null} adFormat="auto" fullWidthResponsive />
        {descriptionNodes.length ? descriptionNodes.flatMap((entry) => entry.nodes) : null}
        {faqNodes.length ? (
          <>
            <ContentSlot slot={TOOL_AD_SLOT} className="w-full" adLayout={null} adFormat="auto" fullWidthResponsive />
            <ContentFaq
              items={faqNodes.map((faq, index) => ({
                id: `${faq.q}-${index}`,
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

      <ContentSlot slot={TOOL_AD_SLOT} className="mt-8 w-full" adLayout={null} adFormat="auto" fullWidthResponsive />
      <MoreTools excludeCode={toolCode} />
    </>
  );
}
