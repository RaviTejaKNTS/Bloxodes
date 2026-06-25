import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/article-content.css";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { ADMIN_COMMANDS_DESCRIPTION, resolveSeoTitle, SITE_NAME, SITE_URL, buildAlternates } from "@/lib/seo";
import { loadAdminCommandDatasets } from "@/lib/admin-commands";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { MoreCatalogs } from "@/components/more-content";
import { buildPageContentHtml, renderPageContentNodes } from "@/lib/page-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";

export const revalidate = 21600;

const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/catalog/admin-commands`;
const CATALOG_CODE_CANDIDATES = ["admin-commands"];

async function buildCatalogContent() {
  const catalog = await getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES);
  return {
    contentHtml: await buildPageContentHtml(catalog)
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES);
  const title =
    resolveSeoTitle(catalog?.seo_title) ??
    catalog?.title ??
    `Roblox Admin Commands | ${SITE_NAME}`;
  const description = catalog?.meta_description ?? ADMIN_COMMANDS_DESCRIPTION;

  return {
    title,
    description,
    alternates: buildAlternates(CANONICAL),
    openGraph: {
      type: "website",
      url: CANONICAL,
      title,
      description,
      siteName: SITE_NAME
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function AdminCommandsHubPage() {
  const [{ contentHtml }, datasets] = await Promise.all([
    buildCatalogContent(),
    loadAdminCommandDatasets()
  ]);
  const title = contentHtml?.title?.trim() ? contentHtml.title.trim() : "Roblox admin commands";
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const howHtml = contentHtml?.howHtml?.trim() ? contentHtml.howHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const faqHtml = contentHtml?.faqHtml ?? [];
  const introNodes = introHtml ? renderPageContentNodes(introHtml, "admin-intro") : null;
  const descriptionNodes = descriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `admin-description-${entry.key}`)
  );
  const howNodes = howHtml ? renderPageContentNodes(howHtml, "admin-how") : null;
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `admin-faq-${idx}`)
  }));

  return (
    <div className="catalog-surface space-y-10">
      <PageBreadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Catalog", href: "/catalog" },
          { label: title, href: null }
        ]}
      />
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={contentHtml?.updatedAt ?? null} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes ? introNodes : null}

        {datasets.length ? (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {datasets.map((dataset) => (
                <Link
                  key={dataset.system.slug}
                  href={`/catalog/admin-commands/${dataset.system.slug}`}
                  aria-label={`${dataset.system.name} commands`}
                  className="block h-full"
                >
                  <article className="group relative overflow-hidden rounded-lg border border-border/70 bg-surface/80 px-5 py-4 transition hover:border-accent/55">
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-1 bg-accent/30 transition group-hover:bg-accent/60"
                    />
                    <div className="flex h-full flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">{dataset.system.name}</p>
                      </div>
                      <p className="text-sm text-muted">{dataset.system.cardDescription}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        {dataset.commandCount.toLocaleString("en-US")} commands
                      </p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {descriptionNodes.length ? descriptionNodes : null}

        {howNodes ? howNodes : null}

        <ContentFaq
          items={faqNodes.map((faq, idx) => ({
            id: `${faq.q}-${idx}`,
            question: faq.q,
            answer: faq.nodes
          }))}
        />
      </section>

      {contentHtml?.id ? (
        <div className="mt-10">
          <CommentsSection entityType="catalog" entityId={contentHtml.id} />
        </div>
      ) : null}
      <MoreCatalogs excludeCode="admin-commands" />
    </div>
  );
}
