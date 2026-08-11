import fs from "node:fs/promises";
import { repoPath } from "@/lib/paths";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ContentFaq } from "@/components/ContentFaq";
import { MoreCatalogs } from "@/components/more-content";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { renderPageContentNodes } from "@/lib/page-content";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import {
  RobloxDictionaryDirectory,
  filterDictionaryItems,
  type DictionaryCategory,
  type DictionaryFilters,
  type DictionaryTerm
} from "./RobloxDictionaryCatalog";

export const BASE_PATH = "/catalog/roblox-dictionary";
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;
const DICTIONARY_COMMENTS_ENTITY_ID = "c633420b-28a3-42ad-85cc-8f331af74d57";
const DICTIONARY_DATA_FILE = repoPath("data", "roblox-dictionary", "roblox-dictionary.json");

export const DICTIONARY_CATEGORIES: DictionaryCategory[] = [
  {
    key: "chat-and-social",
    label: "Chat and social terms",
    shortLabel: "Chat and social",
    blurb: "Short replies, slang, and community phrases you are likely to see in Roblox chat."
  },
  {
    key: "gameplay",
    label: "Gameplay terms",
    shortLabel: "Gameplay",
    blurb: "Words players use for matches, roles, strategies, balance changes, and game systems."
  },
  {
    key: "accounts-and-safety",
    label: "Accounts and safety terms",
    shortLabel: "Accounts and safety",
    blurb: "Account language, moderation terms, and warning signs worth recognizing before trouble starts."
  },
  {
    key: "avatars-and-marketplace",
    label: "Avatar and Marketplace terms",
    shortLabel: "Avatar and Marketplace",
    blurb: "Outfit styles, avatar technology, Limited trading language, and Marketplace vocabulary."
  },
  {
    key: "creator-and-studio",
    label: "Creator and Studio terms",
    shortLabel: "Creator and Studio",
    blurb: "The building, scripting, publishing, and asset terms used by Roblox creators."
  },
  {
    key: "classic-roblox",
    label: "Classic Roblox terms",
    shortLabel: "Classic Roblox",
    blurb: "Retired systems and older slang that still appear in Roblox history and community jokes."
  }
];

type DictionaryDataset = {
  meta: {
    title?: string;
    updatedAt?: string;
    itemCount?: number;
  };
  items: DictionaryTerm[];
};

export type CatalogContentHtml = {
  id?: string | null;
  title?: string | null;
  introHtml?: string;
  descriptionHtml?: string;
  howHtml?: string;
  faqHtml?: Array<{ q: string; a: string }>;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

export async function loadRobloxDictionaryData(): Promise<DictionaryDataset> {
  try {
    const file = await fs.readFile(DICTIONARY_DATA_FILE, "utf8");
    const parsed = JSON.parse(file) as DictionaryDataset;
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      meta: { ...(parsed.meta ?? {}), itemCount: items.length },
      items
    };
  } catch (error) {
    console.error("Failed to load Roblox dictionary dataset", error);
    return { meta: {}, items: [] };
  }
}

function buildDictionaryItemListSchema({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: DictionaryTerm[];
}) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url: CANONICAL,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "DefinedTerm",
        name: item.term,
        description: item.definition,
        ...(item.expansion ? { alternateName: item.expansion } : {}),
        inDefinedTermSet: CANONICAL
      }
    }))
  });
}

export function renderRobloxDictionaryPage({
  items,
  updatedAt,
  contentHtml,
  filters
}: {
  items: DictionaryTerm[];
  updatedAt: string | null;
  contentHtml?: CatalogContentHtml | null;
  filters: DictionaryFilters;
}) {
  const title = contentHtml?.title?.trim() || "Roblox Dictionary: Slang, Acronyms & Terms";
  const description =
    "Look up Roblox slang, acronyms, and platform terms with clear definitions, expansions, examples, categories, and current or legacy labels.";
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const introNodes = contentHtml?.introHtml
    ? renderPageContentNodes(contentHtml.introHtml, "dictionary-intro")
    : null;
  const descriptionNodes = contentHtml?.descriptionHtml
    ? renderPageContentNodes(contentHtml.descriptionHtml, "dictionary-description")
    : null;
  const howNodes = contentHtml?.howHtml
    ? renderPageContentNodes(contentHtml.howHtml, "dictionary-how")
    : null;
  const faqNodes = (contentHtml?.faqHtml ?? []).map((faq, index) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `dictionary-faq-${index}`)
  }));
  const publishedDate = contentHtml?.publishedAt ? new Date(contentHtml.publishedAt) : null;
  const publishedIso = publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : undefined;
  const updatedIso = updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toISOString() : undefined;
  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: BASE_PATH.replace(/^\//, ""),
      title,
      description,
      image: `${SITE_URL}/Bloxodes.png`,
      author: null,
      publishedAt: publishedIso,
      updatedAt: updatedIso
    })
  );
  const listSchema = buildDictionaryItemListSchema({
    title,
    description,
    items: filterDictionaryItems(items, filters)
  });
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: title, url: CANONICAL }
    ])
  );
  const hasDetails = Boolean(descriptionNodes?.length) || Boolean(howNodes?.length) || Boolean(faqNodes.length);
  const commentsEntityId = contentHtml?.id ?? DICTIONARY_COMMENTS_ENTITY_ID;

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
        <UpdatedTimestamp value={updatedDate} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes}

        <CatalogAdSlot />

        <RobloxDictionaryDirectory items={items} categories={DICTIONARY_CATEGORIES} filters={filters} />

        <CatalogAdSlot />

        {hasDetails ? (
          <>
            {descriptionNodes}
            {howNodes}
            <ContentFaq
              title="Roblox Dictionary FAQ"
              items={faqNodes.map((faq, index) => ({
                id: `${faq.q}-${index}`,
                question: faq.q,
                answer: faq.nodes
              }))}
            />
          </>
        ) : null}
      </section>

      <CommentsSection entityType="catalog" entityId={commentsEntityId} />
      <MoreCatalogs excludeCode="roblox-dictionary" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
