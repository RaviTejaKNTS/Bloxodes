import { checklistDescriptionText } from "@/lib/checklist-description";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "@/styles/article-content.css";
import "@/styles/ads-checklists.css";
import { ChecklistBoard } from "@/components/ChecklistBoard";
import { ChecklistProgressHeader } from "@/components/ChecklistProgressHeader";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { PageSidebar } from "@/components/PageSidebar";
import { SocialShare } from "@/components/SocialShare";
import type { ChecklistConfig, ChecklistTemplateData } from "@/lib/engagement/types";
import { engagementProgressKey } from "@/lib/engagement/types";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { processHtmlLinks } from "@/lib/link-utils";
import { renderHtmlAsReactNodes } from "@/lib/html-to-react";
import { safeJsonLd, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { resolveModifiedAt, resolvePublishedAt } from "@/lib/content-dates";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";

export function checklistMetadata(data: ChecklistTemplateData | null, config: ChecklistConfig): Metadata {
  if (!data) return {};
  const basePath = config.basePath;
  const { page } = data;
  const titleBase = resolveSeoTitle(page.seo_title) ?? page.title;
  const description =
    page.seo_description ||
    (page.description_md ? markdownToPlainText(page.description_md).slice(0, 160) : config.description);
  const canonical = `${SITE_URL}${basePath}/${page.slug}`;
  const publishedAt = resolvePublishedAt(page);
  const updatedAt = resolveModifiedAt(page);
  const publishedTime = publishedAt ? new Date(publishedAt).toISOString() : undefined;
  const updatedTime = updatedAt ? new Date(updatedAt).toISOString() : undefined;

  return {
    title: `${titleBase} | ${SITE_NAME}`,
    description,
    alternates: buildAlternates(canonical),
    openGraph: {
      type: "article",
      url: canonical,
      title: titleBase,
      description,
      siteName: SITE_NAME,
      publishedTime,
      modifiedTime: updatedTime
    },
    twitter: {
      card: "summary",
      title: titleBase,
      description
    }
  };
}

export async function ChecklistPageTemplate({
  data,
  config,
  sidebar
}: {
  data: ChecklistTemplateData;
  config: ChecklistConfig;
  /** Related content under the share links in the right sidebar. Defaults to a link back to the index. */
  sidebar?: ReactNode;
}) {
  const basePath = config.basePath;
  const progressKey = engagementProgressKey(config.progressNamespace, data.page.slug);
  const { page, items } = data;
  const canonicalUrl = `${SITE_URL}${basePath}/${page.slug}`;
  const descriptionPlain =
    page.seo_description ||
    (page.description_md ? markdownToPlainText(page.description_md).slice(0, 160) : config.description);
  const coverImage = page.image || `${SITE_URL}/Bloxodes.png`;
  const descriptionHtml = page.description_md ? await renderMarkdown(page.description_md) : null;
  const descriptionNodes = descriptionHtml
    ? renderHtmlAsReactNodes(processHtmlLinks(descriptionHtml).__html, { keyPrefix: "checklist-intro" })
    : null;
  const leafItems = items.filter((item) => item.section_code.split(".").filter(Boolean).length === 3);
  const publishedDate = new Date(resolvePublishedAt(page) ?? page.created_at);
  const updatedDateSource = resolveModifiedAt(page) ?? page.updated_at ?? page.created_at;
  const updatedDate = new Date(updatedDateSource);
  const itemListElements = leafItems.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Thing",
      name: item.title,
      ...(item.description ? { description: checklistDescriptionText(item.description) } : {}),
      identifier: item.section_code
    }
  }));
  const webApplicationSchema = {
    "@type": "WebApplication",
    name: `${page.title} Checklist`,
    url: canonicalUrl,
    description: descriptionPlain,
    operatingSystem: "Web",
    applicationCategory: "UtilityApplication",
    image: coverImage
  };
  const itemListSchema = {
    "@type": "ItemList",
    name: `${page.title} Checklist Items`,
    description: descriptionPlain,
    url: canonicalUrl,
    datePublished: publishedDate.toISOString(),
    dateModified: updatedDate.toISOString(),
    numberOfItems: leafItems.length,
    itemListOrder: "Ascending",
    itemListElement: itemListElements
  };
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    url: canonicalUrl,
    description: descriptionPlain,
    datePublished: publishedDate.toISOString(),
    dateModified: updatedDate.toISOString(),
    image: coverImage,
    mainEntity: webApplicationSchema,
    hasPart: [itemListSchema]
  };
  return (
    <div className="grid gap-8 content-sidebar-grid content-sidebar-grid--prose">
      <article className="min-w-0">
        <PageBreadcrumb
          className="mb-4 text-xs uppercase tracking-[0.25em] text-muted"
          items={[
            { label: "Home", href: "/" },
            { label: config.title, href: config.basePath },
            { label: page.title }
          ]}
        />
        <header className="mb-8 space-y-4">
          <h1 className="text-4xl font-bold text-foreground md:text-5xl">{page.title}</h1>
          <UpdatedTimestamp
            value={updatedDateSource}
            className="inline-flex items-center gap-1.5 text-sm text-foreground/80"
          />
          <ChecklistProgressHeader title={page.title} slug={progressKey} totalItems={leafItems.length} />
        </header>
        <section id="article-body" itemProp="articleBody" className="md-copy-scope checklists-stream">
          {descriptionNodes}
          <ChecklistBoard slug={progressKey} items={items} />
        </section>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(webPageSchema) }} />
      </article>
      <PageSidebar>
        <SocialShare
          url={canonicalUrl}
          title={page.title}
          heading="Share this checklist"
          analytics={{ contentType: "checklist", itemId: progressKey }}
        />
        {sidebar ?? (
          <Link
            href={config.basePath}
            className="block rounded-lg border border-border/70 bg-card p-4 text-sm font-semibold text-foreground transition-colors hover:border-border"
          >
            All {config.title.toLowerCase()}
          </Link>
        )}
      </PageSidebar>
    </div>
  );
}
