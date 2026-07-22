import fs from "node:fs/promises";
import { repoPath } from "@/lib/paths";
import { CatalogAdSlot } from "@/components/CatalogAdSlot";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { MoreCatalogs } from "@/components/more-content";
import { breadcrumbJsonLd, SITE_URL, webPageJsonLd } from "@/lib/seo";
import { PageBreadcrumb, type PageBreadcrumbItem } from "@/components/PageBreadcrumb";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";
import { ContentFaq } from "@/components/ContentFaq";
import { renderPageContentNodes } from "@/lib/page-content";
import { ErrorsBrowser, type ErrorSection, type RobloxErrorItem } from "./ErrorsBrowser";

export const BASE_PATH = "/catalog/roblox-errors-and-fixes";
export const CANONICAL = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}`;
const ERRORS_COMMENTS_ENTITY_ID = "6854c89c-57de-42ac-8524-1997c675655a";

const ERRORS_DATA_FILE = repoPath("data", "roblox-errors", "roblox-errors.json");

export const ERROR_SECTIONS: ErrorSection[] = [
  {
    surface: "client",
    label: "Joining and in-game errors",
    blurb: "Errors that appear while joining an experience or during play, including the common 2xx and 5xx disconnect codes."
  },
  {
    surface: "launcher",
    label: "Launch and login errors",
    blurb: "Errors that stop Roblox from starting or signing you in before you ever reach a game."
  },
  {
    surface: "installation",
    label: "Install and update errors",
    blurb: "Errors that block installing, updating, or repairing the Roblox app."
  },
  {
    surface: "website",
    label: "Website errors",
    blurb: "Errors you hit on roblox.com in a browser, from avatar pages to server-side failures."
  },
  {
    surface: "teleport",
    label: "Teleport errors",
    blurb: "Errors thrown when an experience tries to move you between places or servers."
  },
  {
    surface: "account",
    label: "Account and login errors",
    blurb: "Errors tied to your account state, sign-in checks, or parental control settings."
  },
  {
    surface: "purchase",
    label: "Purchase errors",
    blurb: "Errors that interrupt Robux purchases or in-experience transactions."
  },
  {
    surface: "console",
    label: "Xbox and PlayStation errors",
    blurb: "Console-specific error codes on Xbox and PlayStation versions of Roblox."
  },
  {
    surface: "mobile",
    label: "Mobile errors",
    blurb: "Problems specific to the Roblox app on iOS and Android devices."
  },
  {
    surface: "voice-chat",
    label: "Voice chat errors",
    blurb: "Problems with Roblox voice chat, from missing options to microphone failures."
  },
  {
    surface: "studio",
    label: "Roblox Studio errors",
    blurb: "Errors that appear while working in Roblox Studio rather than playing."
  }
];

type RobloxErrorsDataset = {
  meta: {
    title?: string;
    updatedAt?: string;
    itemCount?: number;
  };
  items: RobloxErrorItem[];
};

export type CatalogContentHtml = {
  id?: string | null;
  title?: string | null;
  introHtml?: string;
  howHtml?: string;
  descriptionHtml?: Array<{ key: string; html: string }>;
  faqHtml?: Array<{ q: string; a: string }>;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

export type BreadcrumbItem = PageBreadcrumbItem;

export async function loadRobloxErrorsPageData(): Promise<RobloxErrorsDataset> {
  try {
    const file = await fs.readFile(ERRORS_DATA_FILE, "utf8");
    const parsed = JSON.parse(file) as RobloxErrorsDataset;
    return {
      meta: parsed.meta ?? {},
      items: Array.isArray(parsed.items) ? parsed.items : []
    };
  } catch (error) {
    console.error("Failed to load Roblox errors dataset", error);
    return {
      meta: {},
      items: []
    };
  }
}

function buildErrorItemListSchema({
  title,
  description,
  url,
  items
}: {
  title: string;
  description: string;
  url: string;
  items: RobloxErrorItem[];
}) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Thing",
        name: item.name,
        ...(item.errorCode ? { identifier: item.errorCode } : {}),
        description: item.reasonSummary,
        ...(item.articleSlug
          ? { url: `${SITE_URL.replace(/\/$/, "")}/articles/${item.articleSlug}` }
          : {})
      }
    }))
  });
}

export function renderRobloxErrorsPage({
  items,
  updatedAt,
  contentHtml
}: {
  items: RobloxErrorItem[];
  updatedAt: string | null;
  contentHtml?: CatalogContentHtml | null;
}) {
  const baseTitle = contentHtml?.title?.trim() ? contentHtml.title.trim() : "Roblox errors and fixes";
  const introHtml = contentHtml?.introHtml?.trim() ? contentHtml.introHtml : "";
  const descriptionHtml = contentHtml?.descriptionHtml ?? [];
  const howHtml = contentHtml?.howHtml?.trim() ? contentHtml.howHtml : "";
  const faqHtml = contentHtml?.faqHtml ?? [];
  const updatedDate = updatedAt ? new Date(updatedAt) : null;
  const introNodes = introHtml ? renderPageContentNodes(introHtml, "errors-intro") : null;
  const descriptionNodes = descriptionHtml.flatMap((entry) =>
    renderPageContentNodes(entry.html, `errors-description-${entry.key}`)
  );
  const howNodes = howHtml ? renderPageContentNodes(howHtml, "errors-how") : null;
  const faqNodes = faqHtml.map((faq, idx) => ({
    ...faq,
    nodes: renderPageContentNodes(faq.a, `errors-faq-${idx}`)
  }));
  const canonicalUrl = CANONICAL;
  const description =
    "Browse every common Roblox error in one catalog with what each error means, why it happens, the quick fix, and a full fix guide for the tricky ones.";
  const publishedDate = contentHtml?.publishedAt ? new Date(contentHtml.publishedAt) : null;
  const publishedIso = publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : undefined;
  const updatedIso = updatedDate && !Number.isNaN(updatedDate.getTime()) ? updatedDate.toISOString() : undefined;
  const pageSchema = JSON.stringify(
    webPageJsonLd({
      siteUrl: SITE_URL,
      slug: BASE_PATH.replace(/^\//, ""),
      title: baseTitle,
      description,
      image: `${SITE_URL}/Bloxodes.png`,
      author: null,
      publishedAt: publishedIso,
      updatedAt: updatedIso
    })
  );
  const listSchema = buildErrorItemListSchema({
    title: baseTitle,
    description,
    url: canonicalUrl,
    items
  });
  const breadcrumbSchema = JSON.stringify(
    breadcrumbJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Catalog", url: `${SITE_URL.replace(/\/$/, "")}/catalog` },
      { name: "Roblox errors and fixes", url: canonicalUrl }
    ])
  );
  const hasDetails = Boolean(descriptionNodes.length) || Boolean(howNodes) || Boolean(faqNodes.length);
  const commentsEntityId = contentHtml?.id ?? ERRORS_COMMENTS_ENTITY_ID;

  return (
    <div className="catalog-surface space-y-10">
      <header className="space-y-4">
        <PageBreadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Catalog", href: "/catalog" },
            { label: "Roblox errors and fixes", href: null }
          ]}
        />
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{baseTitle}</h1>
        <UpdatedTimestamp value={updatedDate} />
      </header>

      <section id="article-body" itemProp="articleBody" className="article-content md-copy-scope copy-with-sidebar-space space-y-6">
        {introNodes ? introNodes : null}

        <CatalogAdSlot />

        <ErrorsBrowser items={items} sections={ERROR_SECTIONS} />

        <CatalogAdSlot />

        {hasDetails ? (
          <>
            {descriptionNodes.length ? descriptionNodes : null}

            {howNodes ? howNodes : null}

            <ContentFaq
              items={faqNodes.map((faq, idx) => ({
                id: `${faq.q}-${idx}`,
                question: faq.q,
                answer: faq.nodes
              }))}
            />
          </>
        ) : null}
      </section>

      <CommentsSection entityType="catalog" entityId={commentsEntityId} />
      <MoreCatalogs excludeCode="roblox-errors-and-fixes" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: listSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
    </div>
  );
}
