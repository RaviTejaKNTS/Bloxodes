import { PageSidebar } from "@/components/PageSidebar";
import { getGameLandingForLinks } from "@/lib/game-landing";
import { gameBreadcrumbs } from "@/lib/game-root-page";
import { SocialShare } from "@/components/SocialShare";
import { GameRelatedLinks } from "./GameRelatedLinks";
import { Fragment } from "react";
import { ContentCopyNodes } from "./ContentCopyNodes";
import { safeJsonLd } from "@/lib/seo";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { supabaseAdmin } from "@/lib/supabase";
import type { GameCodePage as CodePage } from "@/lib/game-registry";
import { renderMarkdown } from "@/lib/markdown";
import { renderPageContentNodes } from "@/lib/page-content";
import { SITE_URL, webPageJsonLd } from "@/lib/seo";
import { CopyGameCode } from "./CopyGameCode";

export async function GameCodePage({ page, namespaceTitle }: { page: CodePage; namespaceTitle: string }) {
  const landing = await getGameLandingForLinks(page.namespace);
  const breadcrumbs = gameBreadcrumbs([{ label: "Home", href: "/" }, { label: namespaceTitle, href: landing.path }, { label: "Codes", href: `/${page.namespace}/codes` }, { label: page.title }], page.canonical_path);
  const { data: codes, error } = await supabaseAdmin().from("game_codes").select("code,rewards_text,status").eq("code_page_id", page.id).order("verified_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Game codes read failed: ${error.message}`);
  const sections = [["", page.intro_md], ["How to redeem", page.redeem_md], ["Rewards", page.rewards_md], ["Troubleshooting", page.troubleshoot_md], ["Where to find codes", page.find_codes_md]] as const;
  const copy = await Promise.all(sections.map(async ([heading, md], i) => ({ heading, nodes: md ? renderPageContentNodes(await renderMarkdown(md), `${page.id}-copy-${i}`) : [] })));
  const validFaqs = Array.isArray(page.faq_json) ? page.faq_json.filter(faq => faq && typeof faq.q === "string" && faq.q.trim() && typeof faq.a === "string" && faq.a.trim()) : [];
  const faqs = await Promise.all(validFaqs.map(async (faq, i) => ({ id: `${page.id}-faq-${i}`, question: faq.q, answer: renderPageContentNodes(await renderMarkdown(faq.a), `${page.id}-faq-answer-${i}`) })));
  function codeRows(status: "active" | "expired") {
    const rows = (codes ?? []).filter(code => code.status === status);
    const groups = Array.from({ length: Math.ceil(rows.length / 8) }, (_, index) => rows.slice(index * 8, index * 8 + 8));
    return <Fragment key={status}>
      <h2 className="text-2xl font-semibold">{status === "active" ? "Active codes" : "Expired codes"}</h2>
      {groups.length ? groups.map((group, index) => <ul key={index} className="ads-content-code-rows space-y-3" aria-label={status === "active" ? "Active codes" : "Expired codes"}>
        {group.map(code => <li key={code.code} className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4"><code className="font-semibold">{code.code}</code>{code.rewards_text ? <span>{code.rewards_text}</span> : null}{status === "active" ? <CopyGameCode code={code.code} /> : null}</li>)}
      </ul>) : <p className="ads-content-code-empty text-muted">{status === "active" ? "No verified active codes are listed." : "No expired codes are listed."}</p>}
    </Fragment>;
  }
  function copySection(index: number) {
    const section = copy[index];
    return section.nodes.length ? <Fragment key={section.heading}>
      <div className="ads-content-code-heading article-content md-copy-scope max-w-3xl"><h2>{section.heading}</h2></div>
      <ContentCopyNodes nodes={section.nodes} group={`game-codes-${section.heading}`} className="max-w-3xl" />
    </Fragment> : null;
  }
  return <div className="grid gap-8 content-sidebar-grid content-sidebar-grid--prose"><div className="min-w-0 space-y-8">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({ "@context": "https://schema.org", "@graph": [webPageJsonLd({ siteUrl: SITE_URL, slug: page.canonical_path.slice(1), title: page.title, description: page.meta_description ?? "", image: page.image, author: null, publishedAt: page.published_at, updatedAt: page.updated_at }), ...(validFaqs.length ? [{ "@type": "FAQPage", mainEntity: validFaqs.map(faq => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })) }] : [])] }) }} />
    <header className="space-y-4"><PageBreadcrumb items={breadcrumbs} /><h1 className="text-4xl font-semibold md:text-5xl">{page.title}</h1><UpdatedTimestamp value={page.updated_at} /></header>
    <article id="article-body" className="journey-content-stream journey-content-stream--prose space-y-8">
      <ContentCopyNodes nodes={copy[0].nodes} group="game-codes-intro" className="max-w-3xl" />
      {codeRows("active")}
      {copySection(1)}
      {codeRows("expired")}
      {copySection(3)}
      {copySection(2)}
      {copySection(4)}
      {faqs.length ? <ContentFaq items={faqs} /> : null}
    </article>
    <CommentsSection entityType="game_code" entityId={page.id} />
  </div><PageSidebar><SocialShare url={SITE_URL + page.canonical_path} title={page.title} heading="Share these codes" /><GameRelatedLinks namespace={page.namespace} gameId={page.game_id} canonicalPath={page.canonical_path} /></PageSidebar></div>;
}
