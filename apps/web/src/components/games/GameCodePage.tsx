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
  const { data: codes, error } = await supabaseAdmin().from("game_codes").select("code,rewards_text,status").eq("code_page_id", page.id).order("verified_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Game codes read failed: ${error.message}`);
  const sections = [["", page.intro_md], ["How to redeem", page.redeem_md], ["Rewards", page.rewards_md], ["Troubleshooting", page.troubleshoot_md], ["Where to find codes", page.find_codes_md]] as const;
  const copy = await Promise.all(sections.map(async ([heading, md], i) => ({ heading, nodes: md ? renderPageContentNodes(await renderMarkdown(md), `${page.id}-copy-${i}`) : [] })));
  const validFaqs = Array.isArray(page.faq_json) ? page.faq_json.filter(faq => faq && typeof faq.q === "string" && faq.q.trim() && typeof faq.a === "string" && faq.a.trim()) : [];
  const faqs = await Promise.all(validFaqs.map(async (faq, i) => ({ id: `${page.id}-faq-${i}`, question: faq.q, answer: renderPageContentNodes(await renderMarkdown(faq.a), `${page.id}-faq-answer-${i}`) })));
  return <div className="space-y-8">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(webPageJsonLd({ siteUrl: SITE_URL, slug: page.canonical_path.slice(1), title: page.title, description: page.meta_description ?? "", image: `${SITE_URL}/Bloxodes.png`, author: null, publishedAt: page.published_at, updatedAt: page.updated_at })) }} />
    <header className="space-y-4"><PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: namespaceTitle, href: `/${page.namespace}` }, { label: "Codes", href: null }]} /><h1 className="text-4xl font-semibold md:text-5xl">{page.title}</h1><UpdatedTimestamp value={page.updated_at} /></header>
    <article id="article-body" className="journey-content-stream journey-content-stream--prose space-y-8">
      {copy[0].nodes.length ? <div className="article-content md-copy-scope max-w-3xl">{copy[0].nodes}</div> : null}
      {(["active", "expired"] as const).map(status => <section key={status} className="space-y-4"><h2 className="text-2xl font-semibold">{status === "active" ? "Active codes" : "Expired codes"}</h2>{codes?.some(code => code.status === status) ? <ul className="space-y-3">{codes.filter(code => code.status === status).map(code => <li key={code.code} className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4"><code className="font-semibold">{code.code}</code>{code.rewards_text ? <span>{code.rewards_text}</span> : null}{status === "active" ? <CopyGameCode code={code.code} /> : null}</li>)}</ul> : <p className="text-muted">{status === "active" ? "No verified active codes are listed." : "No expired codes are listed."}</p>}</section>)}
      {copy.slice(1).filter(section => section.nodes.length).map(section => <section key={section.heading} className="article-content md-copy-scope max-w-3xl"><h2>{section.heading}</h2>{section.nodes}</section>)}
      {faqs.length ? <ContentFaq items={faqs} /> : null}
    </article>
    <CommentsSection entityType="game_code" entityId={page.id} />
  </div>;
}
