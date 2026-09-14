import { listPublishedGtaChecklists } from "@/lib/gta-checklists";
import { formatUpdatedLabel } from "@/lib/updated-label";
import { ChecklistIndexPage } from "@/components/checklists/ChecklistIndexPage";
import { GTA_CHECKLISTS } from "@/lib/engagement/config";
import { engagementProgressKey } from "@/lib/engagement/types";
export async function loadGtaChecklistsPage(page: number) {
  const { checklists, total } = await listPublishedGtaChecklists(page);
  return { cards: checklists.map(row => ({
    id: row.id, slug: engagementProgressKey(GTA_CHECKLISTS.progressNamespace, row.slug), href: `/gta/checklists/${row.slug}`, title: row.title,
    summary: row.seo_description ?? "", gameName: row.game_title, coverImage: row.image ?? null,
    updatedAt: row.content_updated_at ?? row.updated_at,
    updatedLabel: formatUpdatedLabel(row.content_updated_at ?? row.updated_at), itemsCount: row.leaf_item_count
  })), total, totalPages: Math.max(1, Math.ceil(total / 20)) };
}
export function renderGtaChecklistsPage(props: Awaited<ReturnType<typeof loadGtaChecklistsPage>> & { currentPage: number }) {
  return <ChecklistIndexPage {...props} showHero={props.currentPage === 1} config={GTA_CHECKLISTS} />;
}
