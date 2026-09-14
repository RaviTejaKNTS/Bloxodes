import { pickThumbnail, summarize } from "@/lib/engagement/presentation";
import { ChecklistIndexPage } from "@/components/checklists/ChecklistIndexPage";
import { ROBLOX_CHECKLISTS } from "@/lib/engagement/config";
import type { ChecklistCardData } from "@/lib/engagement/types";
import { listPublishedChecklistsPage, type ChecklistSummaryRow } from "@/lib/db";
import { CHECKLISTS_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { formatUpdatedLabel } from "@/lib/updated-label";

export const PAGE_SIZE = 20;

function mapRowToCard(row: ChecklistSummaryRow): ChecklistCardData {
  const universeName = row.universe?.display_name ?? row.universe?.name ?? null;
  const thumb = pickThumbnail((row as any).universe?.thumbnail_urls);
  const coverImage =
    (row as any).cover_image ||
    (row as any).universe?.icon_url ||
    thumb ||
    `${SITE_URL}/Bloxodes.png`;
  const updatedAt = row.updated_at || row.published_at || row.created_at || null;
  const itemsCount =
    typeof (row as any).leaf_item_count === "number"
      ? (row as any).leaf_item_count
      : typeof (row as any).item_count === "number"
        ? (row as any).item_count
        : null;
  const summary = summarize((row as any).seo_description ?? (row as any).description_md ?? null, CHECKLISTS_DESCRIPTION);

  return {
    id: row.id,
    slug: row.slug,
    href: `${ROBLOX_CHECKLISTS.basePath}/${row.slug}`,
    title: row.title,
    summary,
    gameName: universeName,
    coverImage,
    updatedAt,
    updatedLabel: formatUpdatedLabel(updatedAt),
    itemsCount
  };
}

async function loadPage(pageNumber: number) {
  const { checklists, total } = await listPublishedChecklistsPage(pageNumber, PAGE_SIZE);
  const cards = (checklists ?? []).map(mapRowToCard);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { cards, total, totalPages };
}

export async function loadChecklistsPageData(page: number) { return loadPage(page); }
export function renderChecklistsPage(props: Awaited<ReturnType<typeof loadChecklistsPageData>> & { currentPage: number; showHero: boolean }) {
  return <ChecklistIndexPage {...props} config={ROBLOX_CHECKLISTS} />;
}
