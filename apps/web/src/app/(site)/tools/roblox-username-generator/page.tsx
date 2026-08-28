import type { Metadata } from "next";
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
import { RobloxUsernameGeneratorClient } from "./RobloxUsernameGeneratorClient";

export const revalidate = 3600;

const TOOL_CODE = "roblox-username-generator";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/tools/${TOOL_CODE}`;
const FALLBACK_IMAGE = `${SITE_URL}/Bloxodes.png`;
const TOOL_AD_SLOT = "3529946151";

export async function generateMetadata(): Promise<Metadata> {
  const tool = await getToolContentWithDevFallback(TOOL_CODE);
  const title = resolveSeoTitle(tool?.seo_title) ?? tool?.title ?? "Roblox Username Generator";
  const description =
    tool?.meta_description ??
    "Generate Roblox username ideas by vibe, keyword, and length, then check which names are available before you choose one.";
  const image = tool?.thumb_url || FALLBACK_IMAGE;

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

export default async function RobloxUsernameGeneratorPage() {
  const tool = await getToolContentWithDevFallback(TOOL_CODE);
  const contentHtml = await buildPageContentHtml(tool);
  const introNodes = contentHtml?.introHtml ? renderPageContentNodes(contentHtml.introHtml, "tool-intro") : null;
  const descriptionNodes = (contentHtml?.descriptionHtml ?? []).map((entry) => ({
    key: entry.key,
    nodes: renderPageContentNodes(entry.html, `tool-description-${entry.key}`)
  }));
  const howNodes = contentHtml?.howHtml ? renderPageContentNodes(contentHtml.howHtml, "tool-how") : null;
  const faqNodes = (contentHtml?.faqHtml ?? []).map((faq, index) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `tool-faq-${index}`)
  }));
  const publishedTime = tool ? resolvePublishedAt(tool) : null;
  const modifiedTime = tool ? resolveModifiedAt(tool) : null;
  const title = tool?.title ?? "Roblox Username Generator";
  const description =
    tool?.meta_description ??
    "Generate Roblox username ideas by vibe, keyword, and length, then check which names are available before you choose one.";

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
        url: CANONICAL,
        datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
        dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL.replace(/\/$/, "")}/tools` },
            { "@type": "ListItem", position: 3, name: title, item: CANONICAL }
          ]
        },
        mainEntity: {
          "@type": "WebApplication",
          name: title,
          description,
          applicationCategory: "UtilityApplication",
          operatingSystem: "Web",
          browserRequirements: "Requires JavaScript for live username generation and availability checks",
          isAccessibleForFree: true,
          url: CANONICAL,
          featureList: [
            "Roblox username ideas by vibe, keyword, and length",
            "Point-in-time Roblox username availability checks",
            "Pinned shortlist, copy, remix, and recheck controls"
          ]
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
        <div className="not-prose mt-8">
          <RobloxUsernameGeneratorClient />
        </div>
        {howNodes}
        <ContentSlot
          slot={TOOL_AD_SLOT}
          className="my-8 w-full"
          adLayout={null}
          adFormat="auto"
          fullWidthResponsive
        />
        {descriptionNodes.length ? descriptionNodes.flatMap((entry) => entry.nodes) : null}
        {faqNodes.length ? (
          <ContentFaq
            items={faqNodes.map((faq, index) => ({
              id: `${faq.q}-${index}`,
              question: faq.q,
              answer: faq.nodes
            }))}
          />
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
      <MoreTools excludeCode={TOOL_CODE} />
    </>
  );
}
