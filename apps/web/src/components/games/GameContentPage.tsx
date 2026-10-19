import { CommentsSection } from "@/components/comments/CommentsSection";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { ContentFaq } from "@/components/ContentFaq";
import { renderPageContentNodes } from "@/lib/page-content";
import { breadcrumbJsonLd, safeJsonLd, buildAlternates, SITE_URL } from "@/lib/seo";
import { renderMarkdown, markdownToPlainText } from "@/lib/markdown";
import { type GameExtendedPage } from "@/lib/game-page-data";
import "@/styles/article-content.css";
import "@/styles/ads-content.css";
import { load } from "cheerio";
import { PageSidebar } from "@/components/PageSidebar";
import { SocialShare } from "@/components/SocialShare";
import { GameRelatedLinks } from "./GameRelatedLinks";
import { resolveGameCoverImage } from "@/lib/game-images";

// Keep raw HTML copy's existing styles when splitting shared reference pages.
function ContentHtmlBlocks({ html, group }: { html: string; group: string }) {
  const $ = load(html, null, false);
  return $.root().contents().toArray().filter(node => node.type !== "text" || node.data.trim()).map((node, index) => (
    <div key={`${group}-${index}`} className={`ads-content-plain-copy ads-content-game-${group} article-content`} dangerouslySetInnerHTML={{ __html: $.html(node) }} />
  ));
}

export function gameContentMetadata(page: GameExtendedPage): Metadata {
  const url = SITE_URL + page.canonical_path;
  const description = page.meta_description || markdownToPlainText(page.intro_md ?? "").slice(0,160);
  const image = resolveGameCoverImage(page);
  return { twitter: { card: "summary_large_image", images: image ? [image] : [] }, title: page.seo_title || page.title, description, alternates:buildAlternates(url), openGraph:{title:page.title,description,url,type:"website",images:image ? [image] : []} };
}
// A game can supply its own body without changing the title, copy or metadata layout.
export async function GameContentPage({ page, children }: { page: GameExtendedPage; children: ReactNode }) {
  const [intro, description] = await Promise.all([renderMarkdown(page.intro_md ?? ""),renderMarkdown(page.description_md ?? "")]);
  const image = resolveGameCoverImage(page);
  const validFaqs = (page.faq_json ?? []).filter(faq => faq?.q?.trim() && faq?.a?.trim());
  const faqs = await Promise.all(validFaqs.map(async (faq, index) => ({ id: `${page.id}-faq-${index}`, question: faq.q, answer: renderPageContentNodes(await renderMarkdown(faq.a), `${page.id}-answer-${index}`) })));
  const breadcrumbs = [{ label: "Home", href: "/" }, { label: page.namespace.split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" "), href: `/${page.namespace}` }, { label: page.title }];
  const graph = [
    { "@type": "WebPage", name: page.title, url: SITE_URL + page.canonical_path, description: page.meta_description, dateModified: page.updated_at, image: image || undefined },
    breadcrumbJsonLd(breadcrumbs.map(item => ({ name: item.label, url: SITE_URL + (item.href || page.canonical_path) }))),
    ...(validFaqs.length ? [{ "@type": "FAQPage", mainEntity: validFaqs.map(faq => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) }] : [])
  ];
  return <div className="grid gap-8 content-sidebar-grid content-sidebar-grid--prose">
    <div className="min-w-0 space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({ "@context": "https://schema.org", "@graph": graph }) }} />
      <PageBreadcrumb items={breadcrumbs} />
      <header className="space-y-4"><h1 className="text-4xl font-semibold">{page.title}</h1></header>
      <article id="article-body" className="journey-content-stream space-y-8">
        <ContentHtmlBlocks html={intro} group="intro" />
        {children}
        <ContentHtmlBlocks html={description} group="description" />
        <ContentFaq items={faqs} />
      </article>
      <CommentsSection entityType={page.canonical_path.includes("/maps/") ? "game_map" : "game_catalog"} entityId={page.id} />
    </div>
    <PageSidebar>
      <SocialShare url={SITE_URL + page.canonical_path} title={page.title} heading="Share this page" />
      <GameRelatedLinks namespace={page.namespace} gameId={page.game_id} canonicalPath={page.canonical_path} />
    </PageSidebar>
  </div>;
}
