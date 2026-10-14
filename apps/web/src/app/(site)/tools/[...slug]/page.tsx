import { GameDiscoverySidebar } from "@/components/game-sidebar/GameDiscoverySidebar";
import { ToolPageLayout } from "@/components/tools/ToolPageLayout";
import type { Metadata } from "next";
import { MoreTools } from "@/components/more-content";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { getToolContentWithDevFallback } from "@/lib/tools";
import { ContentSlot } from "@/components/ContentSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { resolveModifiedAt, resolvePublishedAt } from "@/lib/content-dates";
import { buildPageContentHtml, renderPageContentNodes } from "@/lib/page-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ToolFaq } from "@/components/tools/ToolFaq";

export const revalidate = 21600;

const FALLBACK_IMAGE = `${SITE_URL}/Bloxodes.png`;
const TOOL_AD_SLOT = "3529946151";
type PageProps = {
  params: Promise<{ slug: string[] }>;
};

export async function generateStaticParams() {
  return [];
}

function normalizeToolCode(slugParts: string[]): string {
  return slugParts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/")
    .toLowerCase();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const code = normalizeToolCode(slug ?? []);
  const canonical = `${SITE_URL.replace(/\/$/, "")}/tools/${code}`;
  if (!code) {
    return {
      alternates: buildAlternates(`${SITE_URL.replace(/\/$/, "")}/tools`)
    };
  }

  const tool = await getToolContentWithDevFallback(code);
  if (!tool) {
    return {
      alternates: buildAlternates(canonical)
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

export default async function ToolFallbackPage({ params }: PageProps) {
  const { slug } = await params;
  const code = normalizeToolCode(slug ?? []);
  if (!code) {
    notFound();
  }

  const tool = await getToolContentWithDevFallback(code);
  if (!tool) {
    notFound();
  }
  const contentHtml = await buildPageContentHtml(tool);
  if (!contentHtml) {
    notFound();
  }

  const canonical = `${SITE_URL.replace(/\/$/, "")}/tools/${code}`;
  const publishedTime = resolvePublishedAt(tool);
  const modifiedTime = resolveModifiedAt(tool);
  const introNodes = contentHtml.introHtml ? renderPageContentNodes(contentHtml.introHtml, "tool-intro") : null;
  const descriptionNodes = contentHtml.descriptionHtml.map((entry) => ({
    key: entry.key,
    nodes: renderPageContentNodes(entry.html, `tool-description-${entry.key}`)
  }));
  const howNodes = contentHtml.howHtml ? renderPageContentNodes(contentHtml.howHtml, "tool-how") : null;
  const faqNodes = contentHtml.faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `tool-faq-${idx}`)
  }));

  const faqSchema =
    (tool.faq_json?.length ?? 0) > 0
      ? tool.faq_json.map((entry) => ({
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
        name: tool.title ?? undefined,
        description: tool.meta_description ?? undefined,
        url: canonical,
        datePublished: publishedTime ? new Date(publishedTime).toISOString() : undefined,
        dateModified: modifiedTime ? new Date(modifiedTime).toISOString() : undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL.replace(/\/$/, "")}/tools` },
            { "@type": "ListItem", position: 3, name: tool.title ?? "Tool" }
          ]
        },
        mainEntity: {
          "@type": "WebApplication",
          name: tool.title ?? undefined,
          description: tool.meta_description ?? undefined,
          applicationCategory: "Utility",
          operatingSystem: "Web",
          url: canonical
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

  const mainContent = (
    <article className="min-w-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <PageBreadcrumb
        className="mb-6 text-xs uppercase tracking-[0.25em] text-muted"
        items={[
          { label: "Home", href: "/" },
          { label: "Tools", href: "/tools" },
          { label: tool.title ?? "Tool", href: null }
        ]}
      />
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{tool.title ?? "Tool"}</h1>
        <UpdatedTimestamp value={modifiedTime} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space mt-8 space-y-6 journey-content-stream journey-content-stream--interactive">
        {introNodes ? introNodes : null}
        <ContentSlot
          slot={TOOL_AD_SLOT}
          className="mt-8 w-full"
          adLayout={null}
          adFormat="auto"
          fullWidthResponsive
        />
        {howNodes ? howNodes : null}
        {(descriptionNodes.length || faqNodes.length) ? (
          <>
          {descriptionNodes.length ? descriptionNodes.flatMap((entry) => entry.nodes) : null}

          {faqNodes.length ? (
            <ToolFaq
              items={faqNodes.map((faq, idx) => ({
                id: `${faq.q}-${idx}`,
                question: faq.q,
                answer: faq.nodes
              }))}
            />
          ) : null}
          </>
        ) : null}
      </section>

      {tool.id ? (
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
    </article>
  );

  return (
    <ToolPageLayout sidebarContent={tool?.universe_id ? <GameDiscoverySidebar universeId={tool.universe_id} universeName={null} currentType="tool" /> : undefined} title={tool.title ?? "Tool"} toolCode={code} canonicalPath={`/tools/${code}`}>
      {mainContent}
      <MoreTools excludeCode={code} />
    </ToolPageLayout>
  );
}
