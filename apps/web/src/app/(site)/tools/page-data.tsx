import { ToolCard } from "@/components/ToolCard";
import { listPublishedTools, listPublishedToolsPage, type ToolListEntry } from "@/lib/tools";
import { TOOLS_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { IndexPageStats } from "@/components/IndexPageStats";
import { PagePagination } from "@/components/PagePagination";
import { resolveModifiedAt } from "@/lib/content-dates";
import { UpdatedTimestamp } from "@/components/UpdatedTimestamp";

const PAGE_SIZE = 20;

type PageData = {
  tools: ToolListEntry[];
  total: number;
  totalPages: number;
  latestUpdatedAt: string | null;
};

async function loadPage(pageNumber: number): Promise<PageData> {
  const [{ tools, total }, allTools] = await Promise.all([
    listPublishedToolsPage(pageNumber, PAGE_SIZE),
    listPublishedTools()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const latestUpdatedAt =
    allTools.reduce<string | null>((latestValue, tool) => {
      const candidate = resolveModifiedAt(tool);
      if (!candidate) return latestValue;
      if (!latestValue) return candidate;
      return new Date(candidate) > new Date(latestValue) ? candidate : latestValue;
    }, null) ?? null;

  return { tools, total, totalPages, latestUpdatedAt };
}

function ToolsPageView({
  tools,
  total,
  totalPages,
  currentPage,
  showHero,
  latestUpdatedAt
}: {
  tools: ToolListEntry[];
  total: number;
  totalPages: number;
  currentPage: number;
  showHero: boolean;
  latestUpdatedAt: string | null;
}) {
  return (
    <div className="space-y-10">
      {showHero ? (
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Roblox Utilities</p>
          <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            Roblox tools and calculators to plan faster
          </h1>
          <UpdatedTimestamp value={latestUpdatedAt} />
          <p className="max-w-2xl text-base text-muted md:text-lg">
            Currency converters, planning helpers, and utilities built to stay current with our latest data and guides.
          </p>
          <IndexPageStats
            items={[
              { label: `${total} tools published`, icon: "tools", tone: "accent" },
              ...(latestUpdatedAt ? [{ label: "Freshness from latest tool", icon: "clock" as const }] : [])
            ]}
          />
        </header>
      ) : (
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">Roblox Utilities</p>
          <h1 className="text-3xl font-semibold text-foreground">Roblox utilities</h1>
          <UpdatedTimestamp value={latestUpdatedAt} />
          <p className="text-sm text-muted">Page {currentPage} of {totalPages}</p>
        </header>
      )}

      {tools.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {tools.map((tool, index) => (
            <div
              key={tool.id ?? tool.code}
              className="contents"
              data-analytics-event="select_item"
              data-analytics-item-list-name="tools_index"
              data-analytics-item-id={tool.code}
              data-analytics-item-name={tool.title}
              data-analytics-position={index + 1}
              data-analytics-content-type="tool"
            >
              <ToolCard tool={tool} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-surface/60 p-8 text-center text-muted">
          No tools have been published yet. Check back soon.
        </div>
      )}

      <PagePagination basePath="/tools" currentPage={currentPage} totalPages={totalPages} />

      {showHero ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: "Roblox Tools & Calculators",
              description: TOOLS_DESCRIPTION,
              url: `${SITE_URL}/tools`
            })
          }}
        />
      ) : null}
    </div>
  );
}

export async function loadToolsPageData(page: number) {
  return loadPage(page);
}

export function renderToolsPage(props: Parameters<typeof ToolsPageView>[0]) {
  return <ToolsPageView {...props} />;
}
