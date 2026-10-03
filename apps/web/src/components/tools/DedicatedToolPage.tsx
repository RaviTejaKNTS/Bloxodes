import type { Metadata } from "next";
import type { ComponentProps, ReactNode } from "react";

import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { ContentSlot } from "@/components/ContentSlot";
import { MoreTools } from "@/components/more-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { resolveModifiedAt, resolvePublishedAt } from "@/lib/content-dates";
import { buildPageContentHtml, renderPageContentNodes } from "@/lib/page-content";
import { buildAlternates, resolveSeoTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getToolContentWithDevFallback, type ToolContent } from "@/lib/tools";
import "@/styles/article-content.css";

const TOOL_AD_SLOT = "3529946151";
const FALLBACK_IMAGE = `${SITE_URL}/Bloxodes.png`;

type DedicatedToolConfig = {
  toolCode: string;
  fallbackTitle: string;
  fallbackDescription: string;
  applicationCategory?: string;
  content?: ToolContent | null;
  canonicalPath?: string;
  breadcrumbItems?: Array<{ label: string; href?: string | null }>;
  relatedContent?: ReactNode;
  commentEntityType?: ComponentProps<typeof CommentsSection>["entityType"];
};

export async function buildDedicatedToolMetadata({
  toolCode,
  fallbackTitle,
  fallbackDescription,
  content,
  canonicalPath
}: DedicatedToolConfig): Promise<Metadata> {
  const tool = content !== undefined ? content : await getToolContentWithDevFallback(toolCode);
  const canonical = `${SITE_URL.replace(/\/$/, "")}${canonicalPath ?? `/tools/${toolCode}`}`;
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
  content,
  canonicalPath,
  breadcrumbItems,
  relatedContent,
  commentEntityType = "tool",
  children
}: DedicatedToolConfig & { children: ReactNode }) {
  const tool = content !== undefined ? content : await getToolContentWithDevFallback(toolCode);
  const canonical = `${SITE_URL.replace(/\/$/, "")}${canonicalPath ?? `/tools/${toolCode}`}`;
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
          itemListElement: (breadcrumbItems ?? [{ label: "Home", href: "/" }, { label: "Tools", href: "/tools" }, { label: title }]).map((entry, index) => ({ "@type": "ListItem", position: index + 1, name: entry.label, ...(entry.href ? { item: `${SITE_URL.replace(/\/$/, "")}${entry.href}` } : {}) }))
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <PageBreadcrumb
        className="mb-6 text-xs uppercase tracking-[0.25em] text-muted"
        items={breadcrumbItems ?? [
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
          <CommentsSection entityType={commentEntityType} entityId={tool.id} />
        </div>
      ) : null}

      <ContentSlot slot={TOOL_AD_SLOT} className="mt-8 w-full" adLayout={null} adFormat="auto" fullWidthResponsive />
      {relatedContent === undefined ? <MoreTools excludeCode={toolCode} /> : relatedContent}
    </>
  );
}
