import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { MoreCatalogs } from "@/components/more-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import type { RobloxFontId } from "@/lib/roblox-font-ids";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { FontIdsBrowser } from "./FontIdsBrowser";

export const CATALOG_CODE = "roblox-font-ids";
export const BASE_PATH = `/catalog/${CATALOG_CODE}`;
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;
export const FALLBACK_TITLE = "Roblox Font IDs";
export const FALLBACK_DESCRIPTION =
  "Browse official Roblox Font Codes and FontFamily asset IDs, compare clear previews, and copy the ID you need for Roblox Studio.";

function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildFontItemListSchema(title: string, description: string, fonts: RobloxFontId[]): string {
  return serializeJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url: CANONICAL,
    numberOfItems: fonts.length,
    itemListElement: fonts.map((font, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Thing",
        name: font.name,
        identifier: String(font.asset_id),
        additionalProperty: {
          "@type": "PropertyValue",
          name: "Supported styles",
          value: font.native_styles.join(", ")
        },
        url: font.creator_store_url,
        ...(font.thumbnail_url ? { image: font.thumbnail_url } : {})
      }
    }))
  });
}

export function renderFontIdsPage({
  fonts,
  contentHtml,
  description = FALLBACK_DESCRIPTION
}: {
  fonts: RobloxFontId[];
  contentHtml: PageContentHtml | null;
  description?: string;
}) {
  const title = contentHtml?.title?.trim() || FALLBACK_TITLE;
  const updatedAt = contentHtml?.updatedAt ?? fonts[0]?.verified_at ?? fonts[0]?.roblox_updated_at ?? null;
  const introNodes = contentHtml?.introHtml
    ? renderPageContentNodes(contentHtml.introHtml, "font-ids-intro")
    : null;
  const descriptionNodes = (contentHtml?.descriptionHtml ?? []).flatMap((entry) =>
    renderPageContentNodes(entry.html, `font-ids-description-${entry.key}`)
  );
  const howNodes = contentHtml?.howHtml
    ? renderPageContentNodes(contentHtml.howHtml, "font-ids-how")
    : null;
  const faqNodes = (contentHtml?.faqHtml ?? []).map((faq, index) => ({
    id: `${faq.q}-${index}`,
    question: faq.q,
    answer: renderPageContentNodes(faq.a, `font-ids-faq-${index}`)
  }));
  const pageSchema = serializeJsonLd(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: BASE_PATH.replace(/^\//, ""),
      title,
      description,
      image: fonts[0]?.thumbnail_url || `${SITE_URL}/Bloxodes.png`,
      author: null,
      publishedAt: contentHtml?.publishedAt ?? undefined,
      updatedAt: updatedAt ?? undefined
    })
  );
  const breadcrumbSchema = serializeJsonLd(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: title, url: CANONICAL }
    ])
  );

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Catalog", href: "/catalog" },
            { label: title, href: null }
          ]}
        />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{title}</h1>
        <UpdatedTimestamp value={updatedAt} />
      </header>

      <section
        id="article-body"
        itemProp="articleBody"
        className="article-content md-copy-scope copy-with-sidebar-space journey-content-stream journey-content-stream--font"
      >
        {introNodes}

        {fonts.length ? (
          <FontIdsBrowser fonts={fonts} />
        ) : (
          <p className="rounded-lg border border-dashed border-border/70 p-8 text-center text-muted">
            The official Roblox font list is temporarily unavailable.
          </p>
        )}

        <CatalogAdSlot />
        {descriptionNodes.length ? descriptionNodes : null}
        {howNodes}
        {faqNodes.length ? <ContentFaq items={faqNodes} title="Roblox Font IDs FAQ" /> : null}
        <CatalogAdSlot />
      </section>

      {contentHtml?.id ? <CommentsSection entityType="catalog" entityId={contentHtml.id} /> : null}
      <MoreCatalogs excludeCode={CATALOG_CODE} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      {fonts.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildFontItemListSchema(title, description, fonts) }}
        />
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
