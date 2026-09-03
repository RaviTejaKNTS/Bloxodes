import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { GtaCollectionSelect } from "@/components/gta/GtaCollectionSelect";
import { GtaCollectibleChecklist, type GtaCollectibleSection } from "@/components/gta/GtaCollectibleChecklist";
import type { GameCollectionDataset } from "@/app/(site)/wiki/collections/games/generic";
import type { GtaWikiCollectionPage } from "@/lib/gta";
import type { GameCollectionRenderConfig } from "@/lib/game-collections";
import { renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";

const DESCRIPTION_MD_KEY = "description-md";

function resolveAbsoluteUrl(value: string | null | undefined): string {
  if (!value) return `${SITE_URL}/Bloxodes.png`;
  return /^https?:\/\//i.test(value) ? value : `${SITE_URL.replace(/\/$/, "")}/${value.replace(/^\//, "")}`;
}

function normalizeFields(item: Record<string, unknown>) {
  const { id, name, image, ...fields } = item;
  return { id: String(id ?? ""), name: String(name ?? ""), image: typeof image === "string" ? image : null, ...fields };
}

function buildSections(
  groupedSections: Array<{ id: string; label: string; items: Array<Record<string, unknown>> }>,
  notes: Record<string, string> | null | undefined
): GtaCollectibleSection[] {
  return groupedSections.map((section) => ({
    id: section.id,
    label: section.label,
    note: notes?.[section.label] ?? notes?.[section.id] ?? null,
    items: section.items.map((item) => normalizeFields(item))
  }));
}

function buildItemListSchema({
  title,
  description,
  url,
  sections,
  total
}: {
  title: string;
  description: string;
  url: string;
  sections: GtaCollectibleSection[];
  total: number;
}) {
  const items = sections.flatMap((section) => section.items);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url,
    numberOfItems: total,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Thing",
        name: item.name,
        url: `${url}#item-${item.id}`,
        image: resolveAbsoluteUrl(item.image)
      }
    }))
  };
}

export function renderGtaCollectibleCollectionPage({
  page,
  config,
  dataset,
  groupedSections,
  contentHtml,
  collectionOptions
}: {
  page: GtaWikiCollectionPage;
  config: GameCollectionRenderConfig;
  dataset: GameCollectionDataset;
  groupedSections: Array<{ id: string; label: string; items: Array<Record<string, unknown>> }>;
  contentHtml: PageContentHtml | null;
  collectionOptions: Array<{ value: string; label: string; href: string; pageType?: "database" | "checklist" }>;
}) {
  const sections = buildSections(groupedSections, page.description_json);
  const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const title = contentHtml?.title?.trim() || `All ${itemCount.toLocaleString("en-US")} ${config.label} in ${config.gameName}`;
  const description = page.meta_description || `${config.gameName} ${config.label.toLowerCase()} checklist with locations, access notes, and progress tracking.`;
  const canonicalPath = `/gta/wiki/${config.gameSlug}/${config.slug}`;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const updatedAt = contentHtml?.updatedAt ?? page.content_updated_at ?? page.updated_at ?? page.published_at;
  const introNodes = contentHtml?.introHtml ? renderPageContentNodes(contentHtml.introHtml, `${config.code}-intro`) : [];
  const detailEntries = contentHtml?.descriptionHtml?.filter((entry) => entry.key === DESCRIPTION_MD_KEY) ?? [];
  const detailNodes = detailEntries.flatMap((entry) => renderPageContentNodes(entry.html, `${config.code}-detail-${entry.key}`));
  const howNodes = contentHtml?.howHtml ? renderPageContentNodes(contentHtml.howHtml, `${config.code}-how`) : [];
  const faqNodes = (contentHtml?.faqHtml ?? []).map((entry, index) => ({
    id: `${config.code}-faq-${index}`,
    question: entry.q,
    answer: renderPageContentNodes(entry.a, `${config.code}-faq-answer-${index}`)
  }));
  const image = sections.flatMap((section) => section.items).find((item) => item.image)?.image ?? page.thumb_url ?? page.game_cover_image;
  const schema = [
    webPageJsonLd({ siteUrl: SITE_URL, slug: canonicalPath.slice(1), title, description, image: resolveAbsoluteUrl(image), author: null, publishedAt: contentHtml?.publishedAt ?? page.published_at, updatedAt }),
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "GTA", url: `${SITE_URL}/gta` },
      { name: "GTA Wiki", url: `${SITE_URL}/gta/wiki` },
      { name: config.gameName, url: `${SITE_URL}/gta/wiki/${config.gameSlug}` },
      { name: config.label, url: canonicalUrl }
    ]),
    buildItemListSchema({ title, description, url: canonicalUrl, sections, total: itemCount })
  ];

  return (
    <div className="catalog-surface space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": schema }) }} />
      <header className="space-y-4">
        <PageBreadcrumb items={[{ label: "Home", href: "/" }, { label: "GTA", href: "/gta" }, { label: "Wiki", href: "/gta/wiki" }, { label: config.gameName, href: `/gta/wiki/${config.gameSlug}` }, { label: config.label, href: null }]} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={updatedAt} />
      </header>

      <article id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space journey-content-stream journey-content-stream--interactive space-y-8">
        {introNodes.length ? <section className="max-w-3xl space-y-4">{introNodes}</section> : null}
        <CatalogAdSlot />
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <GtaCollectionSelect value={config.code} options={collectionOptions} />
          <p className="text-sm text-muted">Use the checkboxes to track your route.</p>
        </div>
        <GtaCollectibleChecklist
          code={config.code}
          gameName={config.gameName}
          collectionLabel={config.label}
          sections={sections}
          cardFields={dataset.meta?.display?.cardFields ?? null}
        />
        <CatalogAdSlot />
        {howNodes.length ? <section className="max-w-3xl space-y-3">{howNodes}</section> : null}
        {detailNodes.length ? <section className="max-w-3xl space-y-3">{detailNodes}</section> : null}
        {faqNodes.length ? <ContentFaq items={faqNodes} /> : null}
      </article>

      {contentHtml?.id ? <CommentsSection entityType="gta_wiki_collection" entityId={contentHtml.id} /> : null}
    </div>
  );
}
