import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/styles/article-content.css";
import { markdownToPlainText } from "@/lib/markdown";
import { CHECKLISTS_DESCRIPTION, EVENTS_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import {
  getEventsPageByUniverseId,
  listGamesWithActiveCountsByUniverseId,
  listPublishedArticlesByUniverseId,
  listPublishedChecklistsByUniverseId
} from "@/lib/db";
import {
  getToolContentWithDevFallback,
  listPublishedTools,
  listPublishedToolsByUniverseId,
  type ToolListEntry
} from "@/lib/tools";
import { getUniverseEventSummary } from "@/lib/events-summary";
import { ContentSlot } from "@/components/ContentSlot";
import { supabaseAdmin } from "@/lib/supabase";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { GameCard } from "@/components/GameCard";
import { ChecklistCard } from "@/components/ChecklistCard";
import { ArticleCard } from "@/components/ArticleCard";
import { ToolCard } from "@/components/ToolCard";
import { EventsPageCard, type EventsPageCardProps } from "@/components/EventsPageCard";
import { SocialShare } from "@/components/SocialShare";
import { formatUpdatedLabel } from "@/lib/updated-label";
import { resolveModifiedAt, resolvePublishedAt } from "@/lib/content-dates";
import { splitPathToSlug } from "@/lib/static-params";
import { buildPageContentHtml, renderPageContentNodes } from "@/lib/page-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";

export const revalidate = 3600;

const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;
const TOOL_AD_SLOT = "3529946151";
const RESERVED_TOOL_CODES = new Set([
  "grow-a-garden-crop-value-calculator",
  "roblox-devex-calculator",
  "roblox-id-extractor",
  "robux-to-usd-calculator",
  "the-forge-crafting-calculator",
  "the-forge-inventory-optimizer",
  "wizard-alchemy-potion-planner",
  "wizard-alchemy-race-reroll-calculator"
]);

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

export async function generateStaticParams() {
  const tools = await listPublishedTools();
  return tools
    .map((tool) => tool.code?.trim().toLowerCase())
    .filter((code): code is string => Boolean(code) && !RESERVED_TOOL_CODES.has(code))
    .map((code) => ({ slug: splitPathToSlug(code) }));
}

function normalizeToolCode(slugParts: string[]): string {
  return slugParts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/")
    .toLowerCase();
}

function summarize(text: string | null | undefined, fallback: string) {
  const plain = markdownToPlainText(text ?? "");
  const normalized = plain.replace(/\s+/g, " ").trim();
  return normalized || fallback;
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
  const universeId = tool.universe_id ?? null;
  const relatedCodes = universeId ? await listGamesWithActiveCountsByUniverseId(universeId, 1) : [];
  const relatedChecklists = universeId ? await listPublishedChecklistsByUniverseId(universeId, 1) : [];
  const relatedArticles = universeId ? await listPublishedArticlesByUniverseId(universeId, 3, 0) : [];
  const relatedToolsRaw: ToolListEntry[] = universeId ? await listPublishedToolsByUniverseId(universeId, 3) : [];
  const relatedTools = relatedToolsRaw.filter((entry) => entry.code !== tool.code);
  const relatedEventsPage = universeId ? await getEventsPageByUniverseId(universeId) : null;
  const eventSummary = universeId ? await getUniverseEventSummary(universeId) : null;
  const universeLabel =
    relatedChecklists[0]?.universe?.display_name ??
    relatedChecklists[0]?.universe?.name ??
    relatedCodes[0]?.name ??
    "this game";
  const relatedChecklistCards = relatedChecklists.map((row) => {
    const summary = summarize(row.seo_description ?? row.description_md ?? null, CHECKLISTS_DESCRIPTION);
    const itemsCount =
      typeof row.leaf_item_count === "number"
        ? row.leaf_item_count
        : typeof row.item_count === "number"
          ? row.item_count
          : null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary,
      universeName: row.universe?.display_name ?? row.universe?.name ?? null,
      coverImage: row.universe?.icon_url ?? `${SITE_URL}/og-image.png`,
      updatedAt: row.updated_at || row.published_at || row.created_at || null,
      itemsCount
    };
  });
  const eventsSummary = relatedEventsPage?.meta_description?.trim() || EVENTS_DESCRIPTION;
  const eventsUpdatedLabel = relatedEventsPage
    ? formatUpdatedLabel(relatedEventsPage.updated_at || relatedEventsPage.published_at || relatedEventsPage.created_at)
    : null;
  const eventsCard: EventsPageCardProps | null =
    relatedEventsPage && relatedEventsPage.slug
      ? {
          slug: relatedEventsPage.slug,
          title: relatedEventsPage.title,
          summary: eventsSummary,
          universeName:
            relatedEventsPage.universe?.display_name ??
            relatedEventsPage.universe?.name ??
            universeLabel,
          coverImage: null,
          fallbackIcon: relatedEventsPage.universe?.icon_url ?? null,
          eventName: eventSummary?.featured?.name ?? null,
          eventTimeLabel: eventSummary?.featured?.timeLabel ?? null,
          eventStartUtc: eventSummary?.featured?.startUtc ?? null,
          eventEndUtc: eventSummary?.featured?.endUtc ?? null,
          status: (eventSummary?.featured?.status ?? "none") as EventsPageCardProps["status"],
          counts: eventSummary?.counts ?? { upcoming: 0, current: 0, past: 0 },
          updatedLabel: eventsUpdatedLabel
        }
      : null;
  const hasSidebar =
    Boolean(universeId) &&
    (relatedCodes.length > 0 ||
      relatedChecklistCards.length > 0 ||
      relatedArticles.length > 0 ||
      relatedTools.length > 0 ||
      Boolean(eventsCard));
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

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space mt-8 space-y-6">
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
            <ContentFaq
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

  if (!hasSidebar) {
    return mainContent;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
      {mainContent}
      <aside className="space-y-4">
        <SocialShare
          url={canonical}
          title={tool.title ?? "Tool"}
          heading="Share this tool"
          analytics={{ contentType: "tool", itemId: tool.code }}
        />

        {eventsCard ? (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Events for {universeLabel}</h3>
            <div className="space-y-3">
              <div
                className="block"
                data-analytics-event="related_content_click"
                data-analytics-source-type="tool_sidebar"
                data-analytics-target-type="event"
                data-analytics-target-slug={eventsCard.slug}
              >
                <EventsPageCard {...eventsCard} />
              </div>
            </div>
          </section>
        ) : null}

        {relatedCodes.length ? (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Codes for {universeLabel}</h3>
            <div className="grid gap-3">
              {relatedCodes.map((game) => (
                <div
                  key={game.id}
                  className="block"
                  data-analytics-event="related_content_click"
                  data-analytics-source-type="tool_sidebar"
                  data-analytics-target-type="codes"
                  data-analytics-target-slug={game.slug}
                >
                  <GameCard game={game} titleAs="p" />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {relatedChecklistCards.length ? (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">{universeLabel} checklist</h3>
            <div className="space-y-3">
              {relatedChecklistCards.map((card) => (
                <div
                  key={card.id}
                  className="block"
                  data-analytics-event="related_content_click"
                  data-analytics-source-type="tool_sidebar"
                  data-analytics-target-type="checklist"
                  data-analytics-target-slug={card.slug}
                >
                  <ChecklistCard {...card} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {relatedArticles.length ? (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Articles on {universeLabel}</h3>
            <div className="space-y-4">
              {relatedArticles.map((article) => (
                <div
                  key={article.id}
                  className="block"
                  data-analytics-event="related_content_click"
                  data-analytics-source-type="tool_sidebar"
                  data-analytics-target-type="article"
                  data-analytics-target-slug={article.slug}
                >
                  <ArticleCard article={article} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {relatedTools.length ? (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">More tools for {universeLabel}</h3>
            <div className="space-y-4">
              {relatedTools.map((relatedTool) => (
                <div
                  key={relatedTool.id ?? relatedTool.code}
                  className="block"
                  data-analytics-event="related_content_click"
                  data-analytics-source-type="tool_sidebar"
                  data-analytics-target-type="tool"
                  data-analytics-target-slug={relatedTool.code}
                >
                  <ToolCard tool={relatedTool} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
