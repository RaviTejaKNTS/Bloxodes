import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { MoreCatalogs } from "@/components/more-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { renderPageContentNodes, type PageContentHtml } from "@/lib/page-content";
import type { RobloxEmoteCommand } from "@/lib/roblox-emote-commands";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { CommandCards } from "./CommandCards";

export const CATALOG_CODE = "roblox-emote-commands";
export const BASE_PATH = `/catalog/${CATALOG_CODE}`;
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;
export const FALLBACK_TITLE = "Roblox Emote Commands";
export const FALLBACK_DESCRIPTION =
  "Copy Roblox emote commands for waving, pointing, cheering, laughing, and dancing. Learn how to enter /e commands and why they may not work.";

function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildCommandItemListSchema(
  title: string,
  description: string,
  commands: RobloxEmoteCommand[]
): string {
  return serializeJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url: CANONICAL,
    numberOfItems: commands.length,
    itemListElement: commands.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${CANONICAL}#${entry.code}`,
      item: {
        "@type": "Thing",
        name: entry.name,
        description: entry.description,
        additionalProperty: {
          "@type": "PropertyValue",
          name: "Chat command",
          value: entry.command
        }
      }
    }))
  });
}

export function renderEmoteCommandsPage({
  commands,
  contentHtml,
  description = FALLBACK_DESCRIPTION
}: {
  commands: RobloxEmoteCommand[];
  contentHtml: PageContentHtml | null;
  description?: string;
}) {
  const title = contentHtml?.title?.trim() || FALLBACK_TITLE;
  const verificationDates = commands
    .map((entry) => entry.verified_at)
    .filter(Boolean)
    .sort();
  const latestVerification = verificationDates[verificationDates.length - 1];
  const updatedAt = contentHtml?.updatedAt ?? latestVerification ?? null;
  const introNodes = contentHtml?.introHtml
    ? renderPageContentNodes(contentHtml.introHtml, "emote-commands-intro")
    : null;
  const descriptionNodes = (contentHtml?.descriptionHtml ?? []).flatMap((entry) =>
    renderPageContentNodes(entry.html, `emote-commands-description-${entry.key}`)
  );
  const howNodes = contentHtml?.howHtml
    ? renderPageContentNodes(contentHtml.howHtml, "emote-commands-how")
    : null;
  const faqNodes = (contentHtml?.faqHtml ?? []).map((faq, index) => ({
    id: `${faq.q}-${index}`,
    question: faq.q,
    answer: renderPageContentNodes(faq.a, `emote-commands-faq-${index}`)
  }));
  const pageSchema = serializeJsonLd(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: BASE_PATH.replace(/^\//, ""),
      title,
      description,
      image: `${SITE_URL}/Bloxodes.png`,
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
        className="article-content md-copy-scope copy-with-sidebar-space journey-content-stream journey-content-stream--catalog-items"
      >
        {introNodes}

        {commands.length ? (
          <CommandCards commands={commands} />
        ) : (
          <p className="rounded-lg border border-dashed border-border/70 p-8 text-center text-muted">
            The verified Roblox emote commands are temporarily unavailable.
          </p>
        )}

        <CatalogAdSlot />
        {descriptionNodes.length ? descriptionNodes : null}
        {howNodes}
        {faqNodes.length ? <ContentFaq items={faqNodes} title="Roblox Emote Commands FAQ" /> : null}
        <CatalogAdSlot />
      </section>

      {contentHtml?.id ? <CommentsSection entityType="catalog" entityId={contentHtml.id} /> : null}
      <MoreCatalogs excludeCode={CATALOG_CODE} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      {commands.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildCommandItemListSchema(title, description, commands) }}
        />
      ) : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
