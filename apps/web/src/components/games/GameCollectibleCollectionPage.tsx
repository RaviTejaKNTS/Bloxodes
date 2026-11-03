import { safeJsonLd } from "@/lib/seo";
import { gameBreadcrumbs } from "@/lib/game-root-page";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { CollectionFaq } from "@/components/game-collections/CollectionFaq";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { GameCollectibleChecklist, type GameCollectibleSection } from "@/components/games/GameCollectibleChecklist";
import type { GameCollectionDataset } from "@/app/(site)/wiki/collections/games/generic";
import type { SharedGameWikiCollectionPage } from "@/lib/shared-game-reader";
import { getCollectionFieldLabels, type GameCollectionRenderConfig } from "@/lib/game-collections";
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
): GameCollectibleSection[] {
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
  sections: GameCollectibleSection[];
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
        ...(item.image ? { image: resolveAbsoluteUrl(item.image) } : {})
      }
    }))
  };
}

export function renderGameCollectibleCollectionPage({
  page,
  namespaceTitle,
  wikiPath,
  config,
  dataset,
  groupedSections,
  contentHtml,
  collectionOptions,
  landingPath = `/${page.namespace}`
}: {
  page: SharedGameWikiCollectionPage;
  namespaceTitle: string;
  wikiPath: string;
  config: GameCollectionRenderConfig;
  dataset: GameCollectionDataset;
  groupedSections: Array<{ id: string; label: string; items: Array<Record<string, unknown>> }>;
  contentHtml: PageContentHtml | null;
  collectionOptions: Array<{ value: string; label: string; href: string; pageType?: "database" | "collectible" }>;
  landingPath?: string;
}) {
  const sections = buildSections(groupedSections, page.description_json);
  const configuredCardFields = dataset.meta?.display?.cardFields ?? [];
  const cardFields = sections.some((section) => section.items.some((item) => typeof item.location === "string" && item.location.trim()))
    && !configuredCardFields.includes("location")
    ? [...configuredCardFields, "location"]
    : configuredCardFields;
  const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const title = contentHtml?.title?.trim() || `All ${itemCount.toLocaleString("en-US")} ${config.label} in ${config.gameName}`;
  const description = page.meta_description || `${config.gameName} ${config.label.toLowerCase()} collectibles with locations, access notes, and progress tracking.`;
  const canonicalPath = page.canonical_path;
  const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${canonicalPath}`;
  const breadcrumbs = gameBreadcrumbs([
    { label: "Home", href: "/" },
    { label: namespaceTitle, href: landingPath },
    ...(page.canonical_path.startsWith("/wiki/") ? (landingPath?.startsWith("/games/") ? [] : [{ label: "Wiki", href: "/wiki" }]) : [{ label: "Wiki", href: `/${page.namespace}/wiki` }]),
    { label: config.gameName, href: wikiPath },
    { label: config.label, href: null }
  ], canonicalPath);
  const updatedAt = contentHtml?.updatedAt ?? page.content_updated_at ?? page.updated_at ?? page.published_at;
  const introNodes = contentHtml?.introHtml ? renderPageContentNodes(contentHtml.introHtml, `${config.code}-intro`) : [];
  const detailEntries = contentHtml?.descriptionHtml?.filter((entry) => entry.key === DESCRIPTION_MD_KEY) ?? [];
  const detailNodes = detailEntries.flatMap((entry) => renderPageContentNodes(entry.html, `${config.code}-detail-${entry.key}`));
  const faqNodes = (contentHtml?.faqHtml ?? []).map((entry, index) => ({
    id: `${config.code}-faq-${index}`,
    question: entry.q,
    answer: renderPageContentNodes(entry.a, `${config.code}-faq-answer-${index}`)
  }));
  const image = sections.flatMap((section) => section.items).find((item) => item.image)?.image ?? page.thumb_url ?? page.game_cover_image;
  const schema = [
    webPageJsonLd({ siteUrl: SITE_URL, slug: canonicalPath.slice(1), title, description, image: resolveAbsoluteUrl(image), author: null, publishedAt: contentHtml?.publishedAt ?? page.published_at, updatedAt }),
    breadcrumbJsonLd(breadcrumbs.map(item => ({ name: item.label, url: item.href === "/" ? SITE_URL : `${SITE_URL}${item.href || canonicalPath}` }))),
    buildItemListSchema({ title, description, url: canonicalUrl, sections, total: itemCount })
  ];

  return (
    <div className="catalog-surface space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({ "@context": "https://schema.org", "@graph": schema }) }} />
      <header className="space-y-4">
        <PageBreadcrumb items={breadcrumbs} />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={updatedAt} />
      </header>

      <GameCollectibleChecklist
        namespace={page.namespace}
        code={config.code}
        gameName={config.gameName}
        collectionLabel={config.label}
        sections={sections}
        cardFields={cardFields}
        fieldLabels={getCollectionFieldLabels(dataset.meta?.display, dataset.meta?.itemFields ?? [])}
        collectionOptions={collectionOptions}
        beforeToolbar={<>{introNodes}</>}
        afterContent={<>{detailNodes}<CollectionFaq items={faqNodes} /></>}
      />

      {contentHtml?.id ? <CommentsSection entityType={"game_collection"} entityId={contentHtml.id} /> : null}
    </div>
  );
}
